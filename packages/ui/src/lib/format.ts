import type { ConfidenceBand } from '../types'

const MINUS = '\u2212'
const moneyFormatters = new Map<string, Intl.NumberFormat>()
const MONEY_LOCALES: Record<string, string> = { USD: 'en-US', EUR: 'en-IE', INR: 'en-IN' }

/** Digit grouping follows the currency, not the browser: no lakh grouping for USD in an en-IN browser. */
export function moneyLocale(currency: string): string | undefined {
  return MONEY_LOCALES[currency.toUpperCase()]
}

function moneyFormatter(currency: string): Intl.NumberFormat {
  const code = currency.toUpperCase()
  let f = moneyFormatters.get(code)
  if (!f) {
    try {
      f = new Intl.NumberFormat(moneyLocale(code), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
    } catch {
      f = new Intl.NumberFormat(moneyLocale(code), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

/** `whole` is everything before the decimal separator; `fraction` is the decimal, fraction digits and any trailing literal or currency. */
export function formatMoneyParts(value: number | string, currency = 'USD', sign: 'auto' | 'always' | 'never' = 'auto'): { whole: string; fraction: string } {
  const n = toNumber(value)
  const parts = moneyFormatter(currency).formatToParts(Math.abs(n))
  const decimalAt = parts.findIndex((p) => p.type === 'decimal')
  const split = decimalAt === -1 ? parts.length : decimalAt
  const whole = parts.slice(0, split).map((p) => p.value).join('')
  const fraction = parts.slice(split).map((p) => p.value).join('')

  if (sign === 'never' || n === 0) return { whole, fraction }
  if (n < 0) return { whole: MINUS + whole, fraction }
  return { whole: sign === 'always' ? `+${whole}` : whole, fraction }
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
const localDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

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

/** A real timestamp's calendar day in the viewer's time zone (not a UTC-midnight ledger date). */
export function formatLocalDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : localDate.format(d)
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
