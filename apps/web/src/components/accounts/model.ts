import type { AccountBalance, AccountKind, ConnectionSummary } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { connectionHealth, isHttps, isLiveConnection, type Health } from '../../lib/connection-health'

export const CARD = 'rounded-lg border border-line bg-surface shadow-1'
export const CARD_TITLE = 'font-display text-[17px] leading-tight font-bold tracking-[-0.01em] text-ink'
export const TAG = 'shrink-0 rounded-sm border border-line px-1.5 text-[11px] leading-[18px] font-medium text-ink-3'
export const PROVIDER_LABEL: Record<ConnectionSummary['provider'], string> = { plaid: 'Plaid', 'enable-banking': 'Enable Banking' }

export const isDebt = (b: AccountBalance) => b.kind === 'credit' || b.kind === 'loan'

/** Liabilities are stored negative; this page shows what is owed as a positive amount. */
export const owedSign = (b: AccountBalance, n: number) => (isDebt(b) ? -n : n)

/** A card or loan balance for display: one in credit shows its positive amount, labelled "in credit" rather than signed. */
export function displayBalance(b: AccountBalance, n: number): { value: number; credit: boolean } {
  const owed = owedSign(b, n)
  return isDebt(b) && owed < 0 ? { value: -owed, credit: true } : { value: owed, credit: false }
}

/** What a total of debts is called: "owed", or "in credit" when the credits outweigh the debts. */
export const debtNote = (owed: number) => (owed < 0 ? 'in credit' : 'owed')

export function balanceText(b: AccountBalance, n: number): string {
  const { value, credit } = displayBalance(b, n)
  return `${formatMoney(value, b.currency)}${credit ? ' in credit' : ''}`
}

/** Share of a credit limit in use, clamped at 0 for accounts in credit; null without a limit. */
export function usedPercent(owed: number, limit: number): number | null {
  return limit > 0 ? Math.max(0, Math.round((owed / limit) * 100)) : null
}

/** Credit-card use over the counted cards: each card contributes at least 0, so one in credit doesn't offset the others. */
export function creditUsage(list: AccountBalance[]): { limit: number; percent: number } | null {
  const cards = list.filter((b) => b.kind === 'credit' && b.countsTowardTotals && b.balance !== null && b.creditLimit !== null)
  const limit = cards.reduce((sum, b) => sum + (b.creditLimit ?? 0), 0)
  const pct = usedPercent(cards.reduce((sum, b) => sum + Math.max(0, -(b.balance ?? 0)), 0), limit)
  return pct === null ? null : { limit, percent: pct }
}

/** `part` of `total` as a 0–1 fraction; null unless both are positive. */
export function shareOf(part: number, total: number): number | null {
  return part > 0 && total > 0 ? Math.min(1, part / total) : null
}

export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

export function balanceLabel(kind: AccountKind | null): string {
  if (kind === 'credit' || kind === 'loan') return 'Owed'
  if (kind === 'investment' || kind === 'property' || kind === 'vehicle' || kind === 'crypto') return 'Value'
  return 'Current balance'
}

/** "Checking •••• 0000", omitting whichever part the bank didn't report; short subtypes (cd, hsa, ira) are acronyms. */
export function identity(b: AccountBalance): string {
  const s = b.subtype
  const subtype = !s ? null : /^[a-z]{2,3}$/.test(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)
  return [subtype, b.mask ? `•••• ${b.mask}` : null].filter(Boolean).join(' ')
}

export const KIND_GROUPS: { id: 'cash' | 'credit' | 'loan' | 'investment' | 'other'; title: string; kinds: (AccountKind | null)[]; color: string }[] = [
  { id: 'cash', title: 'Cash', kinds: ['cash'], color: 'bg-chart-1' },
  { id: 'credit', title: 'Cards', kinds: ['credit'], color: 'bg-chart-3' },
  { id: 'loan', title: 'Loans', kinds: ['loan'], color: 'bg-chart-4' },
  { id: 'investment', title: 'Investments', kinds: ['investment'], color: 'bg-chart-2' },
  { id: 'other', title: 'Other', kinds: ['property', 'vehicle', 'crypto', 'other', null], color: 'bg-chart-5' },
]

export const isLive = (b: AccountBalance) => b.connectionStatus !== 'disconnected'

export type CurrencyTotals = {
  currency: string
  assets: number
  owed: number
  net: number
  cash: number
  investments: number
  otherAssets: number
  cards: number
  loans: number
  count: number
  kinds: Set<AccountKind | 'none'>
}

/** Counted balances per currency — never summed across currencies — most-used currency first. */
export function totalsByCurrency(list: AccountBalance[]): CurrencyTotals[] {
  const totals = new Map<string, CurrencyTotals>()
  for (const b of list) {
    if (b.balance === null || !b.countsTowardTotals) continue
    const t = totals.get(b.currency) ?? {
      currency: b.currency,
      assets: 0,
      owed: 0,
      net: 0,
      cash: 0,
      investments: 0,
      otherAssets: 0,
      cards: 0,
      loans: 0,
      count: 0,
      kinds: new Set<AccountKind | 'none'>(),
    }
    t.count += 1
    t.net += b.balance
    t.kinds.add(b.kind ?? 'none')
    if (b.kind === 'credit') t.cards -= b.balance
    else if (b.kind === 'loan') t.loans -= b.balance
    else if (b.kind === 'cash') t.cash += b.balance
    else if (b.kind === 'investment') t.investments += b.balance
    else t.otherAssets += b.balance
    totals.set(b.currency, t)
  }
  for (const t of totals.values()) {
    t.owed = t.cards + t.loans
    t.assets = t.cash + t.investments + t.otherAssets
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency))
}

export function connectionFor(b: AccountBalance, connections: ConnectionSummary[]): ConnectionSummary | undefined {
  return connections.find((c) => isLiveConnection(c) && c.institutionName === b.institutionName)
}

/** The live connection's health, or, with none matched, what the account itself reports; manual accounts are ok. */
export function accountHealth(b: AccountBalance, connections: ConnectionSummary[], now: number): Health {
  const c = connectionFor(b, connections)
  if (c) return connectionHealth(c, now)
  return connectionHealth({ status: b.connectionStatus ?? 'active', validUntil: null, replacedByConnectorId: null }, now)
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

export const HTTPS_REASON_ID = 'accounts-https-reason'

/** Enable Banking only sends the user back to https addresses, so its Renew/Reconnect is off while Fluide is served over http. */
export const blocksReconnect = (c: Pick<ConnectionSummary, 'provider'>) => c.provider === 'enable-banking' && !isHttps()
