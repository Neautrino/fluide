import { useId, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import type { CashFlow, CashFlowFilter } from '../../lib/api'
import { GROUPS, orderSources, orderTargets, ribbonEnds, stackTargets, type Group, type Source, type Target } from './sankey-layout'
import {
  C,
  HatchDefs,
  money,
  moneyParts,
  percent,
  spread,
  svgButton,
  useTooltip,
  useWidth,
  type CfSelect,
  type TipContent,
} from './shared'

type SankeyData = CashFlow['sankey']

type Props = {
  sankey: SankeyData
  currency: string
  hidden?: boolean
  onSelect: CfSelect
  height?: number
}

const GROUP_LABEL: Record<Group, string> = { spending: 'Spending', debt: 'Debt payments', kept: 'Kept' }
const GROUP_TOKEN: Record<Group, CashFlowFilter | null> = { spending: 'spending', debt: 'debt', kept: null }
const GROUP_COLOUR: Record<Group, string> = { spending: C.out, debt: C.out, kept: C.in }

function sourceToken(s: Source): CashFlowFilter | null {
  if (s.kind === 'payer') return `source:${s.label}`
  if (s.kind === 'from_balance') return null
  return s.kind
}

function targetToken(t: Target): CashFlowFilter | null {
  switch (t.kind) {
    case 'category':
      return `category:${t.label}`
    case 'other_categories':
      return 'other_categories'
    case 'debt_payments':
      return 'debt'
    case 'invested':
      return 'notcounted:invested'
    case 'savings':
      return 'notcounted:savings'
    case 'stayed_in_cash':
      return null
  }
}

function targetSub(t: Target): string | null {
  if (t.kind === 'other_categories' && t.otherCount) return `${t.otherCount} categories`
  return t.fromBank ? 'from bank' : null
}

function incomeTotal(sources: Source[]): number {
  return sources.reduce((sum, s) => (s.kind === 'from_balance' ? sum : sum + s.amount), 0)
}

/** Targets are shares of money in, unless a deficit drew on balances: then of the whole trunk, so they never pass 100%. */
function targetShare(sankey: SankeyData, inTotal: number): { base: number; label: string } {
  return sankey.moneyIn - inTotal > 0.005 ? { base: sankey.moneyIn, label: 'of the total' } : { base: inTotal, label: 'of money in' }
}

function band(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const c = (x1 - x0) * 0.5
  return `M${x0},${y0}C${x0 + c},${y0} ${x1 - c},${y1} ${x1},${y1}L${x1},${y1 + w}C${x1 - c},${y1 + w} ${x0 + c},${y0 + w} ${x0},${y0 + w}Z`
}

function Amt({ value, currency, hidden, className }: { value: number; currency: string; hidden: boolean; className?: string }) {
  const { whole, cents } = moneyParts(value, currency, hidden)
  return (
    <tspan className={className}>
      {whole}
      {cents && <tspan style={{ fill: C.ink3 }}>{cents}</tspan>}
    </tspan>
  )
}

export function Sankey({ sankey, currency, hidden = false, onSelect, height = 480 }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)
  const tip = useTooltip()
  const uid = useId().replace(/:/g, '')

  const sources = orderSources(sankey.sources)
  const targets = orderTargets(sankey.targets)
  const total = sankey.moneyIn
  const inTotal = incomeTotal(sources)
  const fromBalance = total - inTotal
  const share = targetShare(sankey, inTotal)

  if (!(total > 0) || sources.length === 0 || targets.length === 0) return <div ref={ref} />

  const fmt = (v: number) => money(v, currency, { hidden })
  const H = height
  const top = 48
  const avail = H - top - 10
  const g = 12
  const G = 36
  const nw = 8
  const mw = 10
  const R = W < 720 ? Math.max(200, Math.round(W * 0.45)) : 290
  const rx = W - R
  const mx = Math.round(rx * 0.54)
  const groupsUsed = GROUPS.filter((gr) => targets.some((t) => t.group === gr))
  const { k, nodes: tLayout } = stackTargets(targets, top, avail, { gap: g, groupGap: G, pitch: 20 })
  const lastNode = tLayout[tLayout.length - 1]
  const mh = total * k
  const my = top + (lastNode.y + lastNode.h - top - mh) / 2

  const sh = sources.map((s) => Math.max(s.amount * k, 3))
  const sumSh = sh.reduce((a, b) => a + b, 0)
  const lgap = sources.length > 1 ? (avail - sumSh) / (sources.length - 1) : 0
  let y = sources.length > 1 ? top : top + (avail - sumSh) / 2
  const sLayout = sources.map((_, i) => {
    const box = { y, h: sh[i] }
    y += sh[i] + lgap
    return box
  })
  const sEnds = ribbonEnds(sources.map((s) => s.amount), sLayout, my, k)
  const tEnds = ribbonEnds(targets.map((t) => t.amount), tLayout, my, k)

  const select = (token: CashFlowFilter | null, label: string, amount: number) => {
    if (token) onSelect(token, label, amount)
  }
  const hover = (key: string, content: TipContent) => ({
    onMouseEnter: (e: MouseEvent) => {
      setActive(key)
      tip.show(content, e.clientX, e.clientY)
    },
    onMouseMove: (e: MouseEvent) => tip.show(content, e.clientX, e.clientY),
    onMouseLeave: () => {
      setActive(null)
      tip.hide()
    },
  })
  const focus = (key: string, content: TipContent) => ({
    onFocus: (e: FocusEvent<SVGElement>) => {
      setActive(key)
      const r = e.currentTarget.getBoundingClientRect()
      tip.show(content, r.left + r.width / 2, r.top + r.height / 2)
    },
    onBlur: () => {
      setActive(null)
      tip.hide()
    },
  })
  const on = (key: string) => (active === key ? ' on' : '')
  const buttonProps = (token: CashFlowFilter | null, aria: string, label: string, amount: number) =>
    token
      ? svgButton(`${aria}. Show transactions`, () => onSelect(token, label, amount))
      : { role: 'img' as const, tabIndex: 0, 'aria-label': aria }

  const sourceTips = sources.map<TipContent>((s) =>
    s.kind === 'from_balance'
      ? {
          title: `${s.label} → Money out`,
          rows: [{ swatch: C.line, label: 'Drawn from balance', value: fmt(s.amount), total: true }],
          note: 'More went out than came in this month.',
        }
      : {
          title: `${s.label} → Money in`,
          rows: [
            { swatch: C.in, label: 'Came in', value: money(s.amount, currency, { hidden, sign: 'always' }), total: true },
            { label: 'Share of money in', value: percent(s.amount, inTotal, s.amount / inTotal < 0.001 ? 2 : 1) },
          ],
        },
  )
  const targetTips = targets.map<TipContent>((t) => {
    const sub = targetSub(t)
    return {
      title: `Money in → ${t.label}${sub ? ` (${sub})` : ''}`,
      rows: [
        { swatch: GROUP_COLOUR[t.group], label: 'Amount', value: fmt(t.amount), total: true },
        { label: `Share ${share.label}`, value: percent(t.amount, share.base) },
      ],
    }
  })

  const ribbons: ReactNode[] = []
  sources.forEach((s, i) => {
    const e = sEnds[i]
    const token = sourceToken(s)
    ribbons.push(
      <path
        key={`s${i}`}
        className={`cf-rib${token ? '' : ' static'}${on(`s${i}`)}`}
        d={band(nw, e.node, mx, e.trunk, e.w)}
        {...buttonProps(token, `${s.label}: ${fmt(s.amount)} came in, ${percent(s.amount, inTotal)} of money in`, s.label, s.amount)}
        {...hover(`s${i}`, sourceTips[i])}
        {...focus(`s${i}`, sourceTips[i])}
      />,
    )
  })
  // Largest drawn first so small ribbons stay on top; geometry comes from layout order (tEnds).
  const byAmount = targets.map((t, i) => ({ t, i })).sort((a, b) => b.t.amount - a.t.amount)
  for (const { t, i } of byAmount) {
    const e = tEnds[i]
    const token = targetToken(t)
    ribbons.push(
      <path
        key={`t${i}`}
        className={`cf-rib ${t.group === 'kept' ? 'kept' : 'spend'}${token ? '' : ' static'}${on(`t${i}`)}`}
        d={band(mx + mw, e.trunk, rx, e.node, e.w)}
        {...buttonProps(token, `${t.label}: ${fmt(t.amount)}, ${percent(t.amount, share.base)} ${share.label}`, t.label, t.amount)}
        {...hover(`t${i}`, targetTips[i])}
        {...focus(`t${i}`, targetTips[i])}
      />,
    )
  }

  const labelW = (text: string) => text.length * 7.2
  const maxLabelChars = Math.max(6, Math.floor(((mx + rx) / 2 - nw - 12 - 40) / 7.2))
  const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
  const sBoxes = sources.map((s, i) => {
    const small = sLayout[i].h < 16
    const name = clip(s.label, maxLabelChars)
    const subW = s.kind === 'from_balance' ? 0 : moneyParts(s.amount, currency, hidden).whole.length * 6.6 + 48
    return { small, name, ch: small ? 28 : 40, cw: small ? labelW(name) + 92 : Math.max(labelW(name), subW) + 24 }
  })
  const sCentres = spread(
    sLayout.map((L) => L.y + L.h / 2),
    (i) => (sBoxes[i].ch + sBoxes[i - 1].ch) / 2 + 4,
    top - 8 + sBoxes[0].ch / 2,
    H - 1 - sBoxes[sBoxes.length - 1].ch / 2,
  )

  const tx = rx + nw + 16
  const amtX = W - 56
  const maxTargetChars = Math.max(8, Math.floor((amtX - tx - 75) / 7))
  const rightItems = targets.flatMap((t, i) => {
    const L = tLayout[i]
    const row = { head: false, i, y: L.y + L.h / 2 }
    return i === 0 || targets[i - 1].group !== t.group ? [{ head: true, i, y: L.y - 16 }, row] : [row]
  })
  const rightY = spread(
    rightItems.map((r) => r.y),
    (j) => (rightItems[j].head ? 22 : 18),
    10,
    H - 8,
  )
  const ly: number[] = []
  const headY: number[] = []
  rightItems.forEach((r, j) => ((r.head ? headY : ly)[r.i] = rightY[j]))

  const groupTotals = Object.fromEntries(
    GROUPS.map((gr) => [gr, targets.filter((t) => t.group === gr).reduce((a, t) => a + t.amount, 0)]),
  ) as Record<Group, number>

  const summary = `Where your money went: ${fmt(inTotal)} came in from ${sources.length} source${
    sources.length === 1 ? '' : 's'
  }${fromBalance > 0.005 ? ` plus ${fmt(fromBalance)} from your balance` : ''}; ${groupsUsed
    .map((gr) => `${GROUP_LABEL[gr].toLowerCase()} ${fmt(groupTotals[gr])}`)
    .join(', ')}.`

  return (
    <div ref={ref} className={`cf-sankey${active ? ' iso' : ''}`}>
      {W > 0 && (
        <svg className="cf-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={summary}>
          <HatchDefs id={uid} />
          <g className="cf-rv" style={{ mixBlendMode: 'multiply' }}>
            {ribbons}
          </g>
          {sources.map((s, i) =>
            s.kind === 'from_balance' ? (
              <rect
                key={i}
                x={0.75}
                y={sLayout[i].y}
                width={nw - 1.5}
                height={sLayout[i].h}
                rx={2}
                fill={`url(#${uid}-no)`}
                stroke={C.line}
                strokeWidth={1.5}
              />
            ) : (
              <rect key={i} x={0} y={sLayout[i].y} width={nw} height={sLayout[i].h} rx={2} fill={C.ink} />
            ),
          )}
          <rect x={mx} y={my} width={mw} height={mh} rx={2} fill={C.ink} />
          <text x={mx + mw / 2} y={my - 32} textAnchor="middle" className="cf-sk-grp">
            MONEY IN
          </text>
          <text
            x={mx + mw / 2}
            y={my - 12}
            textAnchor="middle"
            className="cf-lnk cf-sk-in"
            style={{ font: '400 20px var(--font-display)' }}
            {...buttonProps('in', `Money in: ${fmt(inTotal)}`, 'Money in', inTotal)}
          >
            <MiddleAmount value={inTotal} currency={currency} hidden={hidden} />
          </text>

          {sources.map((s, i) => {
            const b = sBoxes[i]
            const cy = sCentres[i] - b.ch / 2
            const token = sourceToken(s)
            return (
              <g
                key={i}
                className={`cf-sk-lab${on(`s${i}`)}`}
                style={token ? { cursor: 'pointer' } : undefined}
                onClick={() => select(token, s.label, s.amount)}
                {...hover(`s${i}`, sourceTips[i])}
              >
                <rect x={nw + 12} y={cy} width={b.cw} height={b.ch} rx={4} fill={C.surface} fillOpacity={0.9} stroke={C.rule} />
                {b.small ? (
                  <text x={nw + 24} y={cy + 18} className="cf-sk-name" style={{ fill: C.ink }}>
                    {b.name}
                    {'  '}
                    <Amt value={s.amount} currency={currency} hidden={hidden} className="cf-sk-amt" />
                  </text>
                ) : (
                  <>
                    <text x={nw + 24} y={cy + 17} className="cf-sk-name" style={{ fill: C.ink }}>
                      {b.name}
                    </text>
                    <text x={nw + 24} y={cy + 32} className="cf-sk-sub">
                      <Amt value={s.amount} currency={currency} hidden={hidden} />
                      {s.kind === 'from_balance' ? '' : ` · ${percent(s.amount, inTotal, 0)}`}
                    </text>
                  </>
                )}
                {b.name !== s.label && <title>{s.label}</title>}
              </g>
            )
          })}

          {targets.map((t, i) => {
            const L = tLayout[i]
            const first = i === 0 || targets[i - 1].group !== t.group
            const token = targetToken(t)
            const sub = targetSub(t)
            const name = clip(t.label, maxTargetChars)
            const gToken = GROUP_TOKEN[t.group]
            return (
              <g key={i}>
                {first && (
                  <text
                    x={tx}
                    y={headY[i] + 4}
                    className={`cf-sk-grp${gToken ? ' cf-lnk' : ''}`}
                    {...(gToken
                      ? buttonProps(gToken, `${GROUP_LABEL[t.group]}: ${fmt(groupTotals[t.group])}`, GROUP_LABEL[t.group], groupTotals[t.group])
                      : {})}
                  >
                    {GROUP_LABEL[t.group].toUpperCase()} · {fmt(groupTotals[t.group])}
                  </text>
                )}
                <g
                  className={`cf-sk-lab cf-sk-node${on(`t${i}`)}`}
                  style={token ? { cursor: 'pointer' } : undefined}
                  onClick={() => select(token, t.label, t.amount)}
                  {...hover(`t${i}`, targetTips[i])}
                >
                  <rect x={rx} y={L.y} width={nw} height={L.h} rx={2} fill={GROUP_COLOUR[t.group]} />
                  <text x={tx} y={ly[i] + 4} className="cf-sk-name">
                    {name}
                    {sub && t.kind === 'other_categories' && <tspan className="cf-sk-sub"> ({sub})</tspan>}
                    {name !== t.label && <title>{t.label}</title>}
                  </text>
                  <text x={amtX} y={ly[i] + 4} textAnchor="end" className="cf-sk-amt">
                    <Amt value={t.amount} currency={currency} hidden={hidden} />
                  </text>
                  <text x={W} y={ly[i] + 4} textAnchor="end" className="cf-sk-pct">
                    {percent(t.amount, share.base, 0)}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}
      {tip.node}
    </div>
  )
}

function MiddleAmount({ value, currency, hidden }: { value: number; currency: string; hidden: boolean }) {
  const { whole, cents } = moneyParts(value, currency, hidden)
  return (
    <>
      {whole}
      {cents && <tspan style={{ fill: C.ink3, fontSize: 13 }}>{cents}</tspan>}
    </>
  )
}

type TableProps = { sankey: SankeyData; currency: string; hidden?: boolean; onSelect: CfSelect }

/** Flow | Table toggle: the accessible equivalent of the Sankey, same tokens and figures. */
export function SankeyTable({ sankey, currency, hidden = false, onSelect }: TableProps) {
  const sources = orderSources(sankey.sources)
  const targets = orderTargets(sankey.targets)
  const inTotal = incomeTotal(sources)
  const share = targetShare(sankey, inTotal)
  const fmt = (v: number) => money(v, currency, { hidden })
  const cell = (token: CashFlowFilter | null, label: string, amount: number) =>
    token ? (
      <button type="button" className="cf-lnk" onClick={() => onSelect(token, label, amount)} aria-label={`${label}: ${fmt(amount)}. Show transactions`}>
        {fmt(amount)}
      </button>
    ) : (
      fmt(amount)
    )

  return (
    <div className="cf-sktable">
      <div>
        <table>
          <thead>
            <tr>
              <th>Came in</th>
              <th className="r">Amount</th>
              <th className="r">Share</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td className="r">{cell(sourceToken(s), s.label, s.amount)}</td>
                <td className="r">{s.kind === 'from_balance' ? '—' : percent(s.amount, inTotal)}</td>
              </tr>
            ))}
            <tr className="grp">
              <td>Money in</td>
              <td className="r">{cell('in', 'Money in', inTotal)}</td>
              <td className="r">{inTotal > 0 ? '100.0%' : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>Went to</th>
              <th className="r">Amount</th>
              <th className="r">Share {share.label}</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((gr) => {
              const members = targets.filter((t) => t.group === gr)
              if (members.length === 0) return null
              const sum = members.reduce((a, t) => a + t.amount, 0)
              return [
                <tr key={gr} className="grp">
                  <td>{GROUP_LABEL[gr]}</td>
                  <td className="r">{cell(GROUP_TOKEN[gr], GROUP_LABEL[gr], sum)}</td>
                  <td className="r">{percent(sum, share.base)}</td>
                </tr>,
                ...(members.length > 1 || members[0].label !== GROUP_LABEL[gr]
                  ? members.map((t) => {
                      const sub = targetSub(t)
                      return (
                        <tr key={t.id}>
                          <td className="sub">
                            {t.label}
                            {sub && t.kind === 'other_categories' ? ` (${sub})` : ''}
                          </td>
                          <td className="r">{cell(targetToken(t), t.label, t.amount)}</td>
                          <td className="r">{percent(t.amount, share.base)}</td>
                        </tr>
                      )
                    })
                  : []),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
