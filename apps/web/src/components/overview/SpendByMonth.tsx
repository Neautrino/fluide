import { Fragment, type ReactNode } from 'react'
import type { CashFlow, ReviewItem } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import type { Resource } from '../../lib/useResource'
import { Amt } from '../accounts/shared'
import { AMOUNT_HIDDEN, useAmountsHidden } from '../cashflow/amounts'
import { formatWhole } from '../cashflow/figures'
import { compactMoney, money, shortMonth } from '../cashflow/shared'
import { atStakeByCurrency, itemAmount } from '../review/helpers'
import { chartBars, chartScale, hasHistory, itemsInMonth, NOT_COUNTED_LABEL, typicalByNow, type Fresh } from './model'
import { Freshness, OverviewCard, Pending } from './shared'

const BASE = 176
const PLOT = 136
const center = (i: number, n: number) => 57.5 + 47 * (i + 6 - n)

function MonthChart({ flow, typical }: { flow: CashFlow; typical: number | null }) {
  const hidden = useAmountsHidden()
  const currency = flow.currency
  const bars = chartBars(flow)
  const { step, top } = chartScale(bars, typical)
  const y = (v: number) => BASE - (v / top) * PLOT
  const grid = Array.from({ length: Math.round(top / step) }, (_, k) => (k + 1) * step)
  const out = flow.totals.moneyOut
  const gap = typical === null ? 0 : typical - out
  const last = center(bars.length - 1, bars.length)
  const label = hidden
    ? AMOUNT_HIDDEN
    : `Out by month: ${bars.map((b) => `${shortMonth(b.month)} ${money(b.value, currency)}${b.partial ? ' so far' : ''}`).join(', ')}${
        typical !== null ? `; typical by day ${flow.daysElapsed} ${money(typical, currency)}` : ''
      }`

  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={label} className="mt-1.5 block h-auto w-full overflow-visible font-sans text-[10.5px]">
      <defs>
        <pattern id="ov-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--hatch-stripe)" strokeWidth="2" />
        </pattern>
      </defs>
      <line x1="34" y1={BASE} x2="316" y2={BASE} stroke="var(--line-strong)" />
      {grid.map((v) => (
        <line key={v} x1="34" y1={y(v)} x2="316" y2={y(v)} stroke="var(--chart-grid)" strokeDasharray="2 3" />
      ))}
      {[0, ...grid].map((v) => (
        <text key={v} x="28" y={y(v) + 3.5} textAnchor="end" fill="var(--ink-3)" className="amt">
          {compactMoney(v, currency)}
        </text>
      ))}
      {bars.map((b, i) => {
        const x = center(i, bars.length)
        return (
          <Fragment key={b.month}>
            {b.partial ? (
              <rect x={x - 11} y={y(b.value)} width="22" height={BASE - y(b.value)} rx="2" fill="url(#ov-hatch)" stroke="var(--ink)" strokeWidth="1.2" />
            ) : (
              <>
                <rect x={x - 11} y={y(b.value)} width="22" height={BASE - y(b.value)} rx="2" fill="var(--ink)" />
                <text x={x} y={y(b.value) - 6} textAnchor="middle" fill="var(--ink-2)" className="amt text-[10px] font-semibold">
                  {compactMoney(b.value, currency)}
                </text>
              </>
            )}
            <text
              x={x}
              y="193"
              textAnchor="middle"
              fill={b.partial ? 'var(--ink)' : 'var(--ink-2)'}
              className={`text-[11px] ${b.partial ? 'font-bold' : 'font-medium'}`}
            >
              {shortMonth(b.month)}
              {b.partial && '*'}
            </text>
          </Fragment>
        )
      })}
      {typical !== null && (
        <>
          <line x1={last - 17.5} y1={y(typical)} x2={last + 17.5} y2={y(typical)} className="stroke-ink stroke-[1.4] [stroke-dasharray:3_2.5] [html[data-theme=dark]_&]:stroke-chart-1 [html[data-theme=dark]_&]:stroke-[1.6]" />
          {Math.abs(gap) >= 1 && (
            <>
              <rect x="206" y="10" width="112" height="20" rx="10" fill="var(--surface-inverse)" />
              <text x="262" y="23.8" textAnchor="middle" fill="var(--ink-inverse)" className="amt text-[10.5px] font-bold">
                {formatWhole(gap, currency)} {gap > 0 ? 'under' : 'over'} typical
              </text>
              <line x1={last} y1="30" x2={last} y2={Math.min(y(typical), y(out)) - 3} stroke="var(--ink)" strokeWidth="1" />
            </>
          )}
        </>
      )}
    </svg>
  )
}

