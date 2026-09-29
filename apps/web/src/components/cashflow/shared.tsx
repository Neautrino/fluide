import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { CashFlowFilter } from '../../lib/api'
import './cashflow.css'

/** Drill-down: `token` is a `/cashflow/transactions` filter whose total equals `amount`. */
export type CfSelect = (token: CashFlowFilter, label: string, amount: number) => void

export const MINUS = '\u2212'
export const MASK = '•••••'

const fullFormatters = new Map<string, Intl.NumberFormat>()
const wholeFormatters = new Map<string, Intl.NumberFormat>()
const compactFormatters = new Map<string, Intl.NumberFormat>()

function formatter(cache: Map<string, Intl.NumberFormat>, currency: string, options: Intl.NumberFormatOptions) {
  const code = currency.toUpperCase()
  let f = cache.get(code)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', ...options })
    } catch {
      f = new Intl.NumberFormat(undefined, options)
    }
    cache.set(code, f)
  }
  return f
}

type MoneyOpts = { hidden?: boolean; sign?: 'auto' | 'always' | 'never'; whole?: boolean }

export function money(value: number, currency: string, { hidden = false, sign = 'never', whole = false }: MoneyOpts = {}): string {
  const f = whole
    ? formatter(wholeFormatters, currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
    : formatter(fullFormatters, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const body = hidden ? MASK : f.format(Math.abs(value))
  if (sign === 'never' || value === 0) return body
  if (value < 0) return MINUS + body
  return sign === 'always' ? `+${body}` : body
}

export function compactMoney(value: number, currency: string, hidden: boolean): string {
  if (hidden) return value === 0 ? '0' : '•••'
  const f = formatter(compactFormatters, currency, { notation: 'compact', maximumFractionDigits: 1 })
  const body = f.format(Math.abs(value))
  return value < 0 ? MINUS + body : body
}

/** "$7,754" and ".22", so the cents can be set smaller and lighter. */
export function moneyParts(value: number, currency: string, hidden: boolean): { whole: string; cents: string } {
  if (hidden) return { whole: MASK, cents: '' }
  const parts = formatter(fullFormatters, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(Math.abs(value))
  const i = parts.findIndex((p) => p.type === 'decimal')
  if (i < 0) return { whole: parts.map((p) => p.value).join(''), cents: '' }
  return {
    whole: parts.slice(0, i).map((p) => p.value).join(''),
    cents: parts.slice(i).map((p) => p.value).join(''),
  }
}

export function percent(part: number, whole: number, digits = 1): string {
  if (!whole) return '—'
  return `${((part / whole) * 100).toFixed(digits)}%`
}

function monthDate(month: string, day = 1): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}
const shortMonthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
const longMonthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const shortMonth = (month: string) => shortMonthFmt.format(monthDate(month))
export const longMonth = (month: string) => longMonthFmt.format(monthDate(month))
export const monthYear = (month: string) => `${shortMonth(month)} ${month.slice(0, 4)}`
export const dayLabel = (month: string, day: number) => dayFmt.format(monthDate(month, day))

/** A round axis step so that `max / step` gives 2–5 gridlines. */
export function niceStep(max: number, lines = 3): number {
  if (!(max > 0)) return 1
  const raw = max / lines
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
}

/** Pushes label centres apart until neighbours are at least `gap(i)` apart. */
export function spread(centres: number[], gap: (i: number) => number, lo: number, hi: number): number[] {
  const y = [...centres]
  for (let it = 0; it < 32; it++) {
    for (let i = 1; i < y.length; i++) {
      const need = gap(i) - (y[i] - y[i - 1])
      if (need > 0) {
        y[i] += need / 2
        y[i - 1] -= need / 2
      }
    }
    if (y.length) {
      y[0] = Math.max(y[0], lo)
      y[y.length - 1] = Math.min(y[y.length - 1], hi)
    }
  }
  return y
}

export function useWidth<T extends Element>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.floor(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export type TipRow = { swatch?: string; label: string; value: string; total?: boolean }
export type TipContent = { title: string; rows: TipRow[]; note?: string }
type TipState = { content: TipContent; x: number; y: number }

function Tooltip({ content, x, y }: TipState) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let left = x + 12
    let top = y + 12
    if (left + r.width > innerWidth - 8) left = x - r.width - 12
    if (top + r.height > innerHeight - 8) top = y - r.height - 12
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
  }, [x, y, content])
  return createPortal(
    <div className="cashflow">
      <div ref={ref} className="cf-tip" role="tooltip" style={{ left: x + 12, top: y + 12 }}>
        <span className="h">{content.title}</span>
        {content.rows.map((r, i) => (
          <span key={i} className={r.total ? 'tr tot' : 'tr'}>
            <i style={{ background: r.swatch ?? 'transparent' }} />
            <span>{r.label}</span>
            <span>{r.value}</span>
          </span>
        ))}
        {content.note && <span className="note">{content.note}</span>}
      </div>
    </div>,
    document.body,
  )
}

/** One floating tooltip per chart; `node` must be rendered by the chart. Escape dismisses it (WCAG 1.4.13). */
export function useTooltip(): {
  node: ReactNode
  show: (content: TipContent, x: number, y: number) => void
  hide: () => void
} {
  const [state, setState] = useState<TipState | null>(null)
  const show = useCallback((content: TipContent, x: number, y: number) => setState({ content, x, y }), [])
  const hide = useCallback(() => setState(null), [])
  const open = state !== null
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setState(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return { node: state ? <Tooltip {...state} /> : null, show, hide }
}

/** Keyboard + pointer props for an SVG element that behaves like a button. */
export function svgButton(label: string, onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
  }
}

/** Hatch fills: dense current-period hatch for in/out, sparse "not yet" hatch. */
export function HatchDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-in`} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4.5" height="4.5" style={{ fill: 'var(--cf-in-wash)' }} />
        <line x1="0" y1="0" x2="0" y2="4.5" style={{ stroke: 'var(--cf-in)' }} strokeWidth="2" />
      </pattern>
      <pattern id={`${id}-out`} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4.5" height="4.5" style={{ fill: 'var(--cf-out-wash)' }} />
        <line x1="0" y1="0" x2="0" y2="4.5" style={{ stroke: 'var(--cf-out)' }} strokeWidth="2" />
      </pattern>
      <pattern id={`${id}-no`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--cf-line)' }} strokeWidth="1.25" />
      </pattern>
    </defs>
  )
}

export const C = {
  ink: 'var(--cf-ink)',
  ink2: 'var(--cf-ink2)',
  ink3: 'var(--cf-ink3)',
  line: 'var(--cf-line)',
  rule: 'var(--cf-rule)',
  rule2: 'var(--cf-rule2)',
  accent: 'var(--cf-accent)',
  surface: 'var(--cf-surface)',
  grid: 'var(--cf-grid)',
  in: 'var(--cf-in)',
  out: 'var(--cf-out)',
  inTint: 'var(--cf-in-tint)',
  outTint: 'var(--cf-out-tint)',
} as const
