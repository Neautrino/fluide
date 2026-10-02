import { and, eq, gte, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../db.js'
import {
  accounts,
  categories,
  connectors,
  postings,
  transactions,
  transferMarks,
  type AccountKind,
  type TransferKind,
  type TransferMarkMethod,
} from '../schema/index.js'
import { cashFlowScopeFilter, excludedMark, type Period } from './period.js'
import { isExcludedMark, isSuggestedMark } from './transfer-match.js'

export const CASH_FLOW_COMPARES = ['average', 'previous', 'last_year'] as const
export type CashFlowCompare = (typeof CASH_FLOW_COMPARES)[number]

export const NOT_COUNTED_KINDS = ['between_accounts', 'card_payoffs', 'invested', 'savings'] as const
export type NotCountedKind = (typeof NOT_COUNTED_KINDS)[number]
export type CashFlowTransferKind = NotCountedKind | 'debt_payments'

export type CashFlowScopeParams = { month?: string; accounts?: string[]; currency?: string; now?: Date }
export type CashFlowParams = CashFlowScopeParams & { compare?: CashFlowCompare }

type Money = number
export type CashFlowDelta = { baseline: Money | null; change: number | null }

export type DrillRow = {
  transactionId: string
  date: string
  description: string
  accountName: string
  amount: number
  currency: string
  category: string
  fromBank: boolean
  pending: boolean
}

export type CashFlowSankeySource = {
  id: string
  label: string
  amount: Money
  kind: 'payer' | 'refunds' | 'other_income' | 'from_balance'
}

export type CashFlowSankeyTarget = {
  id: string
  label: string
  amount: Money
  group: 'spending' | 'debt' | 'kept'
  kind: 'category' | 'other_categories' | 'debt_payments' | 'invested' | 'savings' | 'stayed_in_cash'
  fromBank?: boolean
  otherCount?: number
}

export type CashFlowSankey = { sources: CashFlowSankeySource[]; targets: CashFlowSankeyTarget[]; moneyIn: Money }

export type CashFlow = {
  month: string
  currency: string
  currencies: string[]
  partial: boolean
  daysElapsed: number
  daysInMonth: number
  compare: CashFlowCompare
  baselineMonths: number
  accounts: { id: string; name: string; kind: string | null; mask: string | null; connectorId: string | null }[]
  totals: {
    moneyIn: Money
    moneyOut: Money
    spending: Money
    debtPayments: Money
    kept: number
    savingsRate: number | null
    invested: Money
    movedToSavings: Money
    vs: { moneyIn: CashFlowDelta; moneyOut: CashFlowDelta; kept: CashFlowDelta; savingsRate: CashFlowDelta }
  }
  notCounted: { kind: NotCountedKind; count: number; total: Money }[]
  otherCurrencies: { currency: string; count: number; moneyIn: Money; moneyOut: Money }[]
  possibleTransfers: { count: number; total: Money }
  sankey: CashFlowSankey
  transfers: { kind: CashFlowTransferKind; total: Money; count: number; accounts: string[] }[]
  months: { month: string; moneyIn: Money; moneyOut: Money; net: number; partial: boolean }[]
  averages: { moneyIn: Money | null; moneyOut: Money | null }
  pace: { day: number; current: Money | null; baseline: Money | null }[]
  categories: {
    label: string
    amount: Money
    shareOfSpending: number
    shareOfIncome: number | null
    baseline: Money | null
    change: number | null
    fromBank: boolean
  }[]
  merchants: { name: string; amount: Money; count: number; average: Money; isNew: boolean }[]
  sources: { name: string; amount: Money; share: number; regularity: 'monthly' | 'irregular' | null; kind: 'payer' | 'refunds' }[]
  largest: DrillRow[]
}

export type CashFlowFilter =
  | { kind: 'in' | 'out' | 'spending' | 'debt' | 'refunds' | 'other_income' | 'other_categories' | 'possible' | 'largest' }
  | { kind: 'category' | 'merchant' | 'source'; value: string }
  | { kind: 'notcounted'; value: NotCountedKind }
  | { kind: 'day'; value: number }

export type CashFlowTransactions = { rows: DrillRow[]; total: Money; count: number }

const TOP_PAYERS = 5
const TOP_CATEGORIES = 7
export const TOP_MERCHANTS = 8
const LARGEST = 5
const BASELINE_SPAN = 12
const REGULAR_SPAN = 3
/** A top merchant is "new" when nothing went out to its name in this many months before the selected one. */
const NEW_MERCHANT_SPAN = 24
const SAVINGS_SUBTYPES = new Set(['savings', 'cd', 'money market', 'hsa'])

export const round = (value: number) => Math.round(value * 1e6) / 1e6

// ---- months (UTC calendar months, 'YYYY-MM') ----

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export const isMonth = (value: string) => MONTH_RE.test(value)

export const monthOf = (date: Date) => date.toISOString().slice(0, 7)

export function monthStart(month: string): Date {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, mon - 1, 1))
}

