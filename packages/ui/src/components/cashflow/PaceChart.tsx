import { useId, useState, type KeyboardEvent } from 'react'
import type { CashFlow, CashFlowCompare } from '../../types'
import { AMOUNT_HIDDEN, useAmountsHidden } from './amounts'
import {
  C,
  HatchDefs,
  MINUS,
  compactMoney,
  dayLabel,
  longMonth,
  money,
  niceStep,
  useTooltip,
  useWidth,
  type CfSelect,
  type TipContent,
} from './shared'

type Props = {
  pace: CashFlow['pace']
  month: string
  daysElapsed: number
  daysInMonth: number
  /** The month is still running: the cursor reads "Today" and the aria label says "so far". */
  partial: boolean
  compare: CashFlowCompare
  currency: string
  /** Headline of the pill above today's cursor, e.g. "−1.5% vs your average month by the 28th". */
  callout?: string
  height?: number
  onSelect?: CfSelect
}

const BASELINE_NAME: Record<CashFlowCompare, { full: string; short: string; aria: string }> = {
  average: { full: 'avg full month', short: 'Average', aria: 'your average month' },
  previous: { full: 'previous month in full', short: 'Previous month', aria: 'the previous month' },
  last_year: { full: 'last year, full month', short: 'Last year', aria: 'the same month last year' },
}

