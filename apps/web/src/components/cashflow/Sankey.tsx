import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import type { CashFlow, CashFlowFilter } from '../../lib/api'
import {
  AMOUNT_HIDDEN,
  Amt,
  DrillButton,
  Figure,
  money,
  moneyParts,
  percent,
  spread,
  svgButton,
  useTooltip,
  useWidth,
  type CfSelect,
  type TipContent,
} from '@repo/ui/cashflow'
import { GROUPS, orderSources, orderTargets, ribbonEnds, stackTargets, type Group, type Source, type Target } from './sankey-layout'
import './sankey.css'

type SankeyData = CashFlow['sankey']

type Props = {
  sankey: SankeyData
  currency: string
  /** Only affects the text CSS can't blur (aria-labels); the amounts on screen are blurred by `amt`. */
  hidden?: boolean
  /** Label of the category that grew most against the baseline; drawn in ink. */
  mover?: string | null
  onSelect: CfSelect
  height?: number
}

const GROUP_LABEL: Record<Group, string> = { spending: 'Spending', debt: 'Debt payments', kept: 'Kept' }
const GROUP_TOKEN: Record<Group, CashFlowFilter | null> = { spending: 'spending', debt: 'debt', kept: null }
const GROUP_SWATCH: Record<Group, string> = { spending: 'var(--chart-muted)', debt: 'var(--chart-muted)', kept: 'var(--tile-2)' }

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

type AmountTextProps = {
  value: number
  currency: string
  x: number
  y: number
  anchor?: 'start' | 'end' | 'middle'
  className: string
}

/** One SVG `<text>` per amount so the `amt` blur covers exactly the figure. */
function AmountText({ value, currency, x, y, anchor = 'start', className }: AmountTextProps) {
  const { whole, cents } = moneyParts(value, currency)
  return (
    <text x={x} y={y} textAnchor={anchor} className={`amt ${className}`}>
      {whole}
      {cents && <tspan className="cf-sk-cents">{cents}</tspan>}
    </text>
  )
}