export const addMonths = (month: string, n: number) => {
  const start = monthStart(month)
  return monthOf(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1)))
}

export const daysInMonth = (month: string) => {
  const start = monthStart(month)
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
}

export type MonthWindow = {
  month: string
  start: Date
  end: Date
  partial: boolean
  daysElapsed: number
  daysInMonth: number
}

/** The current month is partial through today's UTC day; any other month is whole. */
export function monthWindow(month: string, now: Date): MonthWindow {
  const days = daysInMonth(month)
  const partial = month === monthOf(now)
  return {
    month,
    start: monthStart(month),
    end: monthStart(addMonths(month, 1)),
    partial,
    daysElapsed: partial ? now.getUTCDate() : days,
    daysInMonth: days,
  }
}

export type ScopeWindow = { start: Date | null; end: Date | null }

/** UTC bounds of a summary period. `this_month` is the cash-flow month window
 * itself, so the two screens can never disagree about where the month starts. */
export function periodWindow(period: Period, now: Date): ScopeWindow {
  const [year, month, day] = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()]
  switch (period) {
    case 'this_week':
      return {
        start: new Date(Date.UTC(year, month, day - now.getUTCDay())),
        end: new Date(Date.UTC(year, month, day - now.getUTCDay() + 7)),
      }
    case 'this_month':
      return monthWindow(monthOf(now), now)
    case 'last_month':
      return monthWindow(addMonths(monthOf(now), -1), now)
    case 'last_30_days':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: null }
    case 'this_year':
      return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) }
    case 'last_year':
      return { start: new Date(Date.UTC(year - 1, 0, 1)), end: new Date(Date.UTC(year, 0, 1)) }
    case 'all_time':
      return { start: null, end: null }
  }
}

/** Months a compare mode may draw on, before filtering to months with activity. */
export function baselineCandidates(month: string, compare: CashFlowCompare): string[] {
  switch (compare) {
    case 'average':
      return Array.from({ length: BASELINE_SPAN }, (_, i) => addMonths(month, -(i + 1)))
    case 'previous':
      return [addMonths(month, -1)]
    case 'last_year':
      return [addMonths(month, -12)]
  }
}

export function delta(value: number | null, baseline: number | null): CashFlowDelta {
  if (baseline === null) return { baseline, change: null }
  const base = round(baseline)
  return { baseline: base, change: value === null || base === 0 ? null : (value - base) / Math.abs(base) }
}

// ---- one bank leg, classified ----

export type CashFlowLeg = {
  postingId: string
  transactionId: string
  date: Date
  description: string
  pending: boolean
  accountId: string
  accountName: string
  accountKind: AccountKind | null
  amount: number
  currency: string
  name: string
  category: string
  fromBank: boolean
  markKind: TransferKind | null
  markMethod: TransferMarkMethod | null
  pairTransactionId: string | null
  partner: { accountName: string; accountKind: AccountKind | null; accountSubtype: string | null } | null
}

export function humanizeProviderCategory(primary: string): string {
  const words = primary.toLowerCase().replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A Fluide category wins; else the bank's Plaid PFC primary tag, marked fromBank. */
export function legCategory(label: string | null, tags: readonly string[] | null): { category: string; fromBank: boolean } {
  if (label) return { category: label, fromBank: false }
  const primary = tags?.find((tag) => tag.startsWith('plaid:'))?.slice('plaid:'.length)
  if (primary) return { category: humanizeProviderCategory(primary), fromBank: true }
  return { category: 'Uncategorized', fromBank: false }
}

const isCounted = (leg: CashFlowLeg) => !(leg.markKind && leg.markMethod && isExcludedMark(leg.markKind, leg.markMethod))
/** Mirrors incomeVsExpense: a loan_payment-marked leg is never money in. */
const isMoneyIn = (leg: CashFlowLeg) => isCounted(leg) && leg.amount > 0 && leg.markKind !== 'loan_payment'
const isMoneyOut = (leg: CashFlowLeg) => isCounted(leg) && leg.amount < 0
const isDebt = (leg: CashFlowLeg) => isMoneyOut(leg) && leg.markKind === 'loan_payment'
const isSpending = (leg: CashFlowLeg) => isMoneyOut(leg) && leg.markKind !== 'loan_payment'
const isRefund = (leg: CashFlowLeg) => isMoneyIn(leg) && leg.accountKind === 'credit'
const isPayerIn = (leg: CashFlowLeg) => isMoneyIn(leg) && leg.accountKind !== 'credit'
const isPossible = (leg: CashFlowLeg) => !!leg.markKind && !!leg.markMethod && isSuggestedMark(leg.markKind, leg.markMethod)

/** Where an excluded movement went, or null when the leg is counted or is not
 * the movement's representative. The outflow represents a movement; an
 * inflow does only when its pair partner is not among `scoped` (the other
 * side is outside the month, the account filter or cash-flow scope). An
 * inflow's source is not a destination, so it is card_payoffs or
 * between_accounts. */
export function destinationOf(leg: CashFlowLeg, scoped: ReadonlySet<string>): NotCountedKind | null {
  if (isCounted(leg) || leg.amount === 0) return null
  if (leg.amount > 0) {
    if (leg.pairTransactionId && scoped.has(leg.pairTransactionId)) return null
    return leg.markKind === 'card_payment' ? 'card_payoffs' : 'between_accounts'
  }
  if (leg.markKind === 'investment' || leg.partner?.accountKind === 'investment') return 'invested'
  if (leg.partner?.accountKind === 'cash' && SAVINGS_SUBTYPES.has((leg.partner.accountSubtype ?? '').toLowerCase())) return 'savings'
  if (leg.markKind === 'card_payment') return 'card_payoffs'
  return 'between_accounts'
}

// ---- the selected month, aggregated in one pass ----

type Ranked = { name: string; amount: number }
type Bucket = { total: number; count: number; accounts: Set<string> }

export type MonthSummary = {
  moneyIn: number
  moneyOut: number
  spending: number
  debtPayments: number
  refunds: number
  payers: Ranked[]
  categories: { label: string; amount: number; fromBank: boolean }[]
  merchants: { name: string; amount: number; count: number }[]
  destinations: Record<CashFlowTransferKind, { total: number; count: number; accounts: string[] }>
  possible: { count: number; total: number }
  dailyOut: number[]
  largest: CashFlowLeg[]
  scoped: ReadonlySet<string>
}

const byAmountThenName = (a: Ranked, b: Ranked) => b.amount - a.amount || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value)

