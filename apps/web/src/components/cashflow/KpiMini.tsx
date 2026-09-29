import { useId, type ReactNode } from 'react'
import type { CashFlow } from '../../lib/api'
import { C, HatchDefs, MINUS, money, monthYear, shortMonth, useTooltip, useWidth, type TipContent } from './shared'

type Kind = 'in' | 'out' | 'kept' | 'rate'

type Props = {
  kind: Kind
  /** All of `CashFlow.months`; the last six are drawn, the selected month at the right. */
  months: CashFlow['months']
  averages?: CashFlow['averages']
  currency: string
  daysElapsed?: number
  hidden?: boolean
}

const H = 64
const PILL = 12
const SLOTS = 6

function pillUp(x: number, b: number, h: number, w: number): string {
  h = Math.max(h, w)
  return `M${x},${b}V${b - h + w / 2}A${w / 2},${w / 2} 0 0 1 ${x + w},${b - h + w / 2}V${b}Z`
}
function pillDn(x: number, b: number, h: number, w: number): string {
  h = Math.max(h, w)
  return `M${x},${b}V${b + h - w / 2}A${w / 2},${w / 2} 0 0 0 ${x + w},${b + h - w / 2}V${b}Z`
}
/** Solid round head at the value end of a pale past pill. */
function capUp(x: number, b: number, h: number, w: number): string {
  h = Math.max(h, w)
  const y = b - h + w / 2
  return `M${x},${y + 2}V${y}A${w / 2},${w / 2} 0 0 1 ${x + w},${y}V${y + 2}Z`
}
function capDn(x: number, b: number, h: number, w: number): string {
  h = Math.max(h, w)
  const y = b + h - w / 2
  return `M${x},${y - 2}V${y}A${w / 2},${w / 2} 0 0 0 ${x + w},${y}V${y - 2}Z`
}

type PillStyle = 'past' | 'hatched' | 'solid'

function Pill({ x, b, h, up, tone, style, uid, delay }: { x: number; b: number; h: number; up: boolean; tone: 'in' | 'out'; style: PillStyle; uid: string; delay: number }) {
  if (!(h > 0)) return null
  const d = (up ? pillUp : pillDn)(x, b, h, PILL)
  const colour = tone === 'in' ? C.in : C.out
  const cls = up ? 'cf-gu' : 'cf-gd'
  const anim = { animationDelay: `${delay}ms` }
  if (style === 'hatched') return <path className={cls} style={anim} d={d} fill={`url(#${uid}-${tone})`} stroke={colour} strokeWidth={1.5} />
  if (style === 'solid') return <path className={cls} style={anim} d={d} fill={colour} />
  return (
    <g className={cls} style={anim}>
      <path d={d} fill={tone === 'in' ? C.inTint : C.outTint} />
      <path d={(up ? capUp : capDn)(x, b, h, PILL)} fill={colour} />
    </g>
  )
}

function Ghost({ x, b, h, up, tone }: { x: number; b: number; h: number; up: boolean; tone: 'in' | 'out' }) {
  if (!(h > 0)) return null
  return <path d={(up ? pillUp : pillDn)(x + 0.5, b, h, PILL - 1)} fill="none" stroke={tone === 'in' ? C.in : C.out} strokeWidth={1} />
}

const LABEL: Record<Kind, string> = { in: 'Money in', out: 'Money out', kept: 'Kept', rate: 'Savings rate' }

