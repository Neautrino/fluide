import { Hono, type Context } from 'hono'
import { getConnInfo } from 'hono/bun'
import {
  ConnectorError,
  createEnableBankingConnector,
  createPlaidConnector,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  getPlaidInstitution,
  listEnableBankingAspsps,
  removePlaidItem,
  type EnableBankingPsuHeaders,
  type PlaidCredentials,
} from '@repo/connectors'
import { detectTransferMarks } from '@repo/ledger'
import { getPlaidCredentials, getEnableBankingCredentials } from '../provider-credentials.js'
import {
  disconnectConnection,
  getConnection,
  listConnections,
  listConnectionSummaries,
  listLoginsAtInstitution,
  recordConnectionStatus,
  refreshCountedUntil,
  retireConnection,
  saveConnection,
  setConnectionInstitution,
  type Connection,
} from '../connection-store.js'
import { ingestConnection, LOCAL_TENANT_ID, type IngestResult } from '../ingest.js'
import {
  startEnableBankingLink,
  completeEnableBankingLink,
  enableBankingPsuHeadersFor,
  parseEnableBankingInstitutionId,
  psuHeadersFromRequest,
  type BankFetch,
} from '../enable-banking-link.js'
import { connectorErrorResponse, connectorFailure } from '../connector-errors.js'
import { isUuid, uuidParam } from './validate.js'

export const providerRoutes = new Hono()

const COUNTRY_RE = /^[A-Z]{2}$/
const PLAID_NOT_CONFIGURED = 'Plaid is not configured — add a client id and secret in Settings first.'
const EB_NOT_CONFIGURED = 'Enable Banking is not configured — add an app id and key path in Settings first.'

type SyncOutcome =
  | { connectionId: string; institutionName: string | null; ok: true; ingest: IngestResult; bankFetch?: BankFetch }
  | { connectionId: string; institutionName: string | null; ok: false; status: 'reauth_required' | 'error'; error: string }

/** The end user's request headers, for Enable Banking fetches the user asked for. */
function requestPsuHeaders(c: Context): EnableBankingPsuHeaders {
  let peer: string | undefined
  try {
    peer = getConnInfo(c).remote.address
  } catch {
    peer = undefined // no Bun server in env (e.g. app.request in a script)
  }
  return psuHeadersFromRequest((name) => c.req.header(name) || undefined, peer)
}

/** Syncs one Plaid Item and records its status; one failing Item never stops the others. */
async function syncPlaidConnection(
  credentials: PlaidCredentials,
  connection: Pick<Connection, 'id' | 'credential' | 'cursor' | 'institutionName'>,
): Promise<SyncOutcome> {
  let institutionName = connection.institutionName ?? null
  if (!institutionName) {
    try {
      const institution = await getPlaidInstitution(credentials, connection.credential)
      await setConnectionInstitution(LOCAL_TENANT_ID, connection.id, institution)
      institutionName = institution.institutionName
    } catch (err) {
      connectorFailure('plaid institution lookup error', err)
    }
  }
  try {
    const ingest = await ingestConnection(createPlaidConnector(credentials), connection.id, connection.credential, connection.cursor)
    await recordConnectionStatus(LOCAL_TENANT_ID, connection.id, { status: 'active' })
    await refreshCountedUntil(LOCAL_TENANT_ID, connection.id)
    return { connectionId: connection.id, institutionName, ok: true, ingest }
  } catch (err) {
    const failure = connectorFailure('plaid sync error', err)
    await recordConnectionStatus(LOCAL_TENANT_ID, connection.id, failure)
    return { connectionId: connection.id, institutionName, ok: false, status: failure.status, error: failure.reason }
  }
}

/** Re-fetches one Enable Banking session. Expired access is marked without calling the bank. */
async function syncEnableBankingConnection(connection: Connection, psu: EnableBankingPsuHeaders): Promise<SyncOutcome> {
  const credentials = await getEnableBankingCredentials(LOCAL_TENANT_ID)
  const base = { connectionId: connection.id, institutionName: connection.institutionName ?? null }
  if (!credentials) return { ...base, ok: false, status: 'error', error: EB_NOT_CONFIGURED }
  try {
    if (connection.validUntil && connection.validUntil.getTime() <= Date.now()) {
      throw new ConnectorError('enable-banking', 'reauth_required', `access expired at ${connection.validUntil.toISOString()}`)
    }
    const { psuHeaders, bankFetch } = await enableBankingPsuHeadersFor(
      credentials,
      parseEnableBankingInstitutionId(connection.institutionId),
      psu,
    )
    const ingest = await ingestConnection(createEnableBankingConnector(credentials, { psuHeaders }), connection.id, connection.credential)
    await recordConnectionStatus(LOCAL_TENANT_ID, connection.id, { status: 'active' })
    await refreshCountedUntil(LOCAL_TENANT_ID, connection.id)
    return { ...base, ok: true, ingest, bankFetch }
  } catch (err) {
    const failure = connectorFailure('enable-banking sync error', err)
    await recordConnectionStatus(LOCAL_TENANT_ID, connection.id, failure)
    return { ...base, ok: false, status: failure.status, error: failure.reason }
  }
}

