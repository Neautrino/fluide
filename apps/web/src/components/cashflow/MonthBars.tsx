import { useId, useState, type KeyboardEvent } from 'react'
import type { CashFlow } from '../../lib/api'
import {
  C,
  HatchDefs,
  compactMoney,
  money,
  monthYear,
  niceStep,
  shortMonth,
  spread,
  useTooltip,
  useWidth,
  type TipContent,
} from './shared'

type Month = CashFlow['months'][number]

type Props = {
  months: CashFlow['months']
  averages: CashFlow['averages']
  currency: string
  daysElapsed: number
  daysInMonth: number
  hidden?: boolean
  onMonth: (month: string) => void
  height?: number
}

function bar(x: number, z: number, h: number, w: number, up: boolean): string {
  const r = Math.min(2, h)
  return up
    ? `M${x},${z}V${z - h + r}Q${x},${z - h} ${x + r},${z - h}H${x + w - r}Q${x + w},${z - h} ${x + w},${z - h + r}V${z}Z`
    : `M${x},${z}V${z + h - r}Q${x},${z + h} ${x + r},${z + h}H${x + w - r}Q${x + w},${z + h} ${x + w},${z + h - r}V${z}Z`
}

export function MonthBars({ months, averages, currency, daysElapsed, daysInMonth, hidden = false, onMonth, height = 320 }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const uid = useId().replace(/:/g, '')
  const tip = useTooltip()
  const [hover, setHover] = useState(-1)
  const n = months.length
  const [kbState, setKbIdx] = useState(n - 1)
  const kbIdx = Math.min(Math.max(0, kbState), n - 1)

  const H = height
  const pl = 44
  const pr = 84
  const pt = 20
  const pb = 44
  const maxIn = Math.max(0, ...months.map((m) => m.moneyIn), averages.moneyIn ?? 0)
  const maxOut = Math.max(0, ...months.map((m) => m.moneyOut), averages.moneyOut ?? 0)
  const step = niceStep(Math.max(maxIn, maxOut, 1), 2)
  const top = Math.max(step, Math.ceil(maxIn / step) * step)
  const bottom = Math.max(step, Math.ceil(maxOut / step) * step)
  const k = (H - pt - pb) / (top + bottom)
  const z = pt + top * k
  const pw = Math.max(0, W - pl - pr)
  const bw = n ? pw / n : 0
  const w = Math.max(4, Math.round(bw * 0.6))
  const avgKept = averages.moneyIn !== null && averages.moneyOut !== null ? averages.moneyIn - averages.moneyOut : null

  const fmt = (v: number, sign: 'auto' | 'always' | 'never' = 'never') => money(v, currency, { hidden, sign })
  const whole = (v: number, sign: 'auto' | 'always' | 'never' = 'never') => money(v, currency, { hidden, sign, whole: true })

  const tipFor = (m: Month): TipContent => ({
    title: `${monthYear(m.month)}${m.partial ? ` · 1–${daysElapsed}, to date` : ''}`,
    rows: [
      { swatch: C.in, label: '▲ Money in', value: fmt(m.moneyIn, 'always') },
      { swatch: C.out, label: '▼ Money out', value: fmt(-m.moneyOut, 'auto') },
      { swatch: C.ink, label: m.net >= 0 ? 'Kept' : 'Deficit', value: fmt(m.net, 'always'), total: true },
    ],
    note: avgKept === null ? undefined : `${whole(m.net - avgKept, 'always')} vs the chart's average kept (${whole(avgKept, 'auto')})`,
  })

  const showAt = (i: number) => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    const r = svg.getBoundingClientRect()
    tip.show(tipFor(months[i]), r.left + pl + bw * (i + 1) - 4, r.top + 40)
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    let next = kbIdx
    if (e.key === 'ArrowLeft') next = Math.max(0, kbIdx - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, kbIdx + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onMonth(months[kbIdx].month)
      return
    } else return
    e.preventDefault()
    setKbIdx(next)
    setHover(next)
    showAt(next)
  }

  const ticks: { v: number; label: string }[] = []
  for (let v = step; v <= top + 1e-9; v += step) ticks.push({ v, label: `+${compactMoney(v, currency, hidden)}` })
  for (let v = step; v <= bottom + 1e-9; v += step) ticks.push({ v: -v, label: compactMoney(-v, currency, hidden) })

  const lastMonth = months[n - 1]
  const gutter = [
    ...(averages.moneyIn === null ? [] : [{ key: 'in', y: z - averages.moneyIn * k, label: 'Chart avg in', value: whole(averages.moneyIn) }]),
    ...(averages.moneyOut === null ? [] : [{ key: 'out', y: z + averages.moneyOut * k, label: 'Chart avg out', value: whole(averages.moneyOut) }]),
    ...(lastMonth
      ? [{ key: 'net', y: z - lastMonth.net * k, label: lastMonth.net >= 0 ? 'Kept' : 'Deficit', value: whole(lastMonth.net, 'always') }]
      : []),
  ].sort((a, b) => a.y - b.y)
  const gutterY = spread(
    gutter.map((g) => g.y),
    () => 30,
    pt,
    H - pb - 16,
  )

  const range = n ? `${monthYear(months[0].month)} to ${monthYear(months[n - 1].month)}` : ''
  const x2 = W - pr + 8

  return (
    <div ref={ref}>
      {W > 0 && n > 0 && (
        <svg
          className="cf-chart"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          tabIndex={0}
          role="img"
          aria-label={`Money in and out, ${range}. Use the left and right arrow keys to read each month, Enter to open it.`}
          onKeyDown={onKey}
          onFocus={() => {
            setHover(kbIdx)
            showAt(kbIdx)
          }}
          onBlur={() => {
            setHover(-1)
            tip.hide()
          }}
        >
          <HatchDefs id={uid} />
          {ticks.map((t) => (
            <g key={t.v}>
              <line x1={pl} x2={x2} y1={z - t.v * k} y2={z - t.v * k} stroke={C.grid} />
              <text x={pl - 8} y={z - t.v * k + 4} textAnchor="end" className="cf-ax">
                {t.label}
              </text>
            </g>
          ))}
          <text x={pl - 8} y={z + 4} textAnchor="end" className="cf-ax">
            {compactMoney(0, currency, hidden)}
          </text>

          {months.map((m, i) => {
            const cx = pl + bw * (i + 0.5)
            const x = cx - w / 2
            const last = i === n - 1
            const hi = m.moneyIn * k
            const ho = m.moneyOut * k
            const ny = z - m.net * k
            const delay = { animationDelay: `${100 + i * 20}ms` }
            const netDelay = { animationDelay: `${500 + i * 20}ms` }
            const yearLabel = i === 0 || m.month.endsWith('-01')
            return (
              <g key={m.month}>
                <rect className={`cf-band${hover === i ? ' on' : ''}`} x={cx - bw / 2} y={pt - 8} width={bw} height={H - pt - pb + 8} rx={4} />
                {m.partial ? (
                  <path className="cf-gu" style={delay} d={bar(x, z, hi, w, true)} fill={`url(#${uid}-in)`} stroke={C.in} strokeWidth={1.5} />
                ) : last ? (
                  <path className="cf-gu" style={delay} d={bar(x, z, hi, w, true)} fill={C.in} />
                ) : (
                  <g className="cf-gu" style={delay}>
                    <path d={bar(x, z, hi, w, true)} fill={C.inTint} />
                    {hi > 0 && <path d={bar(x, z - hi + Math.min(3, hi), Math.min(3, hi), w, true)} fill={C.in} />}
                  </g>
                )}
                {m.partial ? (
                  <path className="cf-gd" style={delay} d={bar(x, z, ho, w, false)} fill={`url(#${uid}-out)`} stroke={C.out} strokeWidth={1.5} />
                ) : last ? (
                  <path className="cf-gd" style={delay} d={bar(x, z, ho, w, false)} fill={C.out} />
                ) : (
                  <g className="cf-gd" style={delay}>
                    <path d={bar(x, z, ho, w, false)} fill={C.outTint} />
                    {ho > 0 && <path d={bar(x, z + ho - Math.min(3, ho), Math.min(3, ho), w, false)} fill={C.out} />}
                  </g>
                )}
                <line className="cf-fd" style={netDelay} x1={x - 4} x2={x + w + 4} y1={ny} y2={ny} stroke={C.surface} strokeWidth={5} strokeLinecap="round" />
                <line
                  className="cf-fd"
                  style={netDelay}
                  x1={x - 4}
                  x2={x + w + 4}
                  y1={ny}
                  y2={ny}
                  stroke={C.ink}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeOpacity={last ? 1 : 0.7}
                />
                {last && m.partial && <ToDate cx={cx} edge={cx + bw / 2 - 2} gutter={x2 + 8} y={z - hi} days={`${daysElapsed}/${daysInMonth} days`} />}
                <text
                  x={cx}
                  y={H - pb + 20}
                  textAnchor="middle"
                  className="cf-ax"
                  style={last ? { fill: C.ink, fontWeight: 600 } : undefined}
                >
                  {shortMonth(m.month)}
                </text>
                {yearLabel && (
                  <text x={cx} y={H - pb + 36} textAnchor="middle" className="cf-ax" style={{ fontSize: 11 }}>
                    {m.month.slice(0, 4)}
                  </text>
                )}
                <rect
                  className="cf-hit"
                  x={cx - bw / 2}
                  y={pt - 8}
                  width={bw}
                  height={H - pt - pb + 8}
                  onMouseEnter={(e) => {
                    setHover(i)
                    tip.show(tipFor(m), e.clientX, e.clientY)
                  }}
                  onMouseMove={(e) => tip.show(tipFor(m), e.clientX, e.clientY)}
                  onMouseLeave={() => {
                    setHover(-1)
                    tip.hide()
                  }}
                  onClick={() => onMonth(m.month)}
                />
              </g>
            )
          })}

          <line x1={pl} x2={x2} y1={z} y2={z} stroke={C.line} />
          {averages.moneyIn !== null && (
            <line x1={pl} x2={x2} y1={z - averages.moneyIn * k} y2={z - averages.moneyIn * k} stroke={C.ink2} strokeDasharray="4 3" pointerEvents="none" />
          )}
          {averages.moneyOut !== null && (
            <line x1={pl} x2={x2} y1={z + averages.moneyOut * k} y2={z + averages.moneyOut * k} stroke={C.ink2} strokeDasharray="4 3" pointerEvents="none" />
          )}
          {gutter.map((g, i) => (
            <g key={g.key} pointerEvents="none">
              <text x={x2 + 8} y={gutterY[i] - 2} className="cf-ax">
                {g.label}
              </text>
              <text x={x2 + 8} y={gutterY[i] + 12} className="cf-ax" style={{ fill: C.ink, fontWeight: g.key === 'net' ? 600 : 500 }}>
                {g.value}
              </text>
            </g>
          ))}
          <text x={pl - 8} y={z - 13} textAnchor="end" className="cf-ax" style={{ fontWeight: 500, fill: C.ink2 }}>
            ▲ In
          </text>
          <text x={pl - 8} y={z + 24} textAnchor="end" className="cf-ax" style={{ fontWeight: 500, fill: C.ink2 }}>
            ▼ Out
          </text>
        </svg>
      )}
      {tip.node}
    </div>
  )
}

/** Centred above the partial bar, or right-aligned to its band when centring would run into the label gutter. */
function ToDate({ cx, edge, gutter, y, days }: { cx: number; edge: number; gutter: number; y: number; days: string }) {
  const centred = cx + 32 <= gutter - 4
  const x = centred ? cx : edge
  const anchor = centred ? 'middle' : 'end'
  const halo = { paintOrder: 'stroke' as const, stroke: C.surface, strokeWidth: 4, strokeLinejoin: 'round' as const }
  return (
    <g pointerEvents="none">
      <text x={x} y={y - 24} textAnchor={anchor} style={{ font: '500 11.5px var(--font-sans)', fill: C.accent, ...halo }}>
        To date
      </text>
      <text x={x} y={y - 10} textAnchor={anchor} className="cf-ax" style={{ fontSize: 11, ...halo }}>
        {days}
      </text>
    </g>
  )
}