export function Sankey({ sankey, currency, hidden = false, mover = null, onSelect, height = 480 }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)
  const tip = useTooltip()

  const sources = orderSources(sankey.sources)
  const targets = orderTargets(sankey.targets)
  const total = sankey.moneyIn
  const inTotal = incomeTotal(sources)
  const fromBalance = total - inTotal
  const share = targetShare(sankey, inTotal)

  if (!(total > 0) || sources.length === 0 || targets.length === 0) return <div ref={ref} />

  const fmt = (v: number) => money(v, currency)
  const fmtLabel = (v: number) => (hidden ? AMOUNT_HIDDEN : fmt(v))
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
  const y0 = sources.length > 1 ? top : top + (avail - sumSh) / 2
  const sLayout = sources.map((_, i) => ({ y: y0 + sh.slice(0, i).reduce((a, b) => a + b, 0) + i * lgap, h: sh[i] }))
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
  const on = (key: string) => (active === key ? ' cf-on' : '')
  const buttonProps = (token: CashFlowFilter | null, aria: string, label: string, amount: number) =>
    token
      ? svgButton(`${aria}. Show transactions`, () => onSelect(token, label, amount))
      : { role: 'img' as const, tabIndex: 0, 'aria-label': aria }

  const sourceTips = sources.map<TipContent>((s) =>
    s.kind === 'from_balance'
      ? {
          title: `${s.label} → Money out`,
          rows: [{ swatch: 'var(--tile-2)', label: 'Drawn from balance', value: fmt(s.amount), total: true }],
          note: 'More went out than came in this month.',
        }
      : {
          title: `${s.label} → Money in`,
          rows: [
            { swatch: 'var(--chart-muted)', label: 'Came in', value: money(s.amount, currency, { sign: 'always' }), total: true },
            { label: 'Share of money in', value: percent(s.amount, inTotal, s.amount / inTotal < 0.001 ? 2 : 1), plain: true },
          ],
        },
  )
  const targetTips = targets.map<TipContent>((t) => {
    const sub = targetSub(t)
    return {
      title: `Money in → ${t.label}${sub ? ` (${sub})` : ''}`,
      rows: [
        { swatch: GROUP_SWATCH[t.group], label: 'Amount', value: fmt(t.amount), total: true },
        { label: `Share ${share.label}`, value: percent(t.amount, share.base), plain: true },
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
        className={`cf-rib${s.kind === 'from_balance' ? ' cf-kept' : ''}${token ? '' : ' cf-static'}${on(`s${i}`)}`}
        d={band(nw, e.node, mx, e.trunk, e.w)}
        {...buttonProps(
          token,
          s.kind === 'from_balance'
            ? `${s.label}: ${fmtLabel(s.amount)} drawn from your balances`
            : `${s.label}: ${fmtLabel(s.amount)} came in, ${percent(s.amount, inTotal)} of money in`,
          s.label,
          s.amount,
        )}
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
    const kind = t.group === 'kept' ? ' cf-kept' : t.kind === 'category' && t.label === mover ? ' cf-mover' : ''
    ribbons.push(
      <path
        key={`t${i}`}
        className={`cf-rib${kind}${token ? '' : ' cf-static'}${on(`t${i}`)}`}
        d={band(mx + mw, e.trunk, rx, e.node, e.w)}
        {...buttonProps(token, `${t.label}: ${fmtLabel(t.amount)}, ${percent(t.amount, share.base)} ${share.label}`, t.label, t.amount)}
        {...hover(`t${i}`, targetTips[i])}
        {...focus(`t${i}`, targetTips[i])}
      />,
    )
  }

  const labelW = (text: string) => text.length * 7.2
  const numW = (value: number) => {
    const { whole, cents } = moneyParts(value, currency)
    return (whole.length + cents.length) * 6.6
  }
  const maxLabelChars = Math.max(6, Math.floor(((mx + rx) / 2 - nw - 12 - 40) / 7.2))
  const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
  const sBoxes = sources.map((s, i) => {
    const small = sLayout[i].h < 16
    const name = clip(s.label, maxLabelChars)
    const pctText = s.kind === 'from_balance' ? '' : percent(s.amount, inTotal, 0)
    const cw = small
      ? labelW(name) + numW(s.amount) + 36
      : Math.max(labelW(name), numW(s.amount) + (pctText ? pctText.length * 6.2 + 18 : 0)) + 24
    return { small, name, pctText, ch: small ? 28 : 40, cw }
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

  const summary = `Where your money went: ${fmtLabel(inTotal)} came in from ${sources.length} source${
    sources.length === 1 ? '' : 's'
  }${fromBalance > 0.005 ? ` plus ${fmtLabel(fromBalance)} from your balance` : ''}; ${groupsUsed
    .map((gr) => `${GROUP_LABEL[gr].toLowerCase()} ${fmtLabel(groupTotals[gr])}`)
    .join(', ')}.`

  return (
    <div ref={ref} className={`cf-sankey${active ? ' cf-iso' : ''}`}>
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={summary}>
          <g>{ribbons}</g>
          {sources.map((s, i) => (
            <rect
              key={i}
              className={`cf-node${s.kind === 'from_balance' ? ' cf-kept' : ''}`}
              x={0}
              y={sLayout[i].y}
              width={nw}
              height={sLayout[i].h}
              rx={2}
            />
          ))}
          <rect className="cf-node cf-trunk" x={mx} y={my} width={mw} height={mh} rx={2} />
          <text x={mx + mw / 2} y={my - 32} textAnchor="middle" className="cf-sk-grp">
            MONEY IN
          </text>
          <g className="cf-sk-hit" {...buttonProps('in', `Money in: ${fmtLabel(inTotal)}`, 'Money in', inTotal)}>
            <rect x={mx - 60} y={my - 34} width={mw + 120} height={34} fill="transparent" />
            <AmountText value={inTotal} currency={currency} x={mx + mw / 2} y={my - 12} anchor="middle" className="cf-sk-in cf-sk-link" />
          </g>

          {sources.map((s, i) => {
            const b = sBoxes[i]
            const cy = sCentres[i] - b.ch / 2
            const token = sourceToken(s)
            const bx = nw + 12
            return (
              <g
                key={i}
                className={`cf-sk-lab${on(`s${i}`)}`}
                style={token ? { cursor: 'pointer' } : undefined}
                onClick={() => select(token, s.label, s.amount)}
                {...hover(`s${i}`, sourceTips[i])}
              >
                <rect className="cf-sk-box" x={bx} y={cy} width={b.cw} height={b.ch} rx={4} />
                {b.small ? (
                  <>
                    <text x={bx + 12} y={cy + 18} className="cf-sk-name">
                      {b.name}
                    </text>
                    <AmountText value={s.amount} currency={currency} x={bx + b.cw - 12} y={cy + 18} anchor="end" className="cf-sk-amt" />
                  </>
                ) : (
                  <>
                    <text x={bx + 12} y={cy + 17} className="cf-sk-name">
                      {b.name}
                    </text>
                    <AmountText value={s.amount} currency={currency} x={bx + 12} y={cy + 32} className="cf-sk-amt" />
                    {b.pctText && (
                      <text x={bx + b.cw - 12} y={cy + 32} textAnchor="end" className="cf-sk-sub">
                        {b.pctText}
                      </text>
                    )}
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
            const isMover = t.kind === 'category' && t.label === mover
            return (
              <g key={i}>
                {first && (
                  <>
                    <text x={tx} y={headY[i] + 4} className="cf-sk-grp">
                      {GROUP_LABEL[t.group].toUpperCase()}
                    </text>
                    {gToken ? (
                      <g
                        className="cf-sk-hit"
                        {...buttonProps(
                          gToken,
                          `${GROUP_LABEL[t.group]}: ${fmtLabel(groupTotals[t.group])}`,
                          GROUP_LABEL[t.group],
                          groupTotals[t.group],
                        )}
                      >
                        <rect x={amtX - 90} y={headY[i] - 8} width={90} height={18} fill="transparent" />
                        <AmountText
                          value={groupTotals[t.group]}
                          currency={currency}
                          x={amtX}
                          y={headY[i] + 4}
                          anchor="end"
                          className="cf-sk-grp cf-sk-link"
                        />
                      </g>
                    ) : (
                      <AmountText value={groupTotals[t.group]} currency={currency} x={amtX} y={headY[i] + 4} anchor="end" className="cf-sk-grp" />
                    )}
                  </>
                )}
                <g
                  className={`cf-sk-lab${on(`t${i}`)}`}
                  style={token ? { cursor: 'pointer' } : undefined}
                  onClick={() => select(token, t.label, t.amount)}
                  {...hover(`t${i}`, targetTips[i])}
                >
                  <rect
                    className={`cf-node${t.group === 'kept' ? ' cf-kept' : isMover ? ' cf-mover' : ''}`}
                    x={rx}
                    y={L.y}
                    width={nw}
                    height={L.h}
                    rx={2}
                  />
                  <text x={tx} y={ly[i] + 4} className={`cf-sk-name${isMover ? ' cf-mover' : ''}`}>
                    {name}
                    {sub && t.kind === 'other_categories' && <tspan className="cf-sk-sub"> ({sub})</tspan>}
                    {name !== t.label && <title>{t.label}</title>}
                  </text>
                  <AmountText value={t.amount} currency={currency} x={amtX} y={ly[i] + 4} anchor="end" className="cf-sk-amt" />
                  <text x={W} y={ly[i] + 4} textAnchor="end" className="cf-sk-sub">
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

/** Flow | Table toggle: the accessible equivalent of the Sankey, same tokens and figures. */
export function SankeyTable({ sankey, currency }: { sankey: SankeyData; currency: string }) {
  const sources = orderSources(sankey.sources)
  const targets = orderTargets(sankey.targets)
  const inTotal = incomeTotal(sources)
  const share = targetShare(sankey, inTotal)
  const cell = (token: CashFlowFilter | null, label: string, amount: number) => {
    const figure = (
      <Amt>
        <Figure value={amount} currency={currency} />
      </Amt>
    )
    return token ? (
      <DrillButton drill={{ token, label, amount }}>
        <span className="sr-only">Show transactions for {label}: </span>
        {figure}
      </DrillButton>
    ) : (
      figure
    )
  }
  const th = 'border-b border-line py-2 text-[10.5px] font-bold tracking-[0.07em] text-ink-3 uppercase'
  const td = 'h-9 border-b border-line text-[13px] text-ink-2'
  const grp = 'h-9 border-b border-line text-[13px] font-semibold text-ink'

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-left`}>Came in</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={`${th} text-right`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td className={td}>{s.label}</td>
              <td className={`${td} text-right`}>{cell(sourceToken(s), s.label, s.amount)}</td>
              <td className={`${td} figures text-right`}>{s.kind === 'from_balance' ? '—' : percent(s.amount, inTotal)}</td>
            </tr>
          ))}
          <tr>
            <td className={grp}>Money in</td>
            <td className={`${grp} text-right`}>{cell('in', 'Money in', inTotal)}</td>
            <td className={`${grp} figures text-right`}>{inTotal > 0 ? '100.0%' : '—'}</td>
          </tr>
        </tbody>
      </table>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-left`}>Went to</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={`${th} text-right`}>Share {share.label}</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((gr) => {
            const members = targets.filter((t) => t.group === gr)
            if (members.length === 0) return null
            const sum = members.reduce((a, t) => a + t.amount, 0)
            return [
              <tr key={gr}>
                <td className={grp}>{GROUP_LABEL[gr]}</td>
                <td className={`${grp} text-right`}>{cell(GROUP_TOKEN[gr], GROUP_LABEL[gr], sum)}</td>
                <td className={`${grp} figures text-right`}>{percent(sum, share.base)}</td>
              </tr>,
              ...(members.length > 1 || members[0].label !== GROUP_LABEL[gr]
                ? members.map((t) => {
                    const sub = targetSub(t)
                    return (
                      <tr key={t.id}>
                        <td className={`${td} pl-4`}>
                          {t.label}
                          {sub && t.kind === 'other_categories' ? ` (${sub})` : ''}
                        </td>
                        <td className={`${td} text-right`}>{cell(targetToken(t), t.label, t.amount)}</td>
                        <td className={`${td} figures text-right`}>{percent(t.amount, share.base)}</td>
                      </tr>
                    )
                  })
                : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