const ranked = (map: Map<string, number>): Ranked[] =>
  [...map].map(([name, amount]) => ({ name, amount: round(amount) })).sort(byAmountThenName)

const newestFirst = (a: CashFlowLeg, b: CashFlowLeg) =>
  b.date.getTime() - a.date.getTime() || Math.abs(b.amount) - Math.abs(a.amount) || (a.postingId < b.postingId ? -1 : 1)

const largestFirst = (a: CashFlowLeg, b: CashFlowLeg) =>
  Math.abs(b.amount) - Math.abs(a.amount) || b.date.getTime() - a.date.getTime() || (a.postingId < b.postingId ? -1 : 1)

/** `legs` are one currency's in-scope legs of one month. */
export function summarizeMonth(legs: CashFlowLeg[], days: number): MonthSummary {
  const scoped = new Set(legs.map((leg) => leg.transactionId))
  let moneyIn = 0
  let moneyOut = 0
  let spending = 0
  let debtPayments = 0
  let refunds = 0
  const payers = new Map<string, number>()
  const categoryTotals = new Map<string, number>()
  const categoryFromBank = new Map<string, boolean>()
  const merchantTotals = new Map<string, number>()
  const merchantCounts = new Map<string, number>()
  const buckets = new Map<CashFlowTransferKind, Bucket>()
  const bucket = (kind: CashFlowTransferKind) => {
    let found = buckets.get(kind)
    if (!found) buckets.set(kind, (found = { total: 0, count: 0, accounts: new Set() }))
    return found
  }
  const possible = { count: 0, total: 0 }
  const dailyOut = Array.from({ length: days }, () => 0)

  for (const leg of legs) {
    const magnitude = Math.abs(leg.amount)
    if (isPossible(leg)) {
      possible.count++
      possible.total += magnitude
    }
    if (isMoneyIn(leg)) {
      moneyIn += leg.amount
      if (isRefund(leg)) refunds += leg.amount
      else add(payers, leg.name, leg.amount)
    }
    if (isMoneyOut(leg)) {
      moneyOut += magnitude
      dailyOut[leg.date.getUTCDate() - 1]! += magnitude
    }
    if (isSpending(leg)) {
      spending += magnitude
      add(categoryTotals, leg.category, magnitude)
      categoryFromBank.set(leg.category, (categoryFromBank.get(leg.category) ?? true) && leg.fromBank)
      add(merchantTotals, leg.name, magnitude)
      add(merchantCounts, leg.name, 1)
    }
    const kind = isDebt(leg) ? 'debt_payments' : destinationOf(leg, scoped)
    if (kind) {
      if (kind === 'debt_payments') debtPayments += magnitude
      const b = bucket(kind)
      b.total += magnitude
      b.count++
      b.accounts.add(leg.accountName)
      if (leg.partner) b.accounts.add(leg.partner.accountName)
    }
  }

  const destinations = {} as MonthSummary['destinations']
  for (const kind of [...NOT_COUNTED_KINDS, 'debt_payments'] as const) {
    const b = buckets.get(kind)
    destinations[kind] = { total: round(b?.total ?? 0), count: b?.count ?? 0, accounts: [...(b?.accounts ?? [])].sort() }
  }

  return {
    moneyIn: round(moneyIn),
    moneyOut: round(moneyOut),
    spending: round(spending),
    debtPayments: round(debtPayments),
    refunds: round(refunds),
    payers: ranked(payers),
    categories: ranked(categoryTotals).map((c) => ({ label: c.name, amount: c.amount, fromBank: categoryFromBank.get(c.name) ?? false })),
    merchants: ranked(merchantTotals).map((m) => ({ ...m, count: merchantCounts.get(m.name) ?? 0 })),
    destinations,
    possible: { count: possible.count, total: round(possible.total) },
    dailyOut: dailyOut.map(round),
    largest: legs.filter(isMoneyOut).sort(largestFirst).slice(0, LARGEST),
    scoped,
  }
}

