/** SOURCE OF TRUTH: Hono entrypoint — the only HTTP surface this server exposes.
 * WHAT: wires the Plaid Link enrollment flow (link-token -> widget -> exchange),
 * the Enable Banking connect flow (bank list -> auth url -> callback code ->
 * session) and ledger-backed read routes, writing to the real double-entry ledger.
 * WHY: the credential boundary is load-bearing — apps/web only ever sees
 * link_token/public_token (Plaid) and the one-time callback code (Enable
 * Banking), never an access_token or session_id. Do not add a route that
 * returns a stored credential to the client.
 * WHERE: this file owns HTTP routing only. Provider calls + normalization live
 * in packages/connectors, the Enable Banking handshake in enable-banking-link.ts,
 * app-level provider credentials (Plaid client_id/secret, Enable Banking
 * app_id/keyPath) in provider-credentials.ts, per-connection tokens in
 * connection-store.ts, ledger writes in ingest.ts, all ledger reads in
 * @repo/ledger's queries/ (shared with chat/tools.ts), categorization in
 * categorization/, review resolution in review.ts, guardrail enforcement in
 * packages/ledger's migrations, connector-failure responses in
 * connector-errors.ts.
 */
import { Hono, type MiddlewareHandler } from 'hono'
import {
  createPlaidConnector,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  listEnableBankingAspsps,
  type PlaidCredentials,
  type EnableBankingCredentials,
} from '@repo/connectors'
import {
  listAccounts,
  listTransactionsWithPostings,
  listCategories,
  listCategorizationRules,
  listPendingReviewItems,
  listAuditLogForPosting,
  getSummary,
  getGateSettings,
  PERIODS,
  type Period,
} from '@repo/ledger'
import {
  getProviderCredentialsStatus,
  getPlaidCredentials,
  getEnableBankingCredentials,
  savePlaidCredentials,
  saveEnableBankingCredentials,
} from './provider-credentials.js'
import { saveConnection, listConnections, updateConnectionCursor } from './connection-store.js'
import { ingestConnection, LOCAL_TENANT_ID } from './ingest.js'
import { startEnableBankingLink, completeEnableBankingLink } from './enable-banking-link.js'
import { connectorErrorResponse } from './connector-errors.js'
import { categorizeUncategorizedPostings } from './categorization/categorize.js'
import { createUserRule, decideProposedRule } from './categorization/rules.js'
import { resolveReviewItem, recategorizePosting } from './review.js'
import { saveGateSettings, type GateSettingsInput } from './settings.js'
import { askAgent } from './chat/agent.js'

const app = new Hono()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

/** Rejects a malformed id with a 400 before the handler runs; without it the
 * id reaches Postgres, which fails the uuid cast and the route returns 500. */
const uuidParam =
  (name: string): MiddlewareHandler =>
  async (c, next) => {
    if (!isUuid(c.req.param(name))) return c.json({ error: `${name} must be a UUID` }, 400)
    await next()
  }

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/plaid/link-token', async (c) => {
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const link_token = await createPlaidLinkToken(credentials, 'fluide-local-user')
    return c.json({ link_token })
  } catch (err) {
    return connectorErrorResponse(c, 'link-token error', err, 'failed to create link token')
  }
})

app.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token: string; institution_name?: string }>()
  if (!body?.public_token) {
    return c.json({ error: 'public_token required' }, 400)
  }
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const { itemId, accessToken } = await exchangePlaidPublicToken(credentials, body.public_token)
    saveConnection({
      id: itemId,
      provider: 'plaid',
      credential: accessToken,
      institutionName: body.institution_name,
      createdAt: new Date().toISOString(),
    })

    // ingest immediately so the ledger has data right after connecting
    const result = await ingestConnection(createPlaidConnector(credentials), accessToken)
    if (result.nextCursor) updateConnectionCursor(itemId, result.nextCursor)

    return c.json({ item_id: itemId, ingest: result })
  } catch (err) {
    return connectorErrorResponse(c, 'exchange error', err, 'failed to exchange public token')
  }
})

app.post('/plaid/sync', async (c) => {
  const items = listConnections('plaid')
  if (items.length === 0) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  const credentials = await getPlaidCredentials(LOCAL_TENANT_ID)
  if (!credentials) return c.json({ error: 'Plaid is not configured — add a client id and secret in Settings first.' }, 409)
  try {
    const connector = createPlaidConnector(credentials)
    const results = []
    for (const item of items) {
      const result = await ingestConnection(connector, item.credential, item.cursor)
      if (result.nextCursor) updateConnectionCursor(item.id, result.nextCursor)
      results.push({ item_id: item.id, ...result })
    }
    return c.json({ synced: results })
  } catch (err) {
    return connectorErrorResponse(c, 'sync error', err, 'failed to sync transactions')
  }
})

const COUNTRY_RE = /^[A-Z]{2}$/

