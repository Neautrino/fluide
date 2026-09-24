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
 * credentials in connection-store.ts, ledger writes in ingest.ts, all ledger
 * reads in @repo/ledger's queries.ts (shared with chat/tools.ts),
 * categorization in categorization/, review resolution in review.ts,
 * guardrail enforcement in packages/ledger's migrations.
 */
import { Hono, type MiddlewareHandler } from 'hono'
import { createPlaidLinkToken, exchangePlaidPublicToken, listEnableBankingAspsps, plaidConnector } from '@repo/connectors'
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
import { saveConnection, listConnections, updateConnectionCursor } from './connection-store.js'
import { ingestConnection, LOCAL_TENANT_ID } from './ingest.js'
import { startEnableBankingLink, completeEnableBankingLink } from './enable-banking-link.js'
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
  try {
    const link_token = await createPlaidLinkToken('fluide-local-user')
    return c.json({ link_token })
  } catch (err: any) {
    console.error('link-token error', err?.response?.data ?? err)
    return c.json({ error: 'failed to create link token' }, 500)
  }
})

app.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token: string; institution_name?: string }>()
  if (!body?.public_token) {
    return c.json({ error: 'public_token required' }, 400)
  }
  try {
    const { itemId, accessToken } = await exchangePlaidPublicToken(body.public_token)
    saveConnection({
      id: itemId,
      provider: 'plaid',
      credential: accessToken,
      institutionName: body.institution_name,
      createdAt: new Date().toISOString(),
    })

    // ingest immediately so the ledger has data right after connecting
    const result = await ingestConnection(plaidConnector, accessToken)
    if (result.nextCursor) updateConnectionCursor(itemId, result.nextCursor)

    return c.json({ item_id: itemId, ingest: result })
  } catch (err: any) {
    console.error('exchange error', err?.response?.data ?? err)
    return c.json({ error: 'failed to exchange public token' }, 500)
  }
})

app.post('/plaid/sync', async (c) => {
  const items = listConnections('plaid')
  if (items.length === 0) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  try {
    const results = []
    for (const item of items) {
      const result = await ingestConnection(plaidConnector, item.credential, item.cursor)
      if (result.nextCursor) updateConnectionCursor(item.id, result.nextCursor)
      results.push({ item_id: item.id, ...result })
    }
    return c.json({ synced: results })
  } catch (err: any) {
    console.error('sync error', err?.response?.data ?? err)
    return c.json({ error: 'failed to sync transactions' }, 500)
  }
})

const COUNTRY_RE = /^[A-Z]{2}$/

app.get('/enable-banking/aspsps', async (c) => {
  const country = c.req.query('country')?.toUpperCase()
  if (!country || !COUNTRY_RE.test(country)) return c.json({ error: 'country must be a 2-letter ISO code' }, 400)
  try {
    const aspsps = await listEnableBankingAspsps(country)
    return c.json({
      aspsps: aspsps.map((a) => ({ name: a.name, country: a.country, logo: a.logo, beta: a.beta ?? false })),
    })
  } catch (err) {
    console.error('enable-banking aspsps error', err)
    return c.json({ error: 'failed to list banks' }, 500)
  }
})

app.post('/enable-banking/auth', async (c) => {
  const body = await c.req.json<{ aspspName?: string; country?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  const country = body.country?.toUpperCase()
  if (!body.aspspName?.trim() || !country || !COUNTRY_RE.test(country)) {
    return c.json({ error: 'aspspName and a 2-letter country are required' }, 400)
  }
  try {
    const result = await startEnableBankingLink(body.aspspName.trim(), country)
    if (!result.ok) return c.json({ error: result.error }, result.status)
    return c.json({ url: result.url })
  } catch (err) {
    console.error('enable-banking auth error', err)
    return c.json({ error: 'failed to start bank authorization' }, 500)
  }
})

app.post('/enable-banking/session', async (c) => {
  const body = await c.req.json<{ code?: string; state?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body.code || !body.state) return c.json({ error: 'code and state are required' }, 400)
  try {
    const result = await completeEnableBankingLink(body.code, body.state)
    if (!result.ok) return c.json({ error: result.error }, result.status)
    const { ok: _ok, ...summary } = result
    return c.json(summary)
  } catch (err) {
    console.error('enable-banking session error', err)
    return c.json({ error: 'failed to complete bank connection' }, 500)
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
