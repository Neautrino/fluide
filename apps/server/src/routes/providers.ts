import { Hono } from 'hono'
import {
  createPlaidConnector,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  listEnableBankingAspsps,
} from '@repo/connectors'
import { getPlaidCredentials, getEnableBankingCredentials } from '../provider-credentials.js'
import { saveConnection, listConnections } from '../connection-store.js'
import { ingestConnection, LOCAL_TENANT_ID } from '../ingest.js'
import { startEnableBankingLink, completeEnableBankingLink } from '../enable-banking-link.js'
import { connectorErrorResponse } from '../connector-errors.js'

export const providerRoutes = new Hono()

const COUNTRY_RE = /^[A-Z]{2}$/

// --- Plaid ---

providerRoutes.post('/plaid/link-token', async (c) => {
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const link_token = await createPlaidLinkToken(credentials, 'fluide-local-user')
    return c.json({ link_token })
  } catch (err) {
    return connectorErrorResponse(c, 'link-token error', err, 'failed to create link token')
  }
})

providerRoutes.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token: string; institution_name?: string }>()
  if (!body?.public_token) {
    return c.json({ error: 'public_token required' }, 400)
  }
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const { itemId, accessToken } = await exchangePlaidPublicToken(credentials, body.public_token)
    const connectionId = await saveConnection(LOCAL_TENANT_ID, {
      provider: 'plaid',
      credential: accessToken,
      externalId: itemId,
      institutionName: body.institution_name,
    })

    // ingest immediately so the ledger has data right after connecting
    const result = await ingestConnection(createPlaidConnector(credentials), connectionId, accessToken)

    return c.json({ item_id: itemId, ingest: result })
  } catch (err) {
    return connectorErrorResponse(c, 'exchange error', err, 'failed to exchange public token')
  }
})

providerRoutes.post('/plaid/sync', async (c) => {
  const items = await listConnections(LOCAL_TENANT_ID, 'plaid')
  if (items.length === 0) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const connector = createPlaidConnector(credentials)
    const results = []
    for (const item of items) {
      const result = await ingestConnection(connector, item.id, item.credential, item.cursor)
      results.push({ item_id: item.externalId, ...result })
    }
    return c.json({ synced: results })
  } catch (err) {
    return connectorErrorResponse(c, 'sync error', err, 'failed to sync transactions')
  }
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