/** What the currencies the scope holds besides `currency` moved, for the line
 * that says they are not in the totals. Counted legs only. */
export function otherCurrencyTotals(
  allLegs: CashFlowLeg[],
  currency: string,
): { currency: string; count: number; moneyIn: number; moneyOut: number }[] {
  const byCurrency = new Map<string, { count: number; moneyIn: number; moneyOut: number }>()
  for (const leg of allLegs) {
    if (leg.currency === currency || !(isMoneyIn(leg) || isMoneyOut(leg))) continue
    const c = byCurrency.get(leg.currency) ?? { count: 0, moneyIn: 0, moneyOut: 0 }
    c.count++
    if (isMoneyIn(leg)) c.moneyIn += leg.amount
    else c.moneyOut += Math.abs(leg.amount)
    byCurrency.set(leg.currency, c)
  }
  return [...byCurrency]
    .map(([code, c]) => ({ currency: code, count: c.count, moneyIn: round(c.moneyIn), moneyOut: round(c.moneyOut) }))
    .sort((a, b) => b.count - a.count || (a.currency < b.currency ? -1 : 1))
}

/** Top payers + Other income + Refunds on the left; top categories + Other,
 * debt, invested, savings on the right. A deficit adds From your balances on
 * the left, a surplus Stayed in cash on the right, so both sides sum to
 * `moneyIn` (the trunk). Node ids are the drill-down filter tokens. */
export function buildSankey(summary: MonthSummary): CashFlowSankey {
  const sources: CashFlowSankeySource[] = summary.payers
    .slice(0, TOP_PAYERS)
    .map((p) => ({ id: `source:${p.name}`, label: p.name, amount: p.amount, kind: 'payer' as const }))
  const otherIncome = summary.payers.slice(TOP_PAYERS)
  if (otherIncome.length) {
    sources.push({ id: 'other_income', label: 'Other income', amount: round(otherIncome.reduce((s, p) => s + p.amount, 0)), kind: 'other_income' })
  }
  if (summary.refunds > 0) sources.push({ id: 'refunds', label: 'Refunds', amount: summary.refunds, kind: 'refunds' })

  const targets: CashFlowSankeyTarget[] = summary.categories.slice(0, TOP_CATEGORIES).map((c) => ({
    id: `category:${c.label}`,
    label: c.label,
    amount: c.amount,
    group: 'spending' as const,
    kind: 'category' as const,
    fromBank: c.fromBank,
  }))
  const otherCategories = summary.categories.slice(TOP_CATEGORIES)
  if (otherCategories.length) {
    targets.push({
      id: 'other_categories',
      label: 'Other',
      amount: round(otherCategories.reduce((s, c) => s + c.amount, 0)),
      group: 'spending',
      kind: 'other_categories',
      otherCount: otherCategories.length,
    })
  }
  const { debt_payments: debt, invested, savings } = summary.destinations
  if (debt.total > 0) targets.push({ id: 'debt', label: 'Debt payments', amount: debt.total, group: 'debt', kind: 'debt_payments' })
  if (invested.total > 0) targets.push({ id: 'notcounted:invested', label: 'Invested', amount: invested.total, group: 'kept', kind: 'invested' })
  if (savings.total > 0) targets.push({ id: 'notcounted:savings', label: 'Moved to savings', amount: savings.total, group: 'kept', kind: 'savings' })

  const outflows = round(summary.spending + debt.total + invested.total + savings.total)
  const trunk = Math.max(summary.moneyIn, outflows)
  const fromBalance = round(trunk - summary.moneyIn)
  const stayed = round(trunk - outflows)
  if (fromBalance > 0) sources.push({ id: 'from_balance', label: 'From your balances', amount: fromBalance, kind: 'from_balance' })
  if (stayed > 0) targets.push({ id: 'stayed_in_cash', label: 'Stayed in cash', amount: stayed, group: 'kept', kind: 'stayed_in_cash' })
  return { sources, targets, moneyIn: round(trunk) }
}