async function syncConnection(connection: Connection, psu: EnableBankingPsuHeaders): Promise<SyncOutcome> {
  if (connection.provider === 'enable-banking') return syncEnableBankingConnection(connection, psu)
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) {
    return { connectionId: connection.id, institutionName: connection.institutionName ?? null, ok: false, status: 'error', error: PLAID_NOT_CONFIGURED }
  }
  return syncPlaidConnection(credentials, connection)
}

/** Every live login, any provider; one result per login. */
providerRoutes.post('/sync', async (c) => {
  const connections = await listConnections(LOCAL_TENANT_ID)
  if (connections.length === 0) return c.json({ error: 'no connected accounts yet' }, 404)
  const psu = requestPsuHeaders(c)
  const synced: SyncOutcome[] = []
  for (const connection of connections) synced.push(await syncConnection(connection, psu))
  return c.json({ synced })
})

// --- Plaid ---

providerRoutes.post('/plaid/link-token', async (c) => {
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  try {
    const link_token = await createPlaidLinkToken(credentials, 'fluide-local-user')
    return c.json({ link_token })
  } catch (err) {
    return connectorErrorResponse(c, 'link-token error', err, 'failed to create link token')
  }
})

async function removeLinkedItem(credentials: PlaidCredentials, accessToken: string) {
  try {
    await removePlaidItem(credentials, accessToken)
  } catch (err) {
    connectorFailure('item remove error', err)
  }
}

/** A second login at a bank the tenant already has is never ingested on a
 * guess: the Item is removed at Plaid again and the user is asked what the
 * new login is. `replaces` carries the answer — a connection id or 'new'. */
providerRoutes.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token?: string; replaces?: string }>().catch(() => null)
  if (!body?.public_token) return c.json({ error: 'public_token required' }, 400)
  const replaces = body.replaces
  if (replaces !== undefined && replaces !== 'new' && !isUuid(replaces)) {
    return c.json({ error: "replaces must be a connection id or 'new'" }, 400)
  }
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  let exchanged: { itemId: string; accessToken: string }
  try {
    exchanged = await exchangePlaidPublicToken(credentials, body.public_token)
  } catch (err) {
    return connectorErrorResponse(c, 'exchange error', err, 'failed to exchange public token')
  }

  let institution: { institutionId: string | null; institutionName: string | null } | null = null
  try {
    institution = await getPlaidInstitution(credentials, exchanged.accessToken)
  } catch (err) {
    connectorFailure('plaid institution lookup error', err)
  }
  if (!institution?.institutionId) {
    await removeLinkedItem(credentials, exchanged.accessToken)
    return c.json({ error: 'could not confirm which bank this login is — try again' }, 502)
  }
  const logins = await listLoginsAtInstitution(LOCAL_TENANT_ID, 'plaid', institution.institutionId)
  const unanswered = replaces === undefined && logins.length > 0
  const unknownPredecessor = replaces !== undefined && replaces !== 'new' && !logins.some((l) => l.id === replaces)
  if (unanswered || unknownPredecessor) {
    await removeLinkedItem(credentials, exchanged.accessToken)
    if (unanswered) {
      return c.json(
        {
          error: `You're already connected to ${institution.institutionName ?? 'this bank'}.`,
          duplicateOf: { institutionName: institution.institutionName, logins },
        },
        409,
      )
    }
    return c.json({ error: 'replaces must name one of your logins at this bank' }, 400)
  }

  const connectionId = await saveConnection(LOCAL_TENANT_ID, {
    provider: 'plaid',
    credential: exchanged.accessToken,
    externalId: exchanged.itemId,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName ?? undefined,
  })
  const sync = await syncPlaidConnection(credentials, {
    id: connectionId,
    credential: exchanged.accessToken,
    institutionName: institution.institutionName ?? undefined,
  })
  if (replaces !== undefined && replaces !== 'new') {
    const predecessor = await getConnection(LOCAL_TENANT_ID, replaces)
    if (predecessor) {
      try {
        await removePlaidItem(credentials, predecessor.credential)
      } catch (err) {
        const alreadyGone = err instanceof ConnectorError && err.details.providerCode === 'ITEM_NOT_FOUND'
        if (!alreadyGone) return connectorErrorResponse(c, 'item remove error', err, 'failed to disconnect the login it replaces at Plaid')
      }
    }
    const retired = await retireConnection(LOCAL_TENANT_ID, replaces, { replacedBy: connectionId })
    if (!retired) return c.json({ error: 'replaces must name one of your logins at this bank' }, 400)
    await refreshCountedUntil(LOCAL_TENANT_ID, connectionId)
    await detectTransferMarks(LOCAL_TENANT_ID)
  }
  return c.json({ sync })
})

