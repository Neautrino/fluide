import { and, eq, gte, inArray, isNotNull, isNull, ne, notExists, or } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, connectors, transactions, transferMarks } from '../schema/index.js'
import { liveTransaction } from './live.js'
import { EXCLUDING_METHODS, SUGGESTED_MARK, type ExcludedKind } from './transfer-match.js'

export const PERIODS = ['this_week', 'this_month', 'last_30_days', 'this_year', 'all_time'] as const
export type Period = (typeof PERIODS)[number]

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

export function bankPostingsFilter(tenantId: string, period: Period) {
  const start = periodStart(period)
  const conditions = [
    eq(transactions.tenantId, tenantId),
    inArray(accounts.type, ['asset', 'liability']),
    ne(transactions.source, 'opening-balance'),
    liveTransaction,
  ]
  if (start) conditions.push(gte(transactions.date, start))
  return and(...conditions)
}

/** SQL twin of isExcludedMark, built from the same EXCLUDING_METHODS table.
 * loan_payment is not excluded: it counts in money out, as debt payments. */
export const excludedMark = or(
  ...Object.entries(EXCLUDING_METHODS).map(([kind, methods]) =>
    and(eq(transferMarks.kind, kind as ExcludedKind), inArray(transferMarks.method, [...methods])),
  ),
)

/** SQL twin of isSuggestedMark. */
export const suggestedMark = and(eq(transferMarks.kind, SUGGESTED_MARK.kind), eq(transferMarks.method, SUGGESTED_MARK.method))

/** A login the user replaced stops counting where its successor's history
 * starts: everything older still counts, so nothing is lost and nothing is
 * counted twice. Joins accounts and transactions. */
export const countedHistory = notExists(
  db
    .select({ id: connectors.id })
    .from(connectors)
    .where(
      and(
        eq(connectors.id, accounts.connectorId),
        isNotNull(connectors.countedUntil),
        gte(transactions.date, connectors.countedUntil),
      ),
    ),
)

/** Bank legs whose movements can be cash flow at all. Loan and investment
 * accounts never count: the everyday-account side of the movement does. */
export function cashFlowScopeFilter(tenantId: string, period: Period) {
  return and(
    bankPostingsFilter(tenantId, period),
    or(isNull(accounts.kind), inArray(accounts.kind, ['cash', 'credit', 'other'])),
    countedHistory,
  )
}

/** Income and money out (spending + debt payments): in scope and not an
 * excluded transfer, card payment or investment. Possible transfers count. */
export function cashFlowPostingsFilter(tenantId: string, period: Period) {
  return and(
    cashFlowScopeFilter(tenantId, period),
    notExists(
      db
        .select({ transactionId: transferMarks.transactionId })
        .from(transferMarks)
        .where(and(eq(transferMarks.transactionId, transactions.id), excludedMark)),
    ),
  )
}

/** Spending (categories, merchants): cash flow minus debt payments. */
export function spendingPostingsFilter(tenantId: string, period: Period) {
  return and(
    cashFlowScopeFilter(tenantId, period),
    notExists(
      db
        .select({ transactionId: transferMarks.transactionId })
        .from(transferMarks)
        .where(and(eq(transferMarks.transactionId, transactions.id), or(excludedMark, eq(transferMarks.kind, 'loan_payment')))),
    ),
  )
}
