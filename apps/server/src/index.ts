/** SOURCE OF TRUTH: Hono entrypoint — the only HTTP surface this server exposes.
 * WHAT: wires the Plaid Link enrollment flow (link-token -> widget -> exchange)
 * and ledger-backed read routes, writing to the real double-entry ledger.
 * WHY: the public_token/access_token boundary is load-bearing — apps/web only
 * ever sees link_token and public_token, never access_token. Do not add a
 * route that returns accessToken to the client.
 * WHERE: this file owns HTTP routing only. Plaid calls + normalization live
 * in packages/connectors, ledger writes live in ingest.ts, all ledger reads
 * live in @repo/ledger's queries.ts (shared with chat/tools.ts),
 * categorization lives in categorization/, review resolution lives in
 * review.ts, guardrail enforcement lives in packages/ledger's migrations.
 */
import { Hono, type MiddlewareHandler } from 'hono'
import { createPlaidLinkToken, exchangePlaidPublicToken } from '@repo/connectors'
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
import { saveItem, listItems, updateItemCursor } from './plaid-store.js'
import { ingestPlaidItem, LOCAL_TENANT_ID } from './ingest.js'
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
    saveItem({
      itemId,
      accessToken,
      institutionName: body.institution_name,
      createdAt: new Date().toISOString(),
    })

    // ingest immediately so the ledger has data right after connecting
    const result = await ingestPlaidItem(accessToken)
    if (result.nextCursor) updateItemCursor(itemId, result.nextCursor)

    return c.json({ item_id: itemId, ingest: result })
  } catch (err: any) {
    console.error('exchange error', err?.response?.data ?? err)
    return c.json({ error: 'failed to exchange public token' }, 500)
  }
})

app.post('/plaid/sync', async (c) => {
  const items = listItems()
  if (items.length === 0) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  try {
    const results = []
    for (const item of items) {
      const result = await ingestPlaidItem(item.accessToken, item.cursor)
      if (result.nextCursor) updateItemCursor(item.itemId, result.nextCursor)
      results.push({ item_id: item.itemId, ...result })
    }
    return c.json({ synced: results })
  } catch (err: any) {
    console.error('sync error', err?.response?.data ?? err)
    return c.json({ error: 'failed to sync transactions' }, 500)
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
