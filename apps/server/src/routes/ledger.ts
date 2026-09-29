import { Hono } from 'hono'
import {
  listAccounts,
  listAccountBalances,
  listTransactionsWithPostings,
  listCategories,
  listAuditLogForPosting,
  getSummary,
  listPossibleTransfers,
  decideTransfer,
  TransferDecisionNotFoundError,
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

ledgerRoutes.get('/account-balances', async (c) => {
  return c.json({ accounts: await listAccountBalances(LOCAL_TENANT_ID) })
})

ledgerRoutes.get('/transactions', async (c) => {
  const accountId = c.req.query('accountId')
  if (accountId !== undefined && !isUuid(accountId)) return c.json({ error: 'accountId must be a UUID' }, 400)
  return c.json({ transactions: await listTransactionsWithPostings(LOCAL_TENANT_ID, accountId) })
})

ledgerRoutes.get('/summary', async (c) => {
  const period = (c.req.query('period') ?? 'this_month') as Period
  if (!PERIODS.includes(period)) {
    return c.json({ error: `period must be one of ${PERIODS.join(', ')}` }, 400)
  }
  return c.json(await getSummary(LOCAL_TENANT_ID, period))
})

ledgerRoutes.get('/possible-transfers', async (c) => {
  const period = (c.req.query('period') ?? 'this_month') as Period
  if (!PERIODS.includes(period)) {
    return c.json({ error: `period must be one of ${PERIODS.join(', ')}` }, 400)
  }
  return c.json({ transactions: await listPossibleTransfers(LOCAL_TENANT_ID, period) })
})

ledgerRoutes.post('/transfers/:transactionId/decision', uuidParam('transactionId'), async (c) => {
  const transactionId = c.req.param('transactionId')
  const body = await c.req.json<{ decision?: unknown }>().catch(() => ({}) as { decision?: unknown })
  if (body?.decision !== 'mine' && body?.decision !== 'payment') {
    return c.json({ error: "decision must be 'mine' or 'payment'" }, 400)
  }
  try {
    await decideTransfer(LOCAL_TENANT_ID, transactionId, body.decision)
  } catch (err) {
    if (err instanceof TransferDecisionNotFoundError) return c.json({ error: 'transaction not found' }, 404)
    throw err
  }
  return c.json({ ok: true })
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