export function parseCashFlowFilter(token: string): CashFlowFilter | null {
  switch (token) {
    case 'in':
    case 'out':
    case 'spending':
    case 'debt':
    case 'refunds':
    case 'other_income':
    case 'other_categories':
    case 'possible':
    case 'largest':
      return { kind: token }
  }
  const colon = token.indexOf(':')
  if (colon <= 0) return null
  const prefix = token.slice(0, colon)
  const value = token.slice(colon + 1)
  if (!value) return null
  switch (prefix) {
    case 'category':
    case 'merchant':
    case 'source':
      return { kind: prefix, value }
    case 'notcounted':
      return (NOT_COUNTED_KINDS as readonly string[]).includes(value) ? { kind: 'notcounted', value: value as NotCountedKind } : null
    case 'day': {
      const day = Number(value)
      return /^\d{1,2}$/.test(value) && day >= 1 && day <= 31 ? { kind: 'day', value: day } : null
    }
  }
  return null
}

/** The legs behind one on-page figure; their magnitudes sum to that figure. */
export function selectLegs(legs: CashFlowLeg[], summary: MonthSummary, filter: CashFlowFilter): CashFlowLeg[] {
  switch (filter.kind) {
    case 'in':
      return legs.filter(isMoneyIn)
    case 'out':
      return legs.filter(isMoneyOut)
    case 'spending':
      return legs.filter(isSpending)
    case 'debt':
      return legs.filter(isDebt)
    case 'refunds':
      return legs.filter(isRefund)
    case 'possible':
      return legs.filter(isPossible)
    case 'largest':
      return summary.largest
    case 'category':
      return legs.filter((leg) => isSpending(leg) && leg.category === filter.value)
    case 'merchant':
      return legs.filter((leg) => isSpending(leg) && leg.name === filter.value)
    case 'source':
      return legs.filter((leg) => isPayerIn(leg) && leg.name === filter.value)
    case 'other_income': {
      const top = new Set(summary.payers.slice(0, TOP_PAYERS).map((p) => p.name))
      return legs.filter((leg) => isPayerIn(leg) && !top.has(leg.name))
    }
    case 'other_categories': {
      const top = new Set(summary.categories.slice(0, TOP_CATEGORIES).map((c) => c.label))
      return legs.filter((leg) => isSpending(leg) && !top.has(leg.category))
    }
    case 'notcounted':
      return legs.filter((leg) => destinationOf(leg, summary.scoped) === filter.value)
    case 'day':
      return legs.filter((leg) => isMoneyOut(leg) && leg.date.getUTCDate() === filter.value)
  }
}

const drillRow = (leg: CashFlowLeg): DrillRow => ({
  transactionId: leg.transactionId,
  date: leg.date.toISOString(),
  description: leg.description,
  accountName: leg.accountName,
  amount: leg.amount,
  currency: leg.currency,
  category: leg.category,
  fromBank: leg.fromBank,
  pending: leg.pending,
})

// ---- SQL ----

const inScopeAccount = and(
  inArray(accounts.type, ['asset', 'liability']),
  or(isNull(accounts.kind), inArray(accounts.kind, ['cash', 'credit', 'other'])),
)
const counted = sql`(not coalesce(${excludedMark ?? sql`false`}, false))`
const notLoanPayment = sql`(${transferMarks.kind} is distinct from 'loan_payment')`
const moneyInSql = sql`(${postings.amount} > 0 and ${counted} and ${notLoanPayment})`
const moneyOutSql = sql`(${postings.amount} < 0 and ${counted})`
const spendingSql = sql`(${moneyOutSql} and ${notLoanPayment})`
const monthSql = sql<string>`to_char(${transactions.date} at time zone 'UTC', 'YYYY-MM')`
const daySql = sql<number>`extract(day from ${transactions.date} at time zone 'UTC')::int`
const nameSql = sql<string>`coalesce(nullif(${postings.counterpartyRaw}, ''), ${transactions.description})`

function scopeFilter(tenantId: string, from: Date | null, to: Date | null, accountIds?: string[], currency?: string): SQL {
  return and(
    cashFlowScopeFilter(tenantId),
    eq(accounts.tenantId, tenantId),
    from ? gte(transactions.date, from) : undefined,
    to ? lt(transactions.date, to) : undefined,
    accountIds?.length ? inArray(accounts.id, accountIds) : undefined,
    currency ? eq(postings.currency, currency) : undefined,
  )!
}

type ScopeAccount = CashFlow['accounts'][number] & { currency: string }

async function listScopeAccounts(tenantId: string): Promise<ScopeAccount[]> {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      mask: accounts.mask,
      connectorId: accounts.connectorId,
      currency: accounts.currency,
    })
    .from(accounts)
    .leftJoin(connectors, eq(connectors.id, accounts.connectorId))
    .where(and(eq(accounts.tenantId, tenantId), inScopeAccount, isNull(connectors.replacedByConnectorId)))
    .orderBy(accounts.name, accounts.id)
}

