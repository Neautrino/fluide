/** SOURCE OF TRUTH: the Enable Banking connect handshake on the server side.
 * WHAT: starts bank authorization (one-time `state`, consent length taken
 * from the bank's own maximum) and completes it from the web callback's
 * code: exchanges it for a session, stores the session_id in
 * connection-store.ts, and runs the first ingest immediately.
 * WHY: `state` is checked so a forged or replayed callback cannot attach a
 * session to this install. The first ingest runs inside the callback because
 * many banks expose full history only for about an hour after authorization,
 * then just 90 days (Enable Banking FAQ). Pending `state`s live in memory: a
 * server restart between "connect" and the bank redirect makes the callback
 * fail with "unknown state" — the user just connects again. `credentials`
 * (appId + private-key path) come from provider-credentials.ts, not
 * process.env — the caller (index.ts) fetches them first and passes them in.
 * WHERE: owns the handshake only. HTTP calls/normalization live in
 * @repo/connectors' enable-banking.ts; ledger writes live in ingest.ts. The
 * session_id is never returned to the caller.
 */
import { randomUUID } from 'node:crypto'
import {
  createEnableBankingConnector,
  listEnableBankingAspsps,
  startEnableBankingAuth,
  createEnableBankingSession,
  type EnableBankingCredentials,
} from '@repo/connectors'
import { saveConnection } from './connection-store.js'
import { ingestConnection, type IngestResult } from './ingest.js'

const STATE_TTL_MS = 15 * 60 * 1000
const DEFAULT_CONSENT_SECONDS = 90 * 24 * 60 * 60

const pendingStates = new Map<string, { expiresAt: number }>()

function redirectUrl() {
  const url = process.env.ENABLE_BANKING_REDIRECT_URL
  if (!url) throw new Error('ENABLE_BANKING_REDIRECT_URL must be set to the redirect URL registered at Enable Banking')
  return url
}

export type StartLinkResult = { ok: true; url: string } | { ok: false; status: 404; error: string }

export async function startEnableBankingLink(
  credentials: EnableBankingCredentials,
  aspspName: string,
  country: string,
): Promise<StartLinkResult> {
  const aspsp = (await listEnableBankingAspsps(credentials, country)).find((a) => a.name === aspspName)
  if (!aspsp) return { ok: false, status: 404, error: `unknown bank ${aspspName} in ${country}` }

  const now = Date.now()
  for (const [state, pending] of pendingStates) if (pending.expiresAt < now) pendingStates.delete(state)

  const state = randomUUID()
  pendingStates.set(state, { expiresAt: now + STATE_TTL_MS })
  const consentSeconds = aspsp.maximum_consent_validity ?? DEFAULT_CONSENT_SECONDS
  const url = await startEnableBankingAuth(credentials, {
    aspspName: aspsp.name,
    country: aspsp.country,
    redirectUrl: redirectUrl(),
    state,
    validUntil: new Date(now + consentSeconds * 1000),
  })
  return { ok: true, url }
}

export type CompleteLinkResult =
  | {
      ok: true
      connectionId: string
      institutionName: string
      validUntil: string
      accountsAuthorized: number
      ingest: IngestResult
    }
  | { ok: false; status: 400; error: string }

export async function completeEnableBankingLink(
  credentials: EnableBankingCredentials,
  code: string,
  state: string,
): Promise<CompleteLinkResult> {
  const pending = pendingStates.get(state)
  pendingStates.delete(state) // single use, whatever happens next
  if (!pending || pending.expiresAt < Date.now()) {
    return { ok: false, status: 400, error: 'unknown or expired state; start the connection again' }
  }

  const session = await createEnableBankingSession(credentials, code)
  const connectionId = randomUUID()
  saveConnection({
    id: connectionId,
    provider: 'enable-banking',
    credential: session.sessionId,
    institutionName: `${session.aspspName} (${session.country})`,
    createdAt: new Date().toISOString(),
    validUntil: session.validUntil,
  })

  const ingest = await ingestConnection(createEnableBankingConnector(credentials), session.sessionId)
  return {
    ok: true,
    connectionId,
    institutionName: `${session.aspspName} (${session.country})`,
    validUntil: session.validUntil,
    accountsAuthorized: session.accountCount,
    ingest,
  }
}
