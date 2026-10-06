import type { ReactNode } from 'react'
import { formatMoney } from '../../lib/format'
import type { CashFlow, ReviewItem } from '../../types'
import { Amt } from '../accounts/shared'
import { AMOUNT_HIDDEN, useAmountsHidden } from '../cashflow/amounts'
import { compactMoney, money, shortMonth } from '../cashflow/shared'
import { atStakeByCurrency } from '../review/helpers'
import { Empty } from '../ui/States'
import { itemsInMonth, legendRows, risingCategory, slicesOf, type Fresh, type Slice } from './model'
import { Freshness, OverviewCard } from './shared'

const R = 58
const C = 2 * Math.PI * R
const GAP = 2

/** The hole is 94 wide, so the center reads e.g. "$8.1K" (three significant digits); the exact figure is in the Out tile, the legend and the label. */
export function Donut({ slices, total, currency, partial, month }: { slices: Slice[]; total: number; currency: string; partial: boolean; month: string }) {
  const hidden = useAmountsHidden()
  const sum = slices.reduce((s, x) => s + x.amount, 0)
  const label = hidden
    ? AMOUNT_HIDDEN
    : `Out in ${month} ${money(total, currency)}: ${slices.map((s) => `${s.label} ${money(s.amount, currency)}`).join(', ')}`

  return (
    <svg viewBox="0 0 160 160" width="148" height="148" role="img" aria-label={label} className="flex-none font-sans">
      <g transform="rotate(-90 80 80)" fill="none" strokeWidth="22">
        {slices.map((s, i) => {
          const before = slices.slice(0, i).reduce((n, x) => n + x.amount, 0)
          const dash = Math.max((s.amount / sum) * C - GAP, 0.01)
          return (
            <circle
              key={`${i}:${s.label}`}
              cx="80"
              cy="80"
              r={R}
              stroke={s.riser ? 'var(--chart-1)' : 'var(--chart-muted)'}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-(before / sum) * C}
            />
          )
        })}
      </g>
      <text x="80" y="82" textAnchor="middle" fill="var(--ink)" className="amt font-display text-[18px] font-extrabold">
        {compactMoney(Number(total.toPrecision(3)), currency)}
      </text>
      <text x="80" y="98" textAnchor="middle" fill="var(--ink-3)" className="text-[10.5px]">
        out · {month}
        {partial && ' so far'}
      </text>
    </svg>
  )
}

export function WhereItWentBody({
  flow,
  items,
  onDetails,
  onReview,
}: {
  flow: CashFlow
  items: ReviewItem[]
  onDetails?: () => void
  onReview?: () => void
}) {
  const currency = flow.currency
  const month = shortMonth(flow.month)
  const riser = risingCategory(flow)
  const slices = slicesOf(flow, riser)
  if (slices.length === 0) return <Empty title="Nothing spent yet this month" />

  const { rows, uncategorized } = legendRows(slices)
  const waitingItems = itemsInMonth(items, flow.month).filter((i) => i.posting?.currency === currency)
  const stake = atStakeByCurrency(waitingItems).find((a) => a.currency === currency)
  const waiting = waitingItems.length
  const linkBtn = 'rounded-[2px] border-b border-line-strong text-[12px] font-semibold text-ink hover:border-ink'

  return (
    <>
      <div className="mt-2.5 flex items-center gap-3.5">
        <Donut slices={slices} total={flow.totals.moneyOut} currency={currency} partial={flow.partial} month={month} />
        <div className="flex min-w-0 flex-col items-start gap-1.5 text-[12px] leading-[1.4] text-ink-2">
          {riser && (
            <>
              <span className="rounded-full bg-surface-inverse px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-ink-inverse">
                {riser.label} +{riser.pct}%
              </span>
              <span>
                <span className="amt">{formatMoney(riser.amount, currency)}</span> vs typical <span className="amt">{formatMoney(riser.baseline, currency)}</span>
              </span>
            </>
          )}
          <button type="button" onClick={() => onDetails?.()} className={linkBtn}>
            Details ›
          </button>
        </div>
      </div>
      <ul className="mt-3 flex flex-col">
        {rows.map((row, i) => {
          const line = `grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-[9px] py-[7px] text-[12.5px] ${i > 0 ? 'border-t border-line' : ''}`
          if (row.kind === 'more') {
            return (
              <li key="more" className={line}>
                <i className="size-2.5 self-center rounded-[2px] bg-chart-muted" />
                <span>
                  {row.names.length} more
                  <small className="block text-[11px] whitespace-normal text-ink-3">{row.names.join(', ')}</small>
                </span>
                <Amt value={row.amount} currency={currency} className="text-right font-semibold" />
              </li>
            )
          }
          const s = row.slice
          return (
            <li key={`${i}:${s.label}`} className={`${line} ${s.riser ? 'font-bold' : ''}`}>
              <i className={`size-2.5 self-center rounded-[2px] ${s.riser ? 'bg-chart-1' : 'bg-chart-muted'}`} />
              <span>
                {s.label}
                {s.riser && riser && (
                  <span className="ml-1 rounded-full border border-line px-1.5 text-[10.5px] font-semibold text-ink-2">
                    +{riser.pct}% vs typical
                  </span>
                )}
              </span>
              <Amt value={s.amount} currency={currency} className="text-right font-semibold" />
            </li>
          )
        })}
        {(uncategorized || waiting > 0) && (
          <li className="mt-2 grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-[9px] rounded-sm border border-dashed border-ink-3 px-2.5 py-2 text-[12.5px]">
            <i
              className="size-2.5 self-center rounded-[2px] border border-hatch"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,var(--hatch-stripe) 0 1.2px,var(--surface) 1.2px 4px)' }}
            />
            <span>
              Not yet categorized
              {waiting > 0 && (
                <small className="block text-[11px] text-ink-3">
                  {waiting} waiting{stake && <> · <span className="amt">{formatMoney(stake.total, currency)}</span> at stake</>}
                </small>
              )}
            </span>
            <span className="flex flex-col items-end">
              {uncategorized && <Amt value={uncategorized.amount} currency={currency} className="font-semibold" />}
              {waiting > 0 && (
                <button type="button" onClick={() => onReview?.()} className="text-[11px] font-semibold text-ink hover:underline">
                  Review ›
                </button>
              )}
            </span>
          </li>
        )}
      </ul>
    </>
  )
}

export function WhereItWentCard({
  flow,
  items = [],
  fresh,
  dimmed = false,
  pending,
  onDetails,
  onReview,
}: {
  flow: CashFlow | undefined
  items?: ReviewItem[]
  fresh: Fresh | null
  /** A newer month is loading over the one on screen. */
  dimmed?: boolean
  pending?: ReactNode
  onDetails?: () => void
  onReview?: () => void
}) {
  return (
    <OverviewCard
      title="Where it went"
      unit={flow && shortMonth(flow.month)}
      aside={<Freshness fresh={fresh} />}
      className={dimmed ? 'opacity-60' : ''}
    >
      {pending}
      {flow && <WhereItWentBody flow={flow} items={items} onDetails={onDetails} onReview={onReview} />}
    </OverviewCard>
  )
}