async function fetchLegs(tenantId: string, window: ScopeWindow, accountIds?: string[]): Promise<CashFlowLeg[]> {
  const rows = await db
    .select({
      postingId: postings.id,
      transactionId: transactions.id,
      date: transactions.date,
      description: transactions.description,
      status: transactions.status,
      accountId: accounts.id,
      accountName: accounts.name,
      accountKind: accounts.kind,
      amount: postings.amount,
      currency: postings.currency,
      counterparty: postings.counterpartyRaw,
      tags: postings.tags,
      categoryLabel: categories.label,
      markKind: transferMarks.kind,
      markMethod: transferMarks.method,
      pairTransactionId: transferMarks.pairTransactionId,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(scopeFilter(tenantId, window.start, window.end, accountIds))

  const pairIds = [...new Set(rows.flatMap((r) => (r.pairTransactionId ? [r.pairTransactionId] : [])))]
  const partners = pairIds.length
    ? await db
        .select({
          transactionId: postings.transactionId,
          accountName: accounts.name,
          accountKind: accounts.kind,
          accountSubtype: accounts.providerSubtype,
        })
        .from(postings)
        .innerJoin(accounts, eq(accounts.id, postings.accountId))
        .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.type, ['asset', 'liability']), inArray(postings.transactionId, pairIds)))
    : []
  const partnerOf = new Map<string, CashFlowLeg['partner']>()
  for (const p of partners) if (!partnerOf.has(p.transactionId)) partnerOf.set(p.transactionId, p)

  return rows.map((r) => ({
    postingId: r.postingId,
    transactionId: r.transactionId,
    date: r.date,
    description: r.description,
    pending: r.status === 'pending',
    accountId: r.accountId,
    accountName: r.accountName,
    accountKind: r.accountKind,
    amount: Number(r.amount),
    currency: r.currency,
    name: r.counterparty || r.description,
    ...legCategory(r.categoryLabel, r.tags),
    markKind: r.markKind,
    markMethod: r.markMethod,
    pairTransactionId: r.pairTransactionId,
    partner: (r.pairTransactionId && partnerOf.get(r.pairTransactionId)) || null,
  }))
}

export type Scope = {
  currency: string
  currencies: string[]
  allLegs: CashFlowLeg[]
  legs: CashFlowLeg[]
  accountList: ScopeAccount[]
}

/** Currencies with in-scope legs, most legs first; with none, the (filtered)
 * accounts' currencies. The default is the first, and also stands in for a
 * requested currency the scope doesn't hold. */
export function chooseCurrency(
  allLegs: CashFlowLeg[],
  accountCurrencies: string[],
  requested?: string,
): { currency: string; currencies: string[] } {
  const legCounts = new Map<string, number>()
  for (const leg of allLegs) add(legCounts, leg.currency, 1)
  let currencies = ranked(legCounts).map((c) => c.name)
  if (!currencies.length) currencies = [...new Set(accountCurrencies)].sort()
  return { currency: requested && currencies.includes(requested) ? requested : (currencies[0] ?? ''), currencies }
}

export async function loadScope(
  tenantId: string,
  window: ScopeWindow,
  params: { accounts?: string[]; currency?: string },
): Promise<Scope> {
  const [allLegs, accountList] = await Promise.all([fetchLegs(tenantId, window, params.accounts), listScopeAccounts(tenantId)])
  const filter = params.accounts?.length ? new Set(params.accounts) : null
  const { currency, currencies } = chooseCurrency(
    allLegs,
    accountList.filter((a) => !filter || filter.has(a.id)).map((a) => a.currency),
    params.currency,
  )
  return { currency, currencies, allLegs, legs: allLegs.filter((leg) => leg.currency === currency), accountList }
}

async function loadMonth(tenantId: string, params: CashFlowScopeParams): Promise<Scope & { window: MonthWindow }> {
  const now = params.now ?? new Date()
  const window = monthWindow(params.month ?? monthOf(now), now)
  return { window, ...(await loadScope(tenantId, window, params)) }
}

type DayAgg = { month: string; day: number; legs: number; moneyIn: number; moneyOut: number }