// --- Connections (one row per bank login) ---

providerRoutes.get('/connections', async (c) => {
  return c.json({ connections: await listConnectionSummaries(LOCAL_TENANT_ID) })
})

providerRoutes.post('/connections/:id/sync', uuidParam('id'), async (c) => {
  const connection = await getConnection(LOCAL_TENANT_ID, c.req.param('id'))
  if (!connection) return c.json({ error: 'connection not found or disconnected' }, 404)
  return c.json({ sync: await syncConnection(connection, requestPsuHeaders(c)) })
})

/** Plaid: a Link token in update mode (same Item). Enable Banking: a new bank
 * authorization for the same bank; the old login is retired once it completes. */
providerRoutes.post('/connections/:id/reconnect', uuidParam('id'), async (c) => {
  const connection = await getConnection(LOCAL_TENANT_ID, c.req.param('id'))
  if (!connection) return c.json({ error: 'connection not found or disconnected' }, 404)
  if (connection.provider === 'plaid') {
    const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
    if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
    try {
      return c.json({ plaidLinkToken: await createPlaidLinkToken(credentials, 'fluide-local-user', connection.credential) })
    } catch (err) {
      return connectorErrorResponse(c, 'update link-token error', err, 'failed to create a reconnect link')
    }
  }
  const credentials = await getEnableBankingCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: EB_NOT_CONFIGURED }, 409)
  const aspsp = parseEnableBankingInstitutionId(connection.institutionId)
  if (!aspsp) {
    return c.json({ error: 'this login does not record its bank — connect the bank again with "Connect a European bank"' }, 409)
  }
  try {
    const result = await startEnableBankingLink(credentials, aspsp.name, aspsp.country)
    if (!result.ok) return c.json({ error: result.error }, result.status)
    return c.json({ redirectUrl: result.url })
  } catch (err) {
    return connectorErrorResponse(c, 'enable-banking reconnect error', err, 'failed to start bank authorization')
  }
})

providerRoutes.post('/connections/:id/disconnect', uuidParam('id'), async (c) => {
  const connection = await getConnection(LOCAL_TENANT_ID, c.req.param('id'))
  if (!connection) return c.json({ error: 'connection not found or already disconnected' }, 404)
  if (connection.provider === 'plaid') {
    const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
    if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
    try {
      await removePlaidItem(credentials, connection.credential)
    } catch (err) {
      const alreadyGone = err instanceof ConnectorError && err.details.providerCode === 'ITEM_NOT_FOUND'
      if (!alreadyGone) return connectorErrorResponse(c, 'item remove error', err, 'failed to disconnect at Plaid')
    }
  }
  await disconnectConnection(LOCAL_TENANT_ID, connection.id)
  return c.json({ disconnected: connection.id })
})

// --- Enable Banking ---

providerRoutes.get('/enable-banking/aspsps', async (c) => {
  const country = c.req.query('country')?.toUpperCase()
  if (!country || !COUNTRY_RE.test(country)) return c.json({ error: 'country must be a 2-letter ISO code' }, 400)
  const credentials = await getEnableBankingCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: EB_NOT_CONFIGURED }, 409)
  try {
    const aspsps = await listEnableBankingAspsps(credentials, country)
    return c.json({
      aspsps: aspsps.map((a) => ({ name: a.name, country: a.country, logo: a.logo, beta: a.beta ?? false })),
    })
  } catch (err) {
    return connectorErrorResponse(c, 'enable-banking aspsps error', err, 'failed to list banks')
  }
})

providerRoutes.post('/enable-banking/auth', async (c) => {
  const body = await c.req.json<{ aspspName?: string; country?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  const country = body.country?.toUpperCase()
  if (!body.aspspName?.trim() || !country || !COUNTRY_RE.test(country)) {
    return c.json({ error: 'aspspName and a 2-letter country are required' }, 400)
  }
  const credentials = await getEnableBankingCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: EB_NOT_CONFIGURED }, 409)
  try {
    const result = await startEnableBankingLink(credentials, body.aspspName.trim(), country)
    if (!result.ok) return c.json({ error: result.error }, result.status)
    return c.json({ url: result.url })
  } catch (err) {
    return connectorErrorResponse(c, 'enable-banking auth error', err, 'failed to start bank authorization')
  }
})

providerRoutes.post('/enable-banking/session', async (c) => {
  const body = await c.req.json<{ code?: string; state?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body.code || !body.state) return c.json({ error: 'code and state are required' }, 400)
  const credentials = await getEnableBankingCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: EB_NOT_CONFIGURED }, 409)
  try {
    const result = await completeEnableBankingLink(credentials, body.code, body.state, requestPsuHeaders(c))
    if (!result.ok) return c.json({ error: result.error }, result.status)
    const { ok: _ok, ...summary } = result
    return c.json(summary)
  } catch (err) {
    return connectorErrorResponse(c, 'enable-banking session error', err, 'failed to complete bank connection')
  }
})
