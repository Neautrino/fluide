import { useId, useState, type KeyboardEvent } from 'react'
import type { CashFlow, CashFlowCompare } from '../../lib/api'
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
  compare: CashFlowCompare
  currency: string
  hidden?: boolean
  /** Headline of the callout box beside today's cursor, e.g. "−1.5% vs your average by the 28th". */
  callout?: string
  height?: number
  onSelect?: CfSelect
}

const BASELINE_NAME: Record<CashFlowCompare, { line: string; full: string; short: string }> = {
  average: { line: 'Your average month', full: 'avg full month', short: 'Average' },
  previous: { line: 'Last month', full: 'last month in full', short: 'Last month' },
  last_year: { line: 'Same month last year', full: 'last year, full month', short: 'Last year' },
}

export function PaceChart({
  pace,
  month,
  daysElapsed,
  daysInMonth,
  compare,
  currency,
  hidden = false,
  callout,
  height = 320,
  onSelect,
}: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const uid = useId().replace(/:/g, '')
  const tip = useTooltip()
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
  const pt = callout ? 80 : 24
  const pb = 36
  const pw = Math.max(0, W - pl - pr)
  const ph = H - pt - pb
  const maxV = Math.max(1, ...cur.map((p) => p.current), ...base.map((p) => p.baseline))
  const step = niceStep(maxV, 3)
  const topV = Math.ceil(maxV / step) * step
  const X = (d: number) => pl + ((d - 1) / (N - 1)) * pw
  const Y = (v: number) => pt + ph - (v / topV) * ph
  const line = (pts: [number, number][]) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${X(d)},${Y(v)}`).join('')

  const whole = (v: number) => money(v, currency, { hidden, whole: true })
  // Money out reads as negative; masked values keep the sign so a hidden zero isn't told apart.
  const signedOut = (v: number) => `${hidden || Math.round(v) > 0 ? MINUS : ''}${whole(v)}`
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
      { swatch: C.ink, label: 'Out so far', value: signedOut(c) },
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
  const xTicks = [1, 5, 10, 15, 20, 25, N].filter((d, i, a) => d <= N && a.indexOf(d) === i && Math.abs(d - today) >= 2 && (d === N || N - d >= 2))

  const angle = (p0: [number, number], p1: [number, number]) => (Math.atan2(Y(p1[1]) - Y(p0[1]), X(p1[0]) - X(p0[0])) * 180) / Math.PI
  const curLab = cur.length >= 2 ? ([cur[0], cur[Math.min(4, cur.length - 1)]] as const) : null
  // The baseline's name runs along its line, under it if there is room there, else over it. Anchor it where that
  // strip clears the axes, the current line, the month label and the end label; with no such stretch the end label
  // ("avg full month") names the line on its own.
  const labelSpan = Math.max(1, Math.ceil(116 / Math.max(1, pw / (N - 1))))
  const clearOf = (p: (typeof base)[number], under: boolean) => {
    const y = Y(p.baseline)
    const c = p.day <= today ? byDay.get(p.day)?.current : null
    const free = c == null || (under ? Y(c) <= y - 4 || Y(c) >= y + 24 : Y(c) >= y + 4 || Y(c) <= y - 24)
    return free && (under ? y + 20 <= Y(0) - 4 : y - 20 >= pt)
  }
  const labelAt = (under: boolean) =>
    base.findIndex(
      (p, i) =>
        X(p.day) >= X(cur[0]?.day ?? 1) + 80 &&
        i + labelSpan < base.length &&
        X(base[i + labelSpan].day) <= X(today) - (under ? 16 : 170) &&
        base.slice(i, i + labelSpan + 1).every((q) => clearOf(q, under)),
    )
  const underAt = labelAt(true)
  const baseUnder = underAt >= 0
  const baseStart = baseUnder ? underAt : labelAt(false)
  const baseLab = baseStart < 0 ? null : ([base[baseStart], base[baseStart + labelSpan]] as const)

  const cx = X(today)
  const bw = Math.min(252, W)
  const bx = Math.max(0, Math.min(cx + 8, W) - bw)
  const monthName = longMonth(month)
  const aria =
    curToday === null
      ? `Money out in ${monthName}`
      : `Money out so far: ${whole(curToday)} by ${monthName} ${today}${
          baseToday === null ? '' : `, against ${whole(baseToday)} for ${names.line.toLowerCase()} by the same day`
        }. Use the left and right arrow keys to read each day.`

  return (
    <div ref={ref}>
      {W > 0 && (
        <svg
          className="cf-chart"
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
              <rect x={X(today + 0.5)} y={pt} width={X(N) - X(today + 0.5) + 8} height={ph} fill={`url(#${uid}-no)`} />
              <text x={(X(today + 0.5) + X(N) + 8) / 2} y={pt + ph - 24} textAnchor="middle" className="cf-ax" style={{ fontSize: 11 }}>
                {today + 1 === N ? N : `${today + 1}–${N}`}
              </text>
              <text x={(X(today + 0.5) + X(N) + 8) / 2} y={pt + ph - 10} textAnchor="middle" className="cf-ax" style={{ fontSize: 11 }}>
                not yet
              </text>
            </>
          )}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
              <text x={pl - 8} y={Y(v) + 4} textAnchor="end" className="cf-ax">
                {compactMoney(v, currency, hidden)}
              </text>
            </g>
          ))}
          <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke={C.line} />
          <text x={pl - 8} y={Y(0) + 4} textAnchor="end" className="cf-ax">
            {compactMoney(0, currency, hidden)}
          </text>
          {xTicks.map((d) => (
            <text key={d} x={X(d)} y={H - pb + 20} textAnchor="middle" className="cf-ax">
              {d}
            </text>
          ))}

          {cur.length > 0 && (
            <path
              className="cf-fd"
              d={`${line(cur.map((p) => [p.day, p.current]))}L${X(cur[cur.length - 1].day)},${Y(0)}L${X(cur[0].day)},${Y(0)}Z`}
              fill={C.ink}
              fillOpacity={0.05}
            />
          )}
          {base.length > 1 && (
            <path
              d={line(base.map((p) => [p.day, p.baseline]))}
              fill="none"
              stroke={C.ink3}
              strokeWidth={1.5}
              strokeDasharray="4 3"
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
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {curLab && (
            <g
              transform={`translate(${X(curLab[0].day)},${Y(curLab[0].current)}) rotate(${angle(
                [curLab[0].day, curLab[0].current],
                [curLab[1].day, curLab[1].current],
              )})`}
            >
              <text x={10} y={-8} className="cf-ax cf-fd" style={{ fill: C.ink, fontWeight: 600, animationDelay: '500ms' }}>
                {monthName}
              </text>
            </g>
          )}
          {baseLab && (
            <g
              transform={`translate(${X(baseLab[0].day)},${Y(baseLab[0].baseline)}) rotate(${angle(
                [baseLab[0].day, baseLab[0].baseline],
                [baseLab[1].day, baseLab[1].baseline],
              )})`}
            >
              <text x={10} y={baseUnder ? 16 : -8} className="cf-ax cf-fd" style={{ animationDelay: '500ms' }}>
                {names.line}
              </text>
            </g>
          )}
          {baseFull !== null && (
            <text
              x={Math.min(X(N), cx) - 12}
              y={Y(baseFull) - 4}
              textAnchor="end"
              className="cf-ax"
              style={{ paintOrder: 'stroke', stroke: C.surface, strokeWidth: 4 }}
            >
              {names.full}{' '}
              <tspan style={{ fill: C.ink, fontWeight: 500 }}>{whole(baseFull)}</tspan>
            </text>
          )}

          <line x1={cx} x2={cx} y1={pt - 16} y2={pt + ph} stroke={C.ink3} strokeDasharray="2 3" />
          {baseToday !== null && <circle cx={cx} cy={Y(baseToday)} r={3.5} fill={C.surface} stroke={C.ink3} strokeWidth={1.5} />}
          {curToday !== null && <circle cx={cx} cy={Y(curToday)} r={4} fill={C.accent} stroke={C.surface} strokeWidth={2} />}
          <text x={cx} y={H - pb + 20} textAnchor="middle" style={{ font: '600 11.5px var(--font-sans)', fill: C.ink }}>
            {today}
          </text>

          {hoverDay !== null && hoverDay !== today && (
            <circle cx={X(hoverDay)} cy={Y(byDay.get(hoverDay)?.current ?? 0)} r={3.5} fill={C.ink} stroke={C.surface} strokeWidth={2} pointerEvents="none" />
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

          {callout && (
            <g>
              <rect x={bx} y={0} width={bw} height={56} rx={8} fill={C.surface} stroke={C.rule} />
              <text x={bx + 12} y={22} style={{ font: '600 13px var(--font-sans)', fill: C.ink }}>
                {callout}
              </text>
              <text x={bx + 12} y={42} className="cf-ax" style={{ fontSize: 12 }}>
                Today · {today}/{N} days
                {curToday !== null && (
                  <>
                    {' · '}
                    <tspan style={{ fill: C.ink, fontWeight: 500 }}>{whole(curToday)}</tspan>
                    {baseToday !== null && <> vs {whole(baseToday)}</>}
                  </>
                )}
              </text>
            </g>
          )}
        </svg>
      )}
      {tip.node}
    </div>
  )
}
