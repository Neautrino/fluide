import { C, MINUS, useTooltip, type TipContent } from './shared'

type Props = {
  /** `CashFlow.totals.savingsRate`: 0..1, signed, null when nothing came in. */
  value: number | null
  /** `CashFlow.totals.vs.savingsRate.baseline`. */
  baseline: number | null
  baselineLabel?: string
  size?: number
}

const TICKS = 48

const pct = (v: number) => `${v < 0 ? MINUS : ''}${Math.abs(v * 100).toFixed(1)}%`

/** Segmented ring: filled ticks = savings rate (clockwise; a negative rate fills anticlockwise in the out colour). */
export function TickGauge({ value, baseline, baselineLabel = 'Your average', size = 64 }: Props) {
  const tip = useTooltip()
  const filled = value === null ? 0 : Math.min(TICKS, Math.round(Math.abs(value) * TICKS))
  const negative = value !== null && value < 0
  const avgI = baseline === null || baseline < 0 ? -1 : Math.min(TICKS - 1, Math.round(baseline * TICKS))
  const content: TipContent = {
    title: 'Savings rate',
    rows: [
      { swatch: negative ? C.out : C.in, label: 'This month', value: value === null ? '—' : pct(value), total: true },
      ...(baseline === null ? [] : [{ swatch: C.ink, label: `${baselineLabel} (dark tick)`, value: pct(baseline) }]),
    ],
  }
  const aria = `Savings rate ${value === null ? 'not available' : pct(value)}${baseline === null ? '' : `; ${baselineLabel.toLowerCase()} ${pct(baseline)}`}`

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2
    const avg = i === avgI
    const on = negative ? i >= TICKS - filled : i < filled
    const r1 = avg ? 26 : 32
    const r2 = avg ? 48 : 44
    return (
      <line
        key={i}
        x1={50 + r1 * Math.cos(a)}
        y1={50 + r1 * Math.sin(a)}
        x2={50 + r2 * Math.cos(a)}
        y2={50 + r2 * Math.sin(a)}
        stroke={on ? (negative ? C.out : C.in) : avg ? C.ink : C.rule2}
        strokeWidth={avg ? 2.5 : 3.5}
        strokeLinecap="round"
        className={on ? 'cf-fd' : undefined}
        style={on ? { animationDelay: `${200 + (negative ? TICKS - i : i) * 14}ms` } : undefined}
      />
    )
  })

  return (
    <>
      <svg
        className="cf-chart"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        tabIndex={0}
        aria-label={aria}
        onMouseEnter={(e) => tip.show(content, e.clientX, e.clientY)}
        onMouseMove={(e) => tip.show(content, e.clientX, e.clientY)}
        onMouseLeave={tip.hide}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          tip.show(content, r.left, r.bottom)
        }}
        onBlur={tip.hide}
      >
        {ticks}
      </svg>
      {tip.node}
    </>
  )
}
