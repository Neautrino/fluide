/* SOURCE OF TRUTH: the server side of the Enable Banking connect handshake.
 * Invariant: each `state` is single-use and checked, so a forged or replayed callback is refused.
 * Never: return the session_id to the caller.
 * See: ADR 008 — why the first ingest runs inside the callback
 */
import { randomUUID } from 'node:crypto'
import { isIPv4, isIPv6 } from 'node:net'
import {
  createEnableBankingConnector,
  listEnableBankingAspsps,
  selectEnableBankingPsuHeaders,
  startEnableBankingAuth,
  createEnableBankingSession,
  type EnableBankingCredentials,
  type EnableBankingPsuHeaders,
} from '@repo/connectors'
import { recordConnectionStatus, retireReplacedConnections, saveConnection } from './connection-store.js'
import { connectorFailure } from './connector-errors.js'
import { ingestConnection, LOCAL_TENANT_ID, type IngestResult } from './ingest.js'

export const ENABLE_BANKING_AVAILABLE = false

const STATE_TTL_MS = 15 * 60 * 1000
const DEFAULT_CONSENT_SECONDS = 90 * 24 * 60 * 60

const pendingStates = new Map<string, { expiresAt: number }>()

function redirectUrl() {
  const url = process.env.ENABLE_BANKING_REDIRECT_URL
  if (!url) throw new Error('ENABLE_BANKING_REDIRECT_URL must be set to the redirect URL registered at Enable Banking')
  return url
}

export type Aspsp = { name: string; country: string }

/** connectors.institution_id for Enable Banking: the ASPSP's identity is its name + country. */
export function enableBankingInstitutionId(aspsp: Aspsp) {
  return `${aspsp.country}:${aspsp.name}`
}

export function parseEnableBankingInstitutionId(institutionId: string | undefined): Aspsp | undefined {
  const match = institutionId?.match(/^([A-Z]{2}):(.+)$/)
  return match ? { country: match[1]!, name: match[2]! } : undefined
}

/** Blocks that are never the user's address as a bank would see it. */
function isPublicIp(address: string) {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address
  if (isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number) as [number, number]
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b < 128) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b < 32) ||
      (a === 192 && b === 168)
    )
  }
  if (!isIPv6(address)) return false
  const lower = address.toLowerCase()
  return !(lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower))
}

/** The PSU headers the user's own request lets us send. Psu-Ip-Address only
 * when a public address is known (X-Forwarded-For is trusted only from a
 * non-public peer, i.e. a local proxy); a loopback or private IP is never sent. */
export function psuHeadersFromRequest(header: (name: string) => string | undefined, peerAddress: string | undefined): EnableBankingPsuHeaders {
  const forwarded = peerAddress && !isPublicIp(peerAddress) ? header('x-forwarded-for')?.split(',')[0]?.trim() : undefined
  const ip = [forwarded, peerAddress].find((address) => address !== undefined && isPublicIp(address))
  return {
    'Psu-Ip-Address': ip,
    'Psu-User-Agent': header('user-agent'),
    'Psu-Referer': header('referer'),
    'Psu-Accept': header('accept'),
    'Psu-Accept-Charset': header('accept-charset'),
    'Psu-Accept-Encoding': header('accept-encoding'),
    'Psu-Accept-language': header('accept-language'),
  }
}

export type BankFetch = 'user-present' | 'background'

/** Headers for a fetch the user asked for: all of the bank's required PSU
 * headers or none (then it is a background fetch, ~4 a day at many banks). */
export async function enableBankingPsuHeadersFor(
  credentials: EnableBankingCredentials,
  aspsp: Aspsp | undefined,
  available: EnableBankingPsuHeaders,
): Promise<{ psuHeaders?: Record<string, string>; bankFetch: BankFetch }> {
  const found = aspsp && (await listEnableBankingAspsps(credentials, aspsp.country)).find((a) => a.name === aspsp.name)
  const psuHeaders = found ? selectEnableBankingPsuHeaders(found.required_psu_headers ?? [], available) : undefined
  return { psuHeaders, bankFetch: psuHeaders ? 'user-present' : 'background' }
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
      bankFetch: BankFetch
    }
  | { ok: false; status: 400; error: string }

/** Stores the new session, imports it while the user is present, then retires
 * earlier logins to the same bank whose accounts all moved to this one. */
export async function completeEnableBankingLink(
  credentials: EnableBankingCredentials,
  code: string,
  state: string,
  psu: EnableBankingPsuHeaders,
): Promise<CompleteLinkResult> {
  const pending = pendingStates.get(state)
  pendingStates.delete(state) // single use, whatever happens next
  if (!pending || pending.expiresAt < Date.now()) {
    return { ok: false, status: 400, error: 'unknown or expired state; start the connection again' }
  }

  const session = await createEnableBankingSession(credentials, code)
  const aspsp = { name: session.aspspName, country: session.country }
  const institutionId = enableBankingInstitutionId(aspsp)
  const institutionName = `${session.aspspName} (${session.country})`
  const connectionId = await saveConnection(LOCAL_TENANT_ID, {
    provider: 'enable-banking',
    credential: session.sessionId,
    institutionId,
    institutionName,
    validUntil: session.validUntil,
  })

  let ingest: IngestResult
  let bankFetch: BankFetch
  try {
    const fetchMode = await enableBankingPsuHeadersFor(credentials, aspsp, psu)
    bankFetch = fetchMode.bankFetch
    ingest = await ingestConnection(
      createEnableBankingConnector(credentials, { psuHeaders: fetchMode.psuHeaders }),
      connectionId,
      session.sessionId,
    )
  } catch (err) {
    await recordConnectionStatus(LOCAL_TENANT_ID, connectionId, connectorFailure('enable-banking ingest error', err))
    throw err
  }
  await recordConnectionStatus(LOCAL_TENANT_ID, connectionId, { status: 'active' })
  await retireReplacedConnections(LOCAL_TENANT_ID, connectionId, 'enable-banking', institutionId)
  return {
    ok: true,
    connectionId,
    institutionName,
    validUntil: session.validUntil,
    accountsAuthorized: session.accountCount,
    ingest,
    bankFetch,
  }
}
