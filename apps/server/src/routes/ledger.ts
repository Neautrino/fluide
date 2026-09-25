/** SOURCE OF TRUTH: Ledger data read & correction HTTP endpoints.
 * WHAT: exposes accounts, transactions with balanced postings, period-scoped
 * spending summaries, category taxonomy, posting audit trails, and manual
 * recategorizations.
 * WHY: double-entry ledger is the immutable core — all balances and summaries
 * are views replayed or aggregated from postings.
 * WHERE: owns HTTP mapping for ledger reads and user corrections. Mounted
 * under /api/ledger by apps/server/src/index.ts. Queries live in @repo/ledger,
 * manual recategorization and audit trail logging in review.ts.
 */
import { Hono } from 'hono'
import {
  listAccounts,
  listTransactionsWithPostings,
  listCategories,
  listAuditLogForPosting,
  getSummary,
  PERIODS,
  type Period,
} from '@repo/ledger'
import { LOCAL_TENANT_ID } from '../ingest.js'
import { recategorizePosting } from '../review.js'
import { isUuid, uuidParam } from './validate.js'

export const ledgerRoutes = new Hono()

ledgerRoutes.get('/accounts', async (c) => {
  return c.json({ accounts: await listAccounts(LOCAL_TENANT_ID) })
})

ledgerRoutes.get('/transactions', async (c) => {
  return c.json({ transactions: await listTransactionsWithPostings(LOCAL_TENANT_ID) })
})

ledgerRoutes.get('/summary', async (c) => {
  const period = (c.req.query('period') ?? 'this_month') as Period
  if (!PERIODS.includes(period)) {
    return c.json({ error: `period must be one of ${PERIODS.join(', ')}` }, 400)
  }
  return c.json(await getSummary(LOCAL_TENANT_ID, period))
})

ledgerRoutes.get('/categories', async (c) => {
  return c.json({ categories: await listCategories() })
})

ledgerRoutes.get('/audit-log/:postingId', uuidParam('postingId'), async (c) => {
  return c.json({ entries: await listAuditLogForPosting(c.req.param('postingId')) })
})

ledgerRoutes.post('/postings/:id/category', uuidParam('id'), async (c) => {
  const postingId = c.req.param('id')
  const body = await c.req.json<{ categoryId?: string }>().catch(() => ({}) as { categoryId?: string })
  if (!body.categoryId) return c.json({ error: 'categoryId is required' }, 400)
  if (!isUuid(body.categoryId)) return c.json({ error: 'categoryId must be a UUID' }, 400)
  const result = await recategorizePosting(postingId, body.categoryId)
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ postingId, categoryId: body.categoryId, proposedRuleId: result.proposedRuleId })
})
