import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, transactions, postings, transferMarks } from '../schema/index.js'
import { cashFlowScopeFilter, suggestedMark, type Period } from './period.js'
import { listAccountBalances } from './accounts.js'
import {
  NOT_COUNTED_KINDS,
  TOP_MERCHANTS,
  loadScope,
  otherCurrencyTotals,
  periodWindow,
  round,
  summarizeMonth,
  type MonthSummary,
} from './cashflow.js'

const DAY_SLOTS = 31

export type CategoryTotal = { category: string; total: number }
export type MerchantTotal = { merchant: string; total: number; count: number }
export type IncomeVsExpense = { income: number; expense: number; net: number; spending: number; debtPayments: number }

/** One currency's figures; `expense` = `spending` + `debtPayments`. Excluded
 * transfers, card payments and investment moves are in neither side. */
export type CurrencyBlock = IncomeVsExpense & {
  currency: string
  categories: CategoryTotal[]
  merchants: MerchantTotal[]
}

const blockOf = (currency: string, s: MonthSummary): CurrencyBlock => ({
  currency,
  income: s.moneyIn,
  expense: s.moneyOut,
  net: round(s.moneyIn - s.moneyOut),
  spending: s.spending,
  debtPayments: s.debtPayments,
  categories: s.categories.map((c) => ({ category: c.label, total: c.amount })),
  merchants: s.merchants.map((m) => ({ merchant: m.name, total: m.amount, count: m.count })),
})

/** One block per currency the period holds, most legs first. Nothing is ever
 * added across currencies. */
export async function getCurrencyBreakdown(tenantId: string, period: Period, now = new Date()): Promise<CurrencyBlock[]> {
  const { currencies, allLegs } = await loadScope(tenantId, periodWindow(period, now), {})
  return currencies.map((currency) =>
    blockOf(currency, summarizeMonth(allLegs.filter((leg) => leg.currency === currency), DAY_SLOTS)),
  )
}

export type CategorySpend = { currency: string; category: string; total: number; matched: boolean }

/** Per currency, the biggest spending category whose name contains the query. */
export async function spendingInCategory(
  tenantId: string,
  categoryQuery: string,
  period: Period,
  now = new Date(),
): Promise<CategorySpend[]> {
  const needle = categoryQuery.toLowerCase()
  const blocks = await getCurrencyBreakdown(tenantId, period, now)
  return blocks.map((block) => {
    const hit = block.categories.find((c) => c.category.toLowerCase().includes(needle))
    return {
      currency: block.currency,
      category: hit?.category ?? categoryQuery,
      total: hit?.total ?? 0,
      matched: hit !== undefined,
    }
  })
}

export type PossibleTransfer = {
  transactionId: string
  date: string
  description: string
  accountName: string
  amount: number
  currency: string
}

/** The legs behind the summary's possible transfers, newest first. */
export async function listPossibleTransfers(tenantId: string, period: Period, currency?: string): Promise<PossibleTransfer[]> {
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
    .where(
      and(
        cashFlowScopeFilter(tenantId, period),
        suggestedMark,
        currency ? eq(postings.currency, currency) : undefined,
      ),
    )
    .orderBy(desc(transactions.date), transactions.id)
  return rows.map((r) => ({ ...r, date: r.date.toISOString(), amount: Number(r.amount) }))
}

/** The Overview screen's numbers, from the same engine and the same window as
 * the Cash flow page, so the two screens can never disagree. Every figure is
 * in `currency`; `balances` covers every account, in its own currency. */
export async function getSummary(tenantId: string, period: Period, currency?: string, now = new Date()) {
  const [scope, balances] = await Promise.all([
    loadScope(tenantId, periodWindow(period, now), { currency }),
    listAccountBalances(tenantId),
  ])
  const summary = summarizeMonth(scope.legs, DAY_SLOTS)
  const { currency: _currency, categories, merchants, ...incomeVsExpense } = blockOf(scope.currency, summary)
  return {
    period,
    currency: scope.currency,
    currencies: scope.currencies,
    incomeVsExpense,
    topCategories: categories,
    topMerchants: merchants.slice(0, TOP_MERCHANTS),
    balances,
    notCounted: NOT_COUNTED_KINDS.filter((kind) => summary.destinations[kind].count > 0).map((kind) => ({
      kind,
      count: summary.destinations[kind].count,
      total: summary.destinations[kind].total,
    })),
    otherCurrencies: otherCurrencyTotals(scope.allLegs, scope.currency),
    possibleTransfers: summary.possible,
  }
}
