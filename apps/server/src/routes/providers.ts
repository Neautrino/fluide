import { Hono } from 'hono'
import {
  ConnectorError,
  createPlaidConnector,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  getPlaidInstitution,
  listEnableBankingAspsps,
  removePlaidItem,
  type PlaidCredentials,
} from '@repo/connectors'
import { getPlaidCredentials, getEnableBankingCredentials } from '../provider-credentials.js'
import {
  disconnectConnection,
  getConnection,
  listConnections,
  listConnectionSummaries,
  recordConnectionStatus,
  saveConnection,
  setConnectionInstitution,
  type Connection,
} from '../connection-store.js'
import { ingestConnection, LOCAL_TENANT_ID, type IngestResult } from '../ingest.js'
import { startEnableBankingLink, completeEnableBankingLink } from '../enable-banking-link.js'
import { connectorErrorResponse, connectorFailure } from '../connector-errors.js'
import { uuidParam } from './validate.js'

export const providerRoutes = new Hono()

const COUNTRY_RE = /^[A-Z]{2}$/
const PLAID_NOT_CONFIGURED = 'Plaid is not configured — add a client id and secret in Settings first.'

type SyncOutcome =
  | { connectionId: string; institutionName: string | null; ok: true; ingest: IngestResult }
  | { connectionId: string; institutionName: string | null; ok: false; status: 'reauth_required' | 'error'; error: string }

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
    return { connectionId: connection.id, institutionName, ok: true, ingest }
  } catch (err) {
    const failure = connectorFailure('plaid sync error', err)
    await recordConnectionStatus(LOCAL_TENANT_ID, connection.id, failure)
    return { connectionId: connection.id, institutionName, ok: false, status: failure.status, error: failure.reason }
  }
}

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

providerRoutes.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token?: string }>().catch(() => null)
  if (!body?.public_token) return c.json({ error: 'public_token required' }, 400)
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  let exchanged: { itemId: string; accessToken: string }
  try {
    exchanged = await exchangePlaidPublicToken(credentials, body.public_token)
  } catch (err) {
    return connectorErrorResponse(c, 'exchange error', err, 'failed to exchange public token')
  }
  const connectionId = await saveConnection(LOCAL_TENANT_ID, {
    provider: 'plaid',
    credential: exchanged.accessToken,
    externalId: exchanged.itemId,
  })
  const sync = await syncPlaidConnection(credentials, { id: connectionId, credential: exchanged.accessToken })
  return c.json({ sync })
})

providerRoutes.post('/plaid/sync', async (c) => {
  const items = await listConnections(LOCAL_TENANT_ID, 'plaid')
  if (items.length === 0) return c.json({ error: 'no connected accounts yet' }, 404)
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  const synced: SyncOutcome[] = []
  for (const item of items) synced.push(await syncPlaidConnection(credentials, item))
  return c.json({ synced })
})

// --- Connections (one row per bank login) ---

providerRoutes.get('/connections', async (c) => {
  return c.json({ connections: await listConnectionSummaries(LOCAL_TENANT_ID) })
})

const EB_NO_RESYNC = 'Enable Banking connections cannot be refreshed yet — link the bank again to fetch new data.'

providerRoutes.post('/connections/:id/sync', uuidParam('id'), async (c) => {
  const connection = await getConnection(LOCAL_TENANT_ID, c.req.param('id'))
  if (!connection) return c.json({ error: 'connection not found or disconnected' }, 404)
  if (connection.provider !== 'plaid') return c.json({ error: EB_NO_RESYNC }, 409)
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  return c.json({ sync: await syncPlaidConnection(credentials, connection) })
})

providerRoutes.post('/connections/:id/link-token', uuidParam('id'), async (c) => {
  const connection = await getConnection(LOCAL_TENANT_ID, c.req.param('id'))
  if (!connection) return c.json({ error: 'connection not found or disconnected' }, 404)
  if (connection.provider !== 'plaid') return c.json({ error: EB_NO_RESYNC }, 409)
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: PLAID_NOT_CONFIGURED }, 409)
  try {
    return c.json({ link_token: await createPlaidLinkToken(credentials, 'fluide-local-user', connection.credential) })
  } catch (err) {
    return connectorErrorResponse(c, 'update link-token error', err, 'failed to create a reconnect link')
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
  if (!credentials) {
    return c.json({ error: 'Enable Banking is not configured — add an app id and key path in Settings first.' }, 409)
  }
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
  if (!credentials) {
    return c.json({ error: 'Enable Banking is not configured — add an app id and key path in Settings first.' }, 409)
  }
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
  if (!credentials) {
    return c.json({ error: 'Enable Banking is not configured — add an app id and key path in Settings first.' }, 409)
  }
  try {
    const result = await completeEnableBankingLink(credentials, body.code, body.state)
    if (!result.ok) return c.json({ error: result.error }, result.status)
    const { ok: _ok, ...summary } = result
    return c.json(summary)
  } catch (err) {
    return connectorErrorResponse(c, 'enable-banking session error', err, 'failed to complete bank connection')
  }
})