function Stat({ label, sign, value, currency, bg, children }: { label: string; sign: string; value: number; currency: string; bg: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-[9px] rounded-sm border border-line-strong px-2.5 py-[9px] max-[1300px]:gap-[7px] max-[1300px]:p-2">
      <span className={`grid size-[30px] flex-none place-items-center rounded-full border border-line-strong text-tile-ink max-[1300px]:size-[26px] ${bg}`}>{children}</span>
      <div className="min-w-0">
        <small className="block text-[11px] text-ink-2">{label}</small>
        <b className="font-display text-[14px] font-extrabold whitespace-nowrap max-[1300px]:text-[13px]">
          {value !== 0 && (
            <span aria-hidden className="amt">
              {sign}
            </span>
          )}
          <Amt value={value} currency={currency} />
        </b>
      </div>
    </div>
  )
}

function Body({ flow, items }: { flow: CashFlow; items: ReviewItem[] }) {
  const currency = flow.currency
  const month = shortMonth(flow.month)
  const typical = typicalByNow(flow)
  const { moneyIn, moneyOut, kept } = flow.totals
  const monthItems = itemsInMonth(items, flow.month)
  const stake = atStakeByCurrency(monthItems).find((a) => a.currency === currency)
  const unreviewed = monthItems.filter((i) => i.posting?.currency === currency && itemAmount(i) < 0).length
  const notCounted = flow.notCounted.filter((n) => n.count > 0)
  const strong = 'font-semibold text-ink-2'

  return (
    <>
      {hasHistory(flow) ? (
        <MonthChart flow={flow} typical={typical} />
      ) : (
        <p className="mt-3 text-[13px] text-ink-3">Not enough history yet — the chart appears after two full months.</p>
      )}
      <p className="mt-2.5 text-[11.5px] leading-[1.45] text-ink-3">
        {typical !== null ? (
          <>
            *{month} to day {flow.daysElapsed}: <b className={`amt ${strong}`}>{formatMoney(moneyOut, currency)}</b> vs a typical{' '}
            <b className={`amt ${strong}`}>{formatMoney(typical, currency)}</b> by this day{hasHistory(flow) && ' (dashed line)'}.
          </>
        ) : flow.partial ? (
          <>
            *{month} to day {flow.daysElapsed}: <span className="amt">{formatMoney(moneyOut, currency)}</span> out. No typical yet — needs full months of history in {currency}.
          </>
        ) : (
          <>
            {month}: <span className="amt">{formatMoney(moneyOut, currency)}</span> out.
          </>
        )}
        {stake && unreviewed > 0 && (
          <>
            {' '}
            Incl. <span className="amt">{formatMoney(stake.total, currency)}</span> from {unreviewed} unreviewed.
          </>
        )}
        {flow.possibleTransfers.count > 0 && (
          <>
            {' '}
            <span className="amt">{formatMoney(flow.possibleTransfers.total, currency)}</span> possible {flow.possibleTransfers.count === 1 ? 'transfer' : 'transfers'} this month, counted until you decide.
          </>
        )}
      </p>
      {notCounted.length > 0 && (
        <p className="mt-1.5 text-[11.5px] leading-[1.45] text-ink-3">
          Not counted:{' '}
          {notCounted.map((n, i) => (
            <Fragment key={n.kind}>
              {i > 0 && ' · '}
              <span className="amt">{formatMoney(n.total, currency)}</span> {NOT_COUNTED_LABEL[n.kind]} ({n.count})
            </Fragment>
          ))}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat label={`In · ${month}`} sign="+" value={moneyIn} currency={currency} bg="bg-tile-3">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 12 12 4M6 4h6v6" />
          </svg>
        </Stat>
        <Stat label={`Out · ${month}`} sign={'\u2212'} value={moneyOut} currency={currency} bg="bg-tile-1">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 4 4 12M10 12H4V6" />
          </svg>
        </Stat>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-line pt-[9px] text-[12px] text-ink-2">
        <span>Kept · {month} (in − out)</span>
        <b className="font-display text-[14px] font-extrabold whitespace-nowrap text-ink">
          {kept !== 0 && (
            <>
              <span className="sr-only">{kept > 0 ? 'plus ' : 'minus '}</span>
              <span aria-hidden className="amt">
                {kept > 0 ? '+' : '\u2212'}
              </span>
            </>
          )}
          <Amt value={Math.abs(kept)} currency={currency} />
        </b>
      </div>
    </>
  )
}

export function SpendByMonth({ flow, review, fresh }: { flow: Resource<CashFlow>; review: Resource<ReviewItem[]>; fresh: Fresh | null }) {
  return (
    <OverviewCard title="Spend by month" aside={<Freshness fresh={fresh} />} className={flow.loading && flow.data ? 'opacity-60' : ''}>
      <Pending resource={flow} what="spending" ready={flow.data !== undefined} />
      {flow.data && <Body flow={flow.data} items={review.data ?? []} />}
    </OverviewCard>
  )
}
