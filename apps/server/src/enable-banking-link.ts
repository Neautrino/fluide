/* SOURCE OF TRUTH: the server side of the Enable Banking connect handshake.
 * Invariant: each `state` is single-use and checked, so a forged or replayed callback is refused.
 * Never: return the session_id to the caller.
 * See: ADR 008 — why the first ingest runs inside the callback
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
import { ingestConnection, LOCAL_TENANT_ID, type IngestResult } from './ingest.js'

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
  const connectionId = await saveConnection(LOCAL_TENANT_ID, {
    provider: 'enable-banking',
    credential: session.sessionId,
    institutionName: `${session.aspspName} (${session.country})`,
    validUntil: session.validUntil,
  })

  const ingest = await ingestConnection(createEnableBankingConnector(credentials), connectionId, session.sessionId)
  return {
    ok: true,
    connectionId,
    institutionName: `${session.aspspName} (${session.country})`,
    validUntil: session.validUntil,
    accountsAuthorized: session.accountCount,
    ingest,
  }
}
