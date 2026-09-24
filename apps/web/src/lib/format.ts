/** SOURCE OF TRUTH: display formatting for money, dates and confidence.
 * WHAT: Intl-based currency/date formatters (cached per currency) and the
 * High/Medium/Low confidence tiering shown next to every AI suggestion.
 * WHY: amounts arrive as strings in each row's own currency; formatting in
 * one place keeps the minus sign, currency and rounding identical across
 * the ledger, overview and review screens.
 * WHERE: pure functions only.
 */

import type { ConfidenceBand } from './api'

const MINUS = '\u2212'
const moneyFormatters = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string): Intl.NumberFormat {
  const code = currency.toUpperCase()
  let f = moneyFormatters.get(code)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
    } catch {
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    moneyFormatters.set(code, f)
  }
  return f
}

export function toNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** `sign: 'auto'` shows a true minus for negatives; 'always' also prefixes +. */
export function formatMoney(value: number | string, currency = 'USD', sign: 'auto' | 'always' | 'never' = 'auto'): string {
  const n = toNumber(value)
  const body = moneyFormatter(currency).format(Math.abs(n))
  if (sign === 'never' || n === 0) return body
  if (n < 0) return MINUS + body
  return sign === 'always' ? `+${body}` : body
}

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Ledger dates are calendar dates stored at UTC midnight — format them in UTC. */
export function formatLedgerDate(iso: string, withYear = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear()
  return withYear || !sameYear ? longDate.format(d) : shortDate.format(d)
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d)
}

export const BAND_LABEL: Record<ConfidenceBand, string> = { high: 'High', medium: 'Medium', low: 'Low' }

/** Tier for a raw 0..1 confidence when the server didn't band it for us. */
export function bandFor(confidence: number, high = 0.75, low = 0.5): ConfidenceBand {
  if (confidence >= high) return 'high'
  if (confidence >= low) return 'medium'
  return 'low'
}

export function formatConfidence(value: string | number | null): string | null {
  if (value === null) return null
  const n = toNumber(value)
  return n.toFixed(2)
}

/** "FOOD_AND_DRINK" → "Food & drink". */
export function humanizeKey(key: string): string {
  const words = key.toLowerCase().replaceAll('_and_', ' & ').replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function sourceLabel(source: string | null): string {
  if (!source) return 'Unknown source'
  if (source === 'jev') return 'Jev model'
  if (source === 'rule') return 'Rule'
  if (source === 'human' || source === 'user') return 'You'
  return humanizeKey(source)
}
