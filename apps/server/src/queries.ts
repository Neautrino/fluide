/** SOURCE OF TRUTH: read-only ledger aggregates for the chat agent's tools.
 * WHAT: deterministic Drizzle aggregates -- no AI involved anywhere here.
 * WHY: the chat model only ever picks which function to call and narrates
 * the result; it never computes a number itself (Tier 1, no gate needed).
 * WHERE: owns aggregation only. Filters to accounts.type = 'asset' to
 * exclude the equity suspense leg every transaction also has.
 */
import { db, accounts, transactions, postings, categories } from '@repo/ledger'
import { and, eq, gte, sql } from 'drizzle-orm'

export type Period = 'this_week' | 'this_month' | 'last_30_days' | 'this_year' | 'all_time'

function periodStart(period: Period): Date | undefined {
  const now = new Date()
  switch (period) {
    case 'this_week': {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay())
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'last_30_days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1)
    case 'all_time':
      return undefined
  }
}

function bankPostingsFilter(tenantId: string, period: Period) {
  const start = periodStart(period)
  const conditions = [eq(transactions.tenantId, tenantId), eq(accounts.type, 'asset' as const)]
  if (start) conditions.push(gte(transactions.date, start))
  return and(...conditions)
}

export type CategoryTotal = { category: string; total: number }

/** Amounts are negative-for-spent (see connectors/types.ts) -- "biggest
 * expense" is the most negative sum, so this orders ascending and reports
 * abs(total) so callers get a plain positive number. */
export async function topExpenseCategories(
  tenantId: string,
  period: Period,
  limit = 5,
): Promise<CategoryTotal[]> {
  const rows = await db
    .select({
      category: sql<string>`coalesce(${categories.label}, 'Uncategorized')`,
      total: sql<string>`sum(${postings.amount})`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .where(and(bankPostingsFilter(tenantId, period), sql`${postings.amount} < 0`))
    .groupBy(sql`coalesce(${categories.label}, 'Uncategorized')`)
    .orderBy(sql`sum(${postings.amount}) asc`)
    .limit(limit)

  return rows.map((r) => ({ category: r.category, total: Math.abs(Number(r.total)) }))
}

export async function spendingInCategory(
  tenantId: string,
  categoryQuery: string,
  period: Period,
): Promise<{ category: string; total: number; matched: boolean }> {
  const [row] = await db
    .select({
      category: categories.label,
      total: sql<string>`sum(${postings.amount})`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .innerJoin(categories, eq(categories.id, postings.categoryId))
    .where(
      and(bankPostingsFilter(tenantId, period), sql`${categories.label} ILIKE '%' || ${categoryQuery} || '%'`),
    )
    .groupBy(categories.label)
    .limit(1)

  if (!row) return { category: categoryQuery, total: 0, matched: false }
  return { category: row.category, total: Math.abs(Number(row.total)), matched: true }
}

export async function incomeVsExpense(
  tenantId: string,
  period: Period,
): Promise<{ income: number; expense: number; net: number }> {
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${postings.amount} > 0 then ${postings.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${postings.amount} < 0 then ${postings.amount} else 0 end), 0)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(bankPostingsFilter(tenantId, period))

  const income = Number(row?.income ?? 0)
  const expense = Math.abs(Number(row?.expense ?? 0))
  return { income, expense, net: income - expense }
}

export type MerchantTotal = { merchant: string; total: number; count: number }

export async function topMerchants(
  tenantId: string,
  period: Period,
  limit = 5,
): Promise<MerchantTotal[]> {
  const rows = await db
    .select({
      merchant: sql<string>`coalesce(${postings.counterpartyRaw}, 'Unknown')`,
      total: sql<string>`sum(${postings.amount})`,
      count: sql<string>`count(*)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(and(bankPostingsFilter(tenantId, period), sql`${postings.amount} < 0`))
    .groupBy(sql`coalesce(${postings.counterpartyRaw}, 'Unknown')`)
    .orderBy(sql`sum(${postings.amount}) asc`)
    .limit(limit)

  return rows.map((r) => ({
    merchant: r.merchant,
    total: Math.abs(Number(r.total)),
    count: Number(r.count),
  }))
}

export type AccountBalance = { name: string; currency: string; balance: number }

export async function listAccountBalances(tenantId: string): Promise<AccountBalance[]> {
  const rows = await db
    .select({
      name: accounts.name,
      currency: accounts.currency,
      balance: sql<string>`coalesce(sum(${postings.amount}), 0)`,
    })
    .from(accounts)
    .leftJoin(postings, eq(postings.accountId, accounts.id))
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.type, 'asset' as const)))
    .groupBy(accounts.id, accounts.name, accounts.currency)

  return rows.map((r) => ({ name: r.name, currency: r.currency, balance: Number(r.balance) }))
}

export type TransactionRow = {
  date: string
  description: string
  merchant: string
  amount: number
  category: string
}

/** Raw, filterable transaction listing -- the one gap found comparing our
 * tool surface against BankMCP's get_transactions / Ghostfolio's
 * get_orders: those return a raw list for the calling model to reason
 * over; our other tools are all pre-aggregated. Reuses the same
 * join/shape as index.ts's GET /transactions route, narrowed to one
 * account-type filter and an optional merchant/period filter, capped at
 * 50 rows so a broad match doesn't dump the whole ledger into context. */
export async function listRecentTransactions(
  tenantId: string,
  period: Period,
  merchantQuery?: string,
  limit = 20,
): Promise<TransactionRow[]> {
  const conditions = [bankPostingsFilter(tenantId, period)]
  if (merchantQuery) {
    conditions.push(sql`${postings.counterpartyRaw} ILIKE '%' || ${merchantQuery} || '%'`)
  }

  const rows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      merchant: sql<string>`coalesce(${postings.counterpartyRaw}, 'Unknown')`,
      amount: postings.amount,
      category: sql<string>`coalesce(${categories.label}, 'Uncategorized')`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .where(and(...conditions))
    .orderBy(sql`${transactions.date} desc`)
    .limit(Math.min(limit, 50))

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    description: r.description,
    merchant: r.merchant,
    amount: Number(r.amount),
    category: r.category,
  }))
}