app.get('/enable-banking/aspsps', async (c) => {
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

app.post('/enable-banking/auth', async (c) => {
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

app.post('/enable-banking/session', async (c) => {
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

app.get('/accounts', async (c) => {
  return c.json({ accounts: await listAccounts(LOCAL_TENANT_ID) })
})

app.get('/transactions', async (c) => {
  return c.json({ transactions: await listTransactionsWithPostings(LOCAL_TENANT_ID) })
})

app.get('/api/categories', async (c) => {
  return c.json({ categories: await listCategories() })
})

app.get('/api/categorization-rules', async (c) => {
  return c.json({ rules: await listCategorizationRules(LOCAL_TENANT_ID) })
})

app.post('/api/categorization-rules', async (c) => {
  const body = await c.req.json<{ pattern?: string; categoryId?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body.pattern?.trim() || !body.categoryId) {
    return c.json({ error: 'pattern and categoryId are required' }, 400)
  }
  if (!isUuid(body.categoryId)) return c.json({ error: 'categoryId must be a UUID' }, 400)
  const result = await createUserRule(LOCAL_TENANT_ID, body.pattern.trim(), body.categoryId)
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

app.post('/api/categorization-rules/:id/activate', uuidParam('id'), async (c) => {
  const result = await decideProposedRule(c.req.param('id'), 'active')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

app.post('/api/categorization-rules/:id/reject', uuidParam('id'), async (c) => {
  const result = await decideProposedRule(c.req.param('id'), 'rejected')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

app.post('/api/categorize', async (c) => {
  const result = await categorizeUncategorizedPostings(LOCAL_TENANT_ID)
  return c.json({ result })
})

app.get('/api/review-queue', async (c) => {
  return c.json({ items: await listPendingReviewItems() })
})

app.post('/api/review-queue/:id/approve', uuidParam('id'), async (c) => {
  const id = c.req.param('id')
  const result = await resolveReviewItem(id, 'approve')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ approved: id, proposedRuleId: result.proposedRuleId })
})

app.post('/api/review-queue/:id/reject', uuidParam('id'), async (c) => {
  const id = c.req.param('id')
  const result = await resolveReviewItem(id, 'reject')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rejected: id })
})

app.post('/api/postings/:id/category', uuidParam('id'), async (c) => {
  const postingId = c.req.param('id')
  const body = await c.req.json<{ categoryId?: string }>().catch(() => ({}) as { categoryId?: string })
  if (!body.categoryId) return c.json({ error: 'categoryId is required' }, 400)
  if (!isUuid(body.categoryId)) return c.json({ error: 'categoryId must be a UUID' }, 400)
  const result = await recategorizePosting(postingId, body.categoryId)
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ postingId, categoryId: body.categoryId, proposedRuleId: result.proposedRuleId })
})

app.get('/api/settings/gate', async (c) => {
  return c.json({ settings: await getGateSettings(LOCAL_TENANT_ID) })
})

app.put('/api/settings/gate', async (c) => {
  const body = await c.req.json<Partial<GateSettingsInput>>().catch(() => ({}))
  const result = await saveGateSettings(LOCAL_TENANT_ID, body)
  if (!result.ok) return c.json({ error: result.error }, 400)
  return c.json({ settings: result.settings })
})

const PROVIDERS = ['plaid', 'enable-banking'] as const
type ProviderParam = (typeof PROVIDERS)[number]
const isProvider = (value: unknown): value is ProviderParam =>
  typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)

app.get('/api/settings/provider-credentials/:provider', async (c) => {
  const provider = c.req.param('provider')
  if (!isProvider(provider)) return c.json({ error: `provider must be one of ${PROVIDERS.join(', ')}` }, 400)
  return c.json(await getProviderCredentialsStatus(LOCAL_TENANT_ID, provider))
})

app.put('/api/settings/provider-credentials/:provider', async (c) => {
  const provider = c.req.param('provider')
  if (!isProvider(provider)) return c.json({ error: `provider must be one of ${PROVIDERS.join(', ')}` }, 400)
  const result =
    provider === 'plaid'
      ? await savePlaidCredentials(LOCAL_TENANT_ID, await c.req.json<Partial<PlaidCredentials>>().catch(() => ({})))
      : await saveEnableBankingCredentials(
          LOCAL_TENANT_ID,
          await c.req.json<Partial<EnableBankingCredentials>>().catch(() => ({})),
        )
  if (!result.ok) return c.json({ error: result.error }, 400)
  return c.json({ ok: true })
})

app.get('/api/summary', async (c) => {
  const period = (c.req.query('period') ?? 'this_month') as Period
  if (!PERIODS.includes(period)) return c.json({ error: `period must be one of ${PERIODS.join(', ')}` }, 400)
  return c.json(await getSummary(LOCAL_TENANT_ID, period))
})

app.post('/api/chat', async (c) => {
  const body = await c.req.json<{ message: string; threadId: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body?.message?.trim() || !body?.threadId) {
    return c.json({ error: 'message and threadId are required' }, 400)
  }
  try {
    const reply = await askAgent(body.message, body.threadId)
    return c.json(reply)
  } catch (err) {
    console.error('chat error', err)
    return c.json({ error: 'failed to get a reply' }, 500)
  }
})

app.get('/api/audit-log/:postingId', uuidParam('postingId'), async (c) => {
  return c.json({ entries: await listAuditLogForPosting(c.req.param('postingId')) })
})

export default {
  port: 4000,
  // /api/categorize batches Jev calls, and /api/chat is a multi-hop
  // tool-calling agent loop (decide tool -> run it -> final answer, and
  // that can chain across more than one tool) -- both can legitimately
  // take longer than Bun's 10s default. Widen the idle timeout so a real
  // in-flight request isn't killed mid-response.
  idleTimeout: 90,
  fetch: app.fetch,
}