export function PaceChart({ pace, month, daysElapsed, daysInMonth, partial, compare, currency, callout, height = 252, onSelect }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const uid = useId().replace(/:/g, '')
  const tip = useTooltip()
  const hidden = useAmountsHidden()
  const [hoverDay, setHoverDay] = useState<number | null>(null)

  const N = Math.max(2, daysInMonth)
  const today = Math.min(Math.max(1, daysElapsed), N)
  const byDay = new Map(pace.map((p) => [p.day, p]))
  const cur = pace.filter((p): p is { day: number; current: number; baseline: number | null } => p.current !== null && p.day <= today)
  const base = pace.filter((p): p is { day: number; current: number | null; baseline: number } => p.baseline !== null)
  const names = BASELINE_NAME[compare]

  const H = height
  const pl = 44
  const pr = 16
  const pt = callout ? 56 : 16
  const pb = 30
  const pw = Math.max(0, W - pl - pr)
  const ph = H - pt - pb
  const maxV = Math.max(1, ...cur.map((p) => p.current), ...base.map((p) => p.baseline))
  const step = niceStep(maxV, 3)
  const topV = Math.ceil(maxV / step) * step
  const X = (d: number) => pl + ((d - 1) / (N - 1)) * pw
  const Y = (v: number) => pt + ph - (v / topV) * ph
  const line = (pts: [number, number][]) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${X(d)},${Y(v)}`).join('')

  const whole = (v: number) => money(v, currency, { whole: true })
  const signedOut = (v: number) => `${Math.round(v) > 0 ? MINUS : ''}${whole(v)}`
  const curToday = byDay.get(today)?.current ?? null
  const baseToday = byDay.get(today)?.baseline ?? null
  const baseFull = byDay.get(N)?.baseline ?? null

  const dayOut = (d: number) => {
    const c = byDay.get(d)?.current ?? 0
    const prev = d > 1 ? (byDay.get(d - 1)?.current ?? 0) : 0
    return Math.max(0, c - prev)
  }
  const tipFor = (d: number): TipContent => {
    const c = byDay.get(d)?.current ?? 0
    const b = byDay.get(d)?.baseline ?? null
    const rows: TipContent['rows'] = [
      { swatch: C.out, label: 'Out by this day', value: signedOut(c) },
      { label: 'Out this day', value: signedOut(dayOut(d)) },
    ]
    if (b !== null) {
      rows.push({ swatch: C.ink3, label: `${names.short} by day ${d}`, value: signedOut(b) })
      rows.push({ label: c <= b ? 'Below by' : 'Above by', value: whole(Math.abs(c - b)), total: true })
    }
    return { title: dayLabel(month, d), rows }
  }

  const selectDay = (d: number) => onSelect?.(`day:${d}`, dayLabel(month, d), dayOut(d))
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const at = hoverDay ?? today
    let next = at
    if (e.key === 'ArrowLeft') next = Math.max(1, at - 1)
    else if (e.key === 'ArrowRight') next = Math.min(today, at + 1)
    else if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
      e.preventDefault()
      selectDay(at)
      return
    } else return
    e.preventDefault()
    setHoverDay(next)
    const r = e.currentTarget.getBoundingClientRect()
    tip.show(tipFor(next), r.left + X(next), r.top + Y(byDay.get(next)?.current ?? 0))
  }

  const ticks: number[] = []
  for (let v = step; v <= topV + 1e-9; v += step) ticks.push(v)
  const xTicks = [1, 5, 10, 15, 20, 25, N].filter((d, i, a) => a.indexOf(d) === i && (!partial || Math.abs(d - today) >= 3))

  const cx = X(today)
  const pillW = callout ? Math.min(W, callout.length * 6.4 + 28) : 0
  const pillX = Math.max(0, Math.min(cx + 14, W) - pillW)
  const anchorY = Math.min(...[baseToday, curToday].filter((v): v is number => v !== null).map(Y), pt + ph)
  const endBelow = baseFull !== null && curToday !== null && curToday > baseFull
  const monthName = longMonth(month)
  const aria =
    curToday === null
      ? `Money out in ${monthName}`
      : `${partial ? 'Money out so far' : `Money out in ${monthName}`}: ${hidden ? AMOUNT_HIDDEN : whole(curToday)}${partial ? ` by ${monthName} ${today}` : ''}${
          baseToday === null ? '' : `, against ${hidden ? AMOUNT_HIDDEN : whole(baseToday)} for ${names.aria} by the same day`
        }. Use the left and right arrow keys to read each day.`
  const halo = { paintOrder: 'stroke' as const, stroke: C.panel, strokeWidth: 4, strokeLinejoin: 'round' as const }

  return (
    <div ref={ref}>
      {W > 0 && (
        <svg
          className="cf-chart cf-panel"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={aria}
          onKeyDown={onKey}
          onBlur={() => {
            setHoverDay(null)
            tip.hide()
          }}
        >
          <HatchDefs id={uid} />
          {today < N && (
            <>
              <rect x={X(today + 0.5)} y={pt} width={X(N) - X(today + 0.5)} height={ph} fill={`url(#${uid})`} />
              <line x1={X(N)} x2={X(N)} y1={pt} y2={pt + ph} stroke={C.ink} strokeOpacity={0.5} strokeDasharray="3 3" />
              {X(N) - X(today + 0.5) >= 48 && (
                <text x={(X(today + 0.5) + X(N)) / 2} y={pt + ph - 10} textAnchor="middle" className="cf-ax">
                  not yet
                </text>
              )}
            </>
          )}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={C.ink} strokeOpacity={0.12} />
              <text x={pl - 8} y={Y(v) + 4} textAnchor="end" className="cf-ax amt">
                {compactMoney(v, currency)}
              </text>
            </g>
          ))}
          <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke={C.ink} strokeOpacity={0.3} />
          <text x={pl - 8} y={Y(0) + 4} textAnchor="end" className="cf-ax amt">
            {compactMoney(0, currency)}
          </text>
          {xTicks.map((d) => (
            <text key={d} x={X(d)} y={H - pb + 18} textAnchor="middle" className="cf-ax">
              {d}
            </text>
          ))}

          {cur.length > 0 && (
            <path
              className="cf-fd"
              d={`${line(cur.map((p) => [p.day, p.current]))}L${X(cur[cur.length - 1].day)},${Y(0)}L${X(cur[0].day)},${Y(0)}Z`}
              fill={C.ink}
              fillOpacity={0.06}
            />
          )}
          {base.length > 1 && (
            <path
              d={line(base.map((p) => [p.day, p.baseline]))}
              fill="none"
              stroke={C.ink}
              strokeWidth={1.6}
              strokeDasharray="1 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {cur.length > 1 && (
            <path
              className="cf-dr"
              pathLength={1}
              d={line(cur.map((p) => [p.day, p.current]))}
              fill="none"
              stroke={C.ink}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {baseFull !== null && (
            <g textAnchor="end">
              <text x={Math.min(X(N), cx) - 10} y={Y(baseFull) + (endBelow ? 16 : -18)} className="cf-ax" style={halo}>
                {names.full}
              </text>
              <text
                x={Math.min(X(N), cx) - 10}
                y={Y(baseFull) + (endBelow ? 30 : -5)}
                className="cf-ax amt"
                style={{ ...halo, fill: C.ink, fontWeight: 600 }}
              >
                {whole(baseFull)}
              </text>
            </g>
          )}

          {callout && (
            <g>
              <line x1={cx} x2={cx} y1={28} y2={anchorY - 4} stroke={C.ink} strokeWidth={1.2} />
              <rect x={pillX} y={4} width={pillW} height={24} rx={12} fill={C.ink} />
              <text x={pillX + pillW / 2} y={20} textAnchor="middle" style={{ font: '700 11px var(--font-sans)', fill: C.panel }}>
                {callout}
              </text>
            </g>
          )}
          {cur.length > 0 && <line x1={cx} x2={cx} y1={anchorY} y2={Y(0)} stroke={C.ink} strokeWidth={1} />}
          {baseToday !== null && <circle cx={cx} cy={Y(baseToday)} r={3} fill={C.panel} stroke={C.ink} strokeWidth={1.4} />}
          {curToday !== null && <circle cx={cx} cy={Y(curToday)} r={4.5} fill={C.ink} stroke={C.panel} strokeWidth={2} />}
          {partial && (
            <text x={cx} y={H - pb + 18} textAnchor="middle" style={{ font: '700 11px var(--font-sans)', fill: C.ink }}>
              Today · {today}
            </text>
          )}

          {hoverDay !== null && hoverDay !== today && (
            <circle cx={X(hoverDay)} cy={Y(byDay.get(hoverDay)?.current ?? 0)} r={3.5} fill={C.ink} stroke={C.panel} strokeWidth={2} pointerEvents="none" />
          )}
          {cur.map((p) => (
            <rect
              key={p.day}
              className="cf-hit"
              style={onSelect ? undefined : { cursor: 'default' }}
              x={X(p.day - 0.5)}
              y={pt}
              width={pw / (N - 1)}
              height={ph}
              onMouseEnter={(e) => {
                setHoverDay(p.day)
                tip.show(tipFor(p.day), e.clientX, e.clientY)
              }}
              onMouseMove={(e) => tip.show(tipFor(p.day), e.clientX, e.clientY)}
              onMouseLeave={() => {
                setHoverDay(null)
                tip.hide()
              }}
              onClick={() => selectDay(p.day)}
            />
          ))}
        </svg>
      )}
      {tip.node}
    </div>
  )
}
