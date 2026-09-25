import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, transactions, postings, categories } from '../schema/index.js'
import { bankPostingsFilter, type Period } from './period.js'
import { listAccountBalances } from './accounts.js'

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

/** The Overview screen's numbers -- the same aggregates the chat tools
 * call, so the dashboard and the assistant can never disagree. */
export async function getSummary(tenantId: string, period: Period) {
  const [incomeExpense, topCategories, merchants, balances] = await Promise.all([
    incomeVsExpense(tenantId, period),
    topExpenseCategories(tenantId, period),
    topMerchants(tenantId, period),
    listAccountBalances(tenantId),
  ])
  return { period, incomeVsExpense: incomeExpense, topCategories, topMerchants: merchants, balances }
}