export function KpiMini({ kind, months, averages, currency, daysElapsed, hidden = false }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const STEP = W / SLOTS
  const uid = useId().replace(/:/g, '')
  const tip = useTooltip()
  const list = months.slice(-SLOTS)
  const offset = SLOTS - list.length
  const fmt = (v: number, sign: 'auto' | 'always' | 'never' = 'never') => money(v, currency, { hidden, sign })
  const avgKept = averages && averages.moneyIn !== null && averages.moneyOut !== null ? averages.moneyIn - averages.moneyOut : null
  const avgRate = avgKept !== null && averages?.moneyIn ? avgKept / averages.moneyIn : null
  const rate = (m: CashFlow['months'][number]) => (m.moneyIn > 0 ? m.net / m.moneyIn : null)

  const flowMax = Math.max(1, ...list.map((m) => Math.max(m.moneyIn, m.moneyOut)))
  const signed = kind === 'rate' ? list.map((m) => rate(m) ?? 0) : list.map((m) => m.net)
  const pos = Math.max(0, ...signed)
  const neg = Math.max(0, ...signed.map((v) => -v))
  const span = kind === 'rate' ? Math.max(pos + neg, 0.1) : Math.max(pos + neg, 1)
  const room = kind === 'rate' ? 30 : 38
  const b = kind === 'in' ? 28 : kind === 'out' ? 20 : neg > 0 ? 4 + ((room + 2) * pos) / span : 44
  const scale = kind === 'in' || kind === 'out' ? 24 / flowMax : (neg > 0 ? room + 2 : room) / span

  const tipFor = (m: CashFlow['months'][number]): TipContent => {
    const title = `${monthYear(m.month)}${m.partial && daysElapsed ? ` · 1–${daysElapsed}, to date` : ''}`
    if (kind === 'in' || kind === 'out')
      return {
        title,
        rows: [
          { swatch: C.in, label: '▲ Money in', value: fmt(m.moneyIn, 'always') },
          { swatch: C.out, label: '▼ Money out', value: fmt(-m.moneyOut, 'auto') },
          { label: m.net >= 0 ? 'Kept' : 'Deficit', value: fmt(m.net, 'always'), total: true },
        ],
      }
    if (kind === 'kept')
      return {
        title,
        rows: [
          { swatch: m.net >= 0 ? C.in : C.out, label: m.net >= 0 ? 'Kept' : 'Deficit', value: fmt(m.net, 'always'), total: true },
          ...(avgKept === null ? [] : [{ label: `vs chart avg ${fmt(avgKept, 'auto')}`, value: fmt(m.net - avgKept, 'always') }]),
        ],
      }
    const r = rate(m)
    return {
      title,
      rows: [
        { swatch: C.in, label: 'Savings rate', value: r === null ? '—' : `${(r * 100).toFixed(1)}%`, total: true },
        ...(r === null || avgRate === null
          ? []
          : [
              {
                label: `vs chart avg ${(avgRate * 100).toFixed(1)}%`,
                value: `${r - avgRate >= 0 ? '+' : MINUS}${Math.abs((r - avgRate) * 100).toFixed(1)} pts`,
              },
            ]),
      ],
    }
  }

  const items: ReactNode[] = list.map((m, j) => {
    const i = offset + j
    const cx = STEP * (i + 0.5)
    const x = cx - PILL / 2
    const last = j === list.length - 1
    const style: PillStyle = last ? (m.partial ? 'hatched' : 'solid') : 'past'
    const delay = 150 + i * 20
    let marks: ReactNode = null
    if (kind === 'in')
      marks = (
        <>
          <Pill x={x} b={b} h={m.moneyIn * scale} up tone="in" style={style} uid={uid} delay={delay} />
          <Ghost x={x} b={b} h={m.moneyOut * scale * 0.5} up={false} tone="out" />
        </>
      )
    else if (kind === 'out')
      marks = (
        <>
          <Ghost x={x} b={b} h={m.moneyIn * scale * 0.5} up tone="in" />
          <Pill x={x} b={b} h={m.moneyOut * scale} up={false} tone="out" style={style} uid={uid} delay={delay} />
        </>
      )
    else if (kind === 'kept')
      marks = <Pill x={x} b={b} h={Math.abs(m.net) * scale} up={m.net >= 0} tone={m.net >= 0 ? 'in' : 'out'} style={style} uid={uid} delay={delay} />
    else {
      const r = rate(m)
      if (r !== null) {
        const y = b - r * scale
        const colour = last ? (r >= 0 ? C.in : C.out) : C.ink3
        marks = (
          <>
            <line x1={cx} x2={cx} y1={b} y2={y} stroke={colour} strokeWidth={1.5} />
            <circle cx={cx} cy={y} r={last ? 4.5 : 3.5} fill={last ? colour : C.surface} stroke={colour} strokeWidth={1.5} />
          </>
        )
      }
    }
    return (
      <g key={m.month}>
        {marks}
        <text x={cx} y={H - 2} textAnchor="middle" className="cf-ax" style={last ? { fontSize: 11, fill: C.ink, fontWeight: 600 } : { fontSize: 11 }}>
          {shortMonth(m.month)}
        </text>
        <rect
          className="cf-hit"
          style={{ cursor: 'default' }}
          x={cx - STEP / 2}
          y={0}
          width={STEP}
          height={H}
          onMouseEnter={(e) => tip.show(tipFor(m), e.clientX, e.clientY)}
          onMouseMove={(e) => tip.show(tipFor(m), e.clientX, e.clientY)}
          onMouseLeave={tip.hide}
        />
      </g>
    )
  })

  const described = list
    .map((m) => {
      if (kind === 'rate') {
        const r = rate(m)
        return `${shortMonth(m.month)} ${r === null ? 'none' : `${r < 0 ? MINUS : ''}${Math.abs(r * 100).toFixed(1)}%`}`
      }
      const v = kind === 'in' ? m.moneyIn : kind === 'out' ? m.moneyOut : m.net
      return `${shortMonth(m.month)} ${fmt(v, kind === 'kept' ? 'auto' : 'never')}`
    })
    .join(', ')
  const range = list.length ? `${monthYear(list[0].month)} to ${monthYear(list[list.length - 1].month)}` : ''

  return (
    <div ref={ref} style={{ height: H }}>
      {W > 0 && (
        <svg className="cf-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${LABEL[kind]}, ${range}: ${described}`}>
          <HatchDefs id={uid} />
          <line x1={0} x2={W} y1={b} y2={b} stroke={C.line} />
          {items}
        </svg>
      )}
      {tip.node}
    </div>
  )
}