async function dailyTotals(tenantId: string, from: string, to: string, accountIds: string[] | undefined, currency: string): Promise<DayAgg[]> {
  const rows = await db
    .select({
      month: monthSql,
      day: daySql,
      legs: sql<string>`count(*)`,
      moneyIn: sql<string>`coalesce(sum(case when ${moneyInSql} then ${postings.amount} else 0 end), 0)`,
      moneyOut: sql<string>`coalesce(sum(case when ${moneyOutSql} then -${postings.amount} else 0 end), 0)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(scopeFilter(tenantId, monthStart(from), monthStart(to), accountIds, currency))
    .groupBy(monthSql, daySql)
  return rows.map((r) => ({ month: r.month, day: Number(r.day), legs: Number(r.legs), moneyIn: Number(r.moneyIn), moneyOut: Number(r.moneyOut) }))
}

async function categoryTotalsByMonth(
  tenantId: string,
  months: string[],
  cutDay: number,
  accountIds: string[] | undefined,
  currency: string,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>()
  if (!months.length) return totals
  const sorted = [...months].sort()
  const rows = await db
    .select({
      label: categories.label,
      tags: postings.tags,
      total: sql<string>`sum(-${postings.amount})`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(
      and(
        scopeFilter(tenantId, monthStart(sorted[0]!), monthStart(addMonths(sorted.at(-1)!, 1)), accountIds, currency),
        spendingSql,
        inArray(monthSql, months),
        sql`${daySql} <= ${cutDay}`,
      ),
    )
    .groupBy(categories.label, postings.tags)
  for (const r of rows) add(totals, legCategory(r.label, r.tags).category, Number(r.total))
  return totals
}

async function payerMonths(tenantId: string, month: string, accountIds: string[] | undefined, currency: string): Promise<Map<string, Set<string>>> {
  const rows = await db
    .selectDistinct({ name: nameSql, month: monthSql })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(
      and(
        scopeFilter(tenantId, monthStart(addMonths(month, -BASELINE_SPAN)), monthStart(month), accountIds, currency),
        moneyInSql,
        sql`${accounts.kind} is distinct from 'credit'`,
      ),
    )
  const byName = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = byName.get(r.name) ?? new Set<string>()
    set.add(r.month)
    byName.set(r.name, set)
  }
  return byName
}

async function earlierMerchants(tenantId: string, month: string, names: string[]): Promise<Set<string>> {
  if (!names.length) return new Set()
  const rows = await db
    .selectDistinct({ name: nameSql })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(transferMarks, eq(transferMarks.transactionId, transactions.id))
    .where(and(scopeFilter(tenantId, monthStart(addMonths(month, -NEW_MERCHANT_SPAN)), monthStart(month)), spendingSql, inArray(nameSql, names)))
  return new Set(rows.map((r) => r.name))
}

/** 'monthly' = paid in each of the last REGULAR_SPAN complete months;
 * 'irregular' = paid at some point in the BASELINE_SPAN months before; null = new. */
function regularity(month: string, paid: Set<string> | undefined): 'monthly' | 'irregular' | null {
  if (!paid?.size) return null
  const recent = Array.from({ length: REGULAR_SPAN }, (_, i) => addMonths(month, -(i + 1)))
  return recent.every((m) => paid.has(m)) ? 'monthly' : 'irregular'
}

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null)

/** Baselines: `baselineCandidates` months with any in-scope leg, each cut at
 * the selected month's elapsed day when that month is partial. The pace
 * baseline uses the same months uncut. */
export async function getCashFlow(tenantId: string, params: CashFlowParams = {}): Promise<CashFlow> {
  const compare = params.compare ?? 'average'
  const { window, currency, currencies, allLegs, legs, accountList } = await loadMonth(tenantId, params)
  const { month } = window
  const summary = summarizeMonth(legs, window.daysInMonth)
  const cutDay = window.partial ? window.daysElapsed : 31
  const topMerchants = summary.merchants.slice(0, TOP_MERCHANTS)

  const days = await dailyTotals(tenantId, addMonths(month, -BASELINE_SPAN), month, params.accounts, currency)
  const monthAgg = new Map<string, { legs: number; moneyIn: number; moneyOut: number; moneyInCut: number; moneyOutCut: number }>()
  for (const d of days) {
    const m = monthAgg.get(d.month) ?? { legs: 0, moneyIn: 0, moneyOut: 0, moneyInCut: 0, moneyOutCut: 0 }
    m.legs += d.legs
    m.moneyIn += d.moneyIn
    m.moneyOut += d.moneyOut
    if (d.day <= cutDay) {
      m.moneyInCut += d.moneyIn
      m.moneyOutCut += d.moneyOut
    }
    monthAgg.set(d.month, m)
  }
  const baselineMonths = baselineCandidates(month, compare).filter((m) => (monthAgg.get(m)?.legs ?? 0) > 0)

  const [categoryBaseline, payers, earlier] = await Promise.all([
    categoryTotalsByMonth(tenantId, baselineMonths, cutDay, params.accounts, currency),
    payerMonths(tenantId, month, params.accounts, currency),
    earlierMerchants(tenantId, month, topMerchants.map((m) => m.name)),
  ])

  const baseIn = mean(baselineMonths.map((m) => monthAgg.get(m)!.moneyInCut))
  const baseOut = mean(baselineMonths.map((m) => monthAgg.get(m)!.moneyOutCut))
  const baseKept = baseIn === null || baseOut === null ? null : baseIn - baseOut
  const kept = round(summary.moneyIn - summary.moneyOut)
  const savingsRate = summary.moneyIn > 0 ? kept / summary.moneyIn : null
  const baseRate = baseIn !== null && baseKept !== null && baseIn > 0 ? baseKept / baseIn : null

  const months = Array.from({ length: BASELINE_SPAN }, (_, i) => addMonths(month, i - (BASELINE_SPAN - 1))).map((m) => {
    const isSelected = m === month
    const agg = monthAgg.get(m)
    const moneyIn = isSelected ? summary.moneyIn : round(agg?.moneyIn ?? 0)
    const moneyOut = isSelected ? summary.moneyOut : round(agg?.moneyOut ?? 0)
    const active = isSelected ? legs.length > 0 : (agg?.legs ?? 0) > 0
    return { month: m, moneyIn, moneyOut, net: round(moneyIn - moneyOut), partial: isSelected && window.partial, active }
  })
  const complete = months.filter((m) => !m.partial && m.active)
  const avgIn = mean(complete.map((m) => m.moneyIn))
  const avgOut = mean(complete.map((m) => m.moneyOut))

  const outByMonthDay = new Map<string, number[]>()
  for (const d of days) {
    if (!baselineMonths.includes(d.month)) continue
    const series = outByMonthDay.get(d.month) ?? Array.from({ length: 31 }, () => 0)
    series[d.day - 1]! += d.moneyOut
    outByMonthDay.set(d.month, series)
  }
  const cumulative = (series: number[], day: number) => series.slice(0, day).reduce((s, v) => s + v, 0)
  const pace = Array.from({ length: window.daysInMonth }, (_, i) => {
    const day = i + 1
    const baseline = mean(baselineMonths.map((m) => cumulative(outByMonthDay.get(m) ?? [], day)))
    return {
      day,
      current: day <= window.daysElapsed ? round(cumulative(summary.dailyOut, day)) : null,
      baseline: baseline === null ? null : round(baseline),
    }
  })

  const d = summary.destinations
  return {
    month,
    currency,
    currencies,
    partial: window.partial,
    daysElapsed: window.daysElapsed,
    daysInMonth: window.daysInMonth,
    compare,
    baselineMonths: baselineMonths.length,
    accounts: accountList.map(({ currency: _currency, ...a }) => a),
    totals: {
      moneyIn: summary.moneyIn,
      moneyOut: summary.moneyOut,
      spending: summary.spending,
      debtPayments: summary.debtPayments,
      kept,
      savingsRate,
      invested: d.invested.total,
      movedToSavings: d.savings.total,
      vs: {
        moneyIn: delta(summary.moneyIn, baseIn),
        moneyOut: delta(summary.moneyOut, baseOut),
        kept: delta(kept, baseKept),
        savingsRate: delta(savingsRate, baseRate),
      },
    },
    notCounted: NOT_COUNTED_KINDS.filter((kind) => d[kind].count > 0).map((kind) => ({ kind, count: d[kind].count, total: d[kind].total })),
    otherCurrencies: otherCurrencyTotals(allLegs, currency),
    possibleTransfers: summary.possible,
    sankey: buildSankey(summary),
    transfers: (['savings', 'invested', 'card_payoffs', 'between_accounts', 'debt_payments'] as const)
      .filter((kind) => d[kind].count > 0)
      .map((kind) => ({ kind, ...d[kind] })),
    months: months.map(({ active: _active, ...m }) => m),
    averages: { moneyIn: avgIn === null ? null : round(avgIn), moneyOut: avgOut === null ? null : round(avgOut) },
    pace,
    categories: summary.categories.map((c) => {
      const baseline = baselineMonths.length ? round((categoryBaseline.get(c.label) ?? 0) / baselineMonths.length) : null
      return {
        label: c.label,
        amount: c.amount,
        shareOfSpending: summary.spending > 0 ? c.amount / summary.spending : 0,
        shareOfIncome: summary.moneyIn > 0 ? c.amount / summary.moneyIn : null,
        ...delta(c.amount, baseline),
        fromBank: c.fromBank,
      }
    }),
    merchants: topMerchants.map((m) => ({ ...m, average: round(m.amount / m.count), isNew: !earlier.has(m.name) })),
    sources: [
      ...summary.payers.map((p) => ({ name: p.name, amount: p.amount, regularity: regularity(month, payers.get(p.name)), kind: 'payer' as const })),
      ...(summary.refunds > 0 ? [{ name: 'Refunds', amount: summary.refunds, regularity: null, kind: 'refunds' as const }] : []),
    ]
      .sort(byAmountThenName)
      .map((s) => ({ ...s, share: summary.moneyIn > 0 ? s.amount / summary.moneyIn : 0 })),
    largest: summary.largest.map(drillRow),
  }
}

export async function getCashFlowTransactions(
  tenantId: string,
  params: CashFlowScopeParams,
  filter: CashFlowFilter,
): Promise<CashFlowTransactions> {
  const { window, legs } = await loadMonth(tenantId, params)
  const summary = summarizeMonth(legs, window.daysInMonth)
  const selected = selectLegs(legs, summary, filter)
  const total = round(selected.reduce((s, leg) => s + Math.abs(leg.amount), 0))
  const ordered = filter.kind === 'largest' ? selected : [...selected].sort(newestFirst)
  return { rows: ordered.map(drillRow), total, count: selected.length }
}
