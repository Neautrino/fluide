import type { CashFlow, CashFlowCompare, ConnectionSummary } from '../../lib/api'
import { money } from './shared'

export const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const monthOnly = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })
export const monthShortYear = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Rounded to whole units and unsigned, for baselines quoted inside sentences. */
export function formatWhole(value: number, currency: string): string {
  return money(Math.abs(value), currency, { whole: true })
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

export function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`)
}

export function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** A share (0.123 → "12.3%") with a true minus; a negative that rounds to zero loses its sign. */
export function pct(share: number, digits = 1): string {
  const body = `${Math.abs(share * 100).toFixed(digits)}%`
  return share < 0 && body !== `${(0).toFixed(digits)}%` ? `\u2212${body}` : body
}

export function baselineNoun(compare: CashFlowCompare, month: string): string {
  if (compare === 'average') return 'your average month'
  if (compare === 'previous') return 'the previous month'
  return `${monthOnly.format(monthStart(month))} last year`
}

export function compareShort(compare: CashFlowCompare): 'avg' | 'prev' | 'last yr' {
  return compare === 'average' ? 'avg' : compare === 'previous' ? 'prev' : 'last yr'
}

/** The logins behind the accounts in scope. */
export function scopedConnections(accounts: CashFlow['accounts'], selected: string[], connections: ConnectionSummary[]): ConnectionSummary[] {
  const ids = new Set(accounts.filter((a) => selected.length === 0 || selected.includes(a.id)).map((a) => a.connectorId))
  return connections.filter((c) => ids.has(c.id))
}
