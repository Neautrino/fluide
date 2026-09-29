import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, transactions, postings, categories, transferMarks } from '../schema/index.js'
import { cashFlowPostingsFilter, cashFlowScopeFilter, excludedMark, spendingPostingsFilter, suggestedMark, type Period } from './period.js'
import type { ExcludedKind } from './transfer-match.js'
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
    .where(and(spendingPostingsFilter(tenantId, period), sql`${postings.amount} < 0`))
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
      and(spendingPostingsFilter(tenantId, period), sql`${categories.label} ILIKE '%' || ${categoryQuery} || '%'`),
    )
    .groupBy(categories.label)
    .limit(1)

  if (!row) return { category: categoryQuery, total: 0, matched: false }
  return { category: row.category, total: Math.abs(Number(row.total)), matched: true }
}

export type IncomeVsExpense = { income: number; expense: number; net: number; spending: number; debtPayments: number }

/** expense = spending + debtPayments. Excluded transfers, card payments and
 * investment moves are in neither side (see cashFlowPostingsFilter). */
export async function incomeVsExpense(tenantId: string, period: Period): Promise<IncomeVsExpense> {
  const notDebtPayment = sql`${transferMarks.kind} IS DISTINCT FROM 'loan_payment'`
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${postings.amount} > 0 and ${notDebtPayment} then ${postings.amount} else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${postings.amount} < 0 and ${notDebtPayment} then ${postings.amount} else 0 end), 0)`,
      debtPayments: sql<string>`coalesce(sum(case when ${postings.amount} < 0 and ${transferMarks.kind} = 'loan_payment' then ${postings.amount} else 0 end), 0)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(cashFlowPostingsFilter(tenantId, period))

  const income = Number(row?.income ?? 0)
  const spending = Math.abs(Number(row?.spending ?? 0))
  const debtPayments = Math.abs(Number(row?.debtPayments ?? 0))
  const expense = spending + debtPayments
  return { income, expense, net: income - expense, spending, debtPayments }
}

export type NotCounted = { kind: ExcludedKind; count: number; total: number }

/** What the cash-flow numbers left out, per kind. A matched pair is one
 * movement; its total is the amount moved, counted once. */
export async function notCountedMovements(tenantId: string, period: Period): Promise<NotCounted[]> {
  const movement = sql`case when ${transferMarks.pairTransactionId} is null then ${transferMarks.transactionId}
    else least(${transferMarks.transactionId}, ${transferMarks.pairTransactionId}) end`
  const movements = db
    .select({ kind: transferMarks.kind, amount: sql<string>`max(abs(${postings.amount}))`.as('amount') })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .innerJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(and(cashFlowScopeFilter(tenantId, period), excludedMark))
    .groupBy(transferMarks.kind, movement)
    .as('movements')
  const rows = await db
    .select({ kind: movements.kind, count: sql<string>`count(*)`, total: sql<string>`sum(${movements.amount})` })
    .from(movements)
    .groupBy(movements.kind)

  // excludedMark only matches ExcludedKind kinds, so the narrowing holds.
  return rows.map((r) => ({ kind: r.kind as NotCounted['kind'], count: Number(r.count), total: Number(r.total) }))
}

export type PossibleTransfers = { count: number; total: number }

/** Provider-tagged transfers nobody has confirmed: counted in cash flow and
 * listed for review. `total` sums the legs' absolute amounts. */
export async function possibleTransfersTotal(tenantId: string, period: Period): Promise<PossibleTransfers> {
  const [row] = await db
    .select({ count: sql<string>`count(*)`, total: sql<string>`coalesce(sum(abs(${postings.amount})), 0)` })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .innerJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(and(cashFlowScopeFilter(tenantId, period), suggestedMark))
  return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) }
}

export type PossibleTransfer = {
  transactionId: string
  date: string
  description: string
  accountName: string
  amount: number
  currency: string
}

/** The legs behind possibleTransfersTotal, newest first. */
export async function listPossibleTransfers(tenantId: string, period: Period): Promise<PossibleTransfer[]> {
  const rows = await db
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      description: transactions.description,
      accountName: accounts.name,
      amount: postings.amount,
      currency: postings.currency,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .innerJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(and(cashFlowScopeFilter(tenantId, period), suggestedMark))
    .orderBy(desc(transactions.date), transactions.id)
  return rows.map((r) => ({ ...r, date: r.date.toISOString(), amount: Number(r.amount) }))
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
    .where(and(spendingPostingsFilter(tenantId, period), sql`${postings.amount} < 0`))
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
  const [incomeExpense, topCategories, merchants, balances, notCounted, possibleTransfers] = await Promise.all([
    incomeVsExpense(tenantId, period),
    topExpenseCategories(tenantId, period),
    topMerchants(tenantId, period),
    listAccountBalances(tenantId),
    notCountedMovements(tenantId, period),
    possibleTransfersTotal(tenantId, period),
  ])
  return { period, incomeVsExpense: incomeExpense, topCategories, topMerchants: merchants, balances, notCounted, possibleTransfers }
}
