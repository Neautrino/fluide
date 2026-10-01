import { Hono, type Context } from 'hono'
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
  getCashFlow,
  getCashFlowTransactions,
  parseCashFlowFilter,
  isMonth,
  monthOf,
  CASH_FLOW_COMPARES,
  PERIODS,
  type CashFlowCompare,
  type CashFlowScopeParams,
  type Period,
} from '@repo/ledger'
import { LOCAL_TENANT_ID } from '../ingest.js'
import { recategorizePosting } from '../review.js'
import { isUuid, uuidParam } from './validate.js'

export const ledgerRoutes = new Hono()

const MAX_SCOPE_ACCOUNTS = 100
const CURRENCY_RE = /^[A-Z]{3}$/
const CURRENCY_ERROR = 'currency must be an ISO 4217 code'

function cashFlowScope(c: Context): CashFlowScopeParams | string {
  const month = c.req.query('month')
  // Date.UTC maps years 0–99 to 1900–1999, so early years would come back as another month's data.
  if (month !== undefined && (!isMonth(month) || month < '1970-01' || month > monthOf(new Date()))) {
    return 'month must be YYYY-MM, from 1970-01 up to the current month'
  }
  const accounts = [...new Set(c.req.query('accounts')?.split(',').filter(Boolean))]
  if (accounts.some((id) => !isUuid(id))) return 'accounts must be comma-separated UUIDs'
  if (accounts.length > MAX_SCOPE_ACCOUNTS) return `accounts takes at most ${MAX_SCOPE_ACCOUNTS} ids`
  const currency = c.req.query('currency')
  if (currency !== undefined && !CURRENCY_RE.test(currency)) return CURRENCY_ERROR
  return { month, accounts: accounts.length ? accounts : undefined, currency }
}

function periodScope(c: Context): { period: Period; currency?: string } | string {
  const period = (c.req.query('period') ?? 'this_month') as Period
  if (!PERIODS.includes(period)) return `period must be one of ${PERIODS.join(', ')}`
  const currency = c.req.query('currency')
  if (currency !== undefined && !CURRENCY_RE.test(currency)) return CURRENCY_ERROR
  return { period, currency }
}

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
  const scope = periodScope(c)
  if (typeof scope === 'string') return c.json({ error: scope }, 400)
  return c.json(await getSummary(LOCAL_TENANT_ID, scope.period, scope.currency))
})

ledgerRoutes.get('/possible-transfers', async (c) => {
  const scope = periodScope(c)
  if (typeof scope === 'string') return c.json({ error: scope }, 400)
  return c.json({ transactions: await listPossibleTransfers(LOCAL_TENANT_ID, scope.period, scope.currency) })
})

ledgerRoutes.get('/cashflow', async (c) => {
  const scope = cashFlowScope(c)
  if (typeof scope === 'string') return c.json({ error: scope }, 400)
  const compare = (c.req.query('compare') ?? 'average') as CashFlowCompare
  if (!CASH_FLOW_COMPARES.includes(compare)) {
    return c.json({ error: `compare must be one of ${CASH_FLOW_COMPARES.join(', ')}` }, 400)
  }
  return c.json(await getCashFlow(LOCAL_TENANT_ID, { ...scope, compare }))
})

ledgerRoutes.get('/cashflow/transactions', async (c) => {
  const scope = cashFlowScope(c)
  if (typeof scope === 'string') return c.json({ error: scope }, 400)
  const filter = parseCashFlowFilter(c.req.query('filter') ?? '')
  if (!filter) return c.json({ error: 'filter must be a cash-flow filter token' }, 400)
  return c.json(await getCashFlowTransactions(LOCAL_TENANT_ID, scope, filter))
})

ledgerRoutes.post('/transfers/:transactionId/decision', uuidParam('transactionId'), async (c) => {
  // c.req.json() parses any body; requiring JSON keeps a cross-site "simple" (text/plain) POST from changing marks.
  if (c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return c.json({ error: 'Content-Type must be application/json' }, 415)
  }
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
  return c.json({ postingId, categoryId: body.categoryId, ruleId: result.ruleId, alsoFiled: result.alsoFiled })
})
