import { useState, type KeyboardEvent } from 'react'
import type { CashFlow } from '../../types'
import {
  C,
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
  /** The month the page is showing; drawn in full colour, the rest muted. */
  month: string
  onMonth: (month: string) => void
  height?: number
}

function bar(x: number, z: number, h: number, w: number, up: boolean): string {
  const r = Math.min(2, h)
  return up
    ? `M${x},${z}V${z - h + r}Q${x},${z - h} ${x + r},${z - h}H${x + w - r}Q${x + w},${z - h} ${x + w},${z - h + r}V${z}Z`
    : `M${x},${z}V${z + h - r}Q${x},${z + h} ${x + r},${z + h}H${x + w - r}Q${x + w},${z + h} ${x + w},${z + h - r}V${z}Z`
}

export function MonthBars({ months, averages, currency, daysElapsed, month, onMonth, height = 280 }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const tip = useTooltip()
  const [hover, setHover] = useState(-1)
  const n = months.length
  const selected = Math.max(0, months.findIndex((m) => m.month === month))
  const [kbState, setKbIdx] = useState<number | null>(null)
  const kbIdx = Math.min(kbState ?? selected, n - 1)

  const H = height
  const pl = 44
  const pr = 88
  const pt = 34
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
  const w = Math.max(4, Math.round(bw * 0.62))
  const avgKept = averages.moneyIn !== null && averages.moneyOut !== null ? averages.moneyIn - averages.moneyOut : null

  const fmt = (v: number, sign: 'auto' | 'always' | 'never' = 'never') => money(v, currency, { sign })
  const whole = (v: number, sign: 'auto' | 'always' | 'never' = 'never') => money(v, currency, { sign, whole: true })

  const tipFor = (m: Month): TipContent => {
    const rows: TipContent['rows'] = [
      { swatch: C.in, label: '▲ Money in', value: fmt(m.moneyIn, 'always') },
      { swatch: C.out, label: '▼ Money out', value: fmt(-m.moneyOut, 'auto') },
      { label: m.net >= 0 ? 'Kept' : 'Deficit', value: fmt(m.net, 'always'), total: true },
    ]
    if (avgKept !== null) rows.push({ label: 'vs chart avg kept', value: whole(m.net - avgKept, 'always') })
    return { title: `${monthYear(m.month)}${m.partial ? ` · 1–${daysElapsed}, to date` : ''}`, rows }
  }

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
  for (let v = step; v <= top + 1e-9; v += step) ticks.push({ v, label: `+${compactMoney(v, currency)}` })
  for (let v = step; v <= bottom + 1e-9; v += step) ticks.push({ v: -v, label: compactMoney(-v, currency) })

  const gutter = [
    ...(averages.moneyIn === null ? [] : [{ key: 'in', y: z - averages.moneyIn * k, label: 'Chart avg in', value: whole(averages.moneyIn) }]),
    ...(averages.moneyOut === null ? [] : [{ key: 'out', y: z + averages.moneyOut * k, label: 'Chart avg out', value: whole(averages.moneyOut) }]),
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
            setKbIdx(null)
            setHover(-1)
            tip.hide()
          }}
        >
          {ticks.map((t) => (
            <g key={t.v}>
              <line x1={pl} x2={x2} y1={z - t.v * k} y2={z - t.v * k} stroke={C.grid} />
              <text x={pl - 8} y={z - t.v * k + 4} textAnchor="end" className="cf-ax amt">
                {t.label}
              </text>
            </g>
          ))}
          <text x={pl - 8} y={z + 4} textAnchor="end" className="cf-ax amt">
            {compactMoney(0, currency)}
          </text>

          {months.map((m, i) => {
            const cx = pl + bw * (i + 0.5)
            const x = cx - w / 2
            const on = i === selected
            const hi = m.moneyIn * k
            const ho = m.moneyOut * k
            const delay = { animationDelay: `${100 + i * 20}ms` }
            const yearLabel = i === 0 || m.month.endsWith('-01')
            return (
              <g key={m.month}>
                <rect className={`cf-band${hover === i ? ' on' : ''}`} x={cx - bw / 2} y={pt - 8} width={bw} height={H - pt - pb + 8} rx={4} />
                <path className="cf-gu" style={delay} d={bar(x, z, hi, w, true)} fill={on ? C.in : C.muted} />
                <path className="cf-gd" style={delay} d={bar(x, z, ho, w, false)} fill={on ? C.out : C.muted} />
                {m.partial && (
                  <g pointerEvents="none">
                    <rect x={cx - 23} y={z - hi - 26} width={46} height={18} rx={9} fill={C.ink} />
                    <text x={cx} y={z - hi - 14} textAnchor="middle" style={{ font: '700 10.5px var(--font-sans)', fill: 'var(--ink-inverse)' }}>
                      so far
                    </text>
                  </g>
                )}
                {on && <rect x={cx - 20} y={H - pb + 6} width={40} height={20} rx={10} fill={C.ink} />}
                <text
                  x={cx}
                  y={H - pb + 20}
                  textAnchor="middle"
                  className="cf-ax"
                  style={on ? { fill: 'var(--ink-inverse)', fontWeight: 700 } : undefined}
                >
                  {shortMonth(m.month)}
                </text>
                {yearLabel && (
                  <text x={cx} y={H - pb + 38} textAnchor="middle" className="cf-ax">
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

          <line x1={pl} x2={x2} y1={z} y2={z} stroke={C.ink} strokeOpacity={0.35} />
          {averages.moneyIn !== null && (
            <line x1={pl} x2={x2} y1={z - averages.moneyIn * k} y2={z - averages.moneyIn * k} stroke={C.ink} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" pointerEvents="none" />
          )}
          {averages.moneyOut !== null && (
            <line x1={pl} x2={x2} y1={z + averages.moneyOut * k} y2={z + averages.moneyOut * k} stroke={C.ink} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" pointerEvents="none" />
          )}
          {gutter.map((g, i) => (
            <g key={g.key} pointerEvents="none">
              <text x={x2 + 8} y={gutterY[i] - 2} className="cf-ax">
                {g.label}
              </text>
              <text x={x2 + 8} y={gutterY[i] + 12} className="cf-ax amt" style={{ fill: C.ink, fontWeight: 600 }}>
                {g.value}
              </text>
            </g>
          ))}
          <text x={pl - 8} y={z - 13} textAnchor="end" className="cf-ax" style={{ fontWeight: 600, fill: C.ink2 }}>
            ▲ In
          </text>
          <text x={pl - 8} y={z + 24} textAnchor="end" className="cf-ax" style={{ fontWeight: 600, fill: C.ink2 }}>
            ▼ Out
          </text>
        </svg>
      )}
      {tip.node}
    </div>
  )
}
