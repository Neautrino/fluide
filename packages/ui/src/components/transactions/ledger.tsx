import { Fragment, type ReactNode } from 'react'
import { formatMoney, formatMoneyParts, toNumber } from '../../lib/format'
import type { LedgerListRow } from './TransactionRow'

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthOnlyLabel = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })

export const monthName = (month: string) => monthLabel.format(new Date(`${month}-01T00:00:00Z`))

/** Rows are newest first; one group per calendar month, in that order. */
export function groupByMonth<R extends { date: string }>(rows: R[]): { month: string; label: string; rows: R[] }[] {
  const groups: { month: string; label: string; rows: R[] }[] = []
  for (const r of rows) {
    const month = r.date.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.month !== month) {
      g = { month, label: monthLabel.format(new Date(r.date)), rows: [] }
      groups.push(g)
    }
    g.rows.push(r)
  }
  return groups
}

export type DayInfo = { count: number; total: number | null; currency: string | null }

/** Per-day row count and net, or `total: null` when the day mixes currencies. */
export function dayTotals(rows: LedgerListRow[]): Record<string, DayInfo> {
  const info: Record<string, DayInfo> = {}
  for (const r of rows) {
    const date = r.date.slice(0, 10)
    const entry = (info[date] ??= { count: 0, total: 0, currency: null })
    entry.count++
    if (!r.countsTowardTotals || entry.total === null) continue
    if (entry.currency === null) entry.currency = r.posting.currency
    if (r.posting.currency !== entry.currency) entry.total = null
    else entry.total += toNumber(r.posting.amount)
  }
  return info
}

export function DayTotal({ info }: { info: DayInfo }) {
  if (info.total === null || info.currency === null) return null
  const total = Math.round(info.total * 100) / 100
  return (
    <div className="ml-auto text-[11.5px] text-ink-3">
      {info.currency}{' '}
      {total < 0 && '\u2212'}
      <span className="amt">{formatMoney(Math.abs(total), info.currency, 'never')}</span>
    </div>
  )
}

function MoneyParts({ value, currency }: { value: number; currency: string }) {
  const { whole, fraction } = formatMoneyParts(value, currency, 'never')
  return (
    <span className="amt">
      {whole}
      {fraction && <small className="opacity-55" style={{ color: 'inherit' }}>{fraction}</small>}
    </span>
  )
}

/** The inverse month card above the ledger: what went out, what came in, what was kept. */
export function MonthTotalsCard({
  month,
  currency,
  moneyOut,
  moneyIn,
  kept,
}: {
  /** `YYYY-MM`. */
  month: string
  currency: string
  moneyOut: number
  moneyIn: number
  kept: number
}) {
  const date = new Date(`${month}-01T00:00:00Z`)
  return (
    <div className="@container">
      <section
        className="grid grid-cols-1 overflow-hidden rounded-lg bg-surface-inverse text-ink-inverse @[600px]:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]"
        aria-label={`${monthLabel.format(date)} ledger`}
      >
        <div className="flex flex-col gap-[6px] p-[20px_22px]">
          <div className="flex items-center gap-[8px] text-[12.5px] font-semibold opacity-[.78]">
            Out in {monthOnlyLabel.format(date)} · {currency}
          </div>
          <div className="mt-[6px] whitespace-nowrap font-display text-[44px] font-[800] leading-none tracking-[-0.03em]">
            {moneyOut > 0 && '\u2212'}
            <MoneyParts value={moneyOut} currency={currency} />
          </div>
        </div>
        <div className="flex min-w-0 flex-row gap-[22px] border-t border-ink-inverse/20 p-[16px_22px] @[600px]:flex-col @[600px]:gap-[10px] @[600px]:border-t-0 @[600px]:border-l @[600px]:p-[18px_22px_16px]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-[8px] text-[11px] font-semibold opacity-[.8]">In</div>
            <div className="mt-[6px] whitespace-nowrap font-display text-[26px] font-[800] leading-none tracking-[-0.03em]">
              <MoneyParts value={moneyIn} currency={currency} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-[8px] text-[11px] font-semibold opacity-[.8]">Kept</div>
            <div className="mt-[6px] whitespace-nowrap font-display text-[26px] font-[800] leading-none tracking-[-0.03em]">
              {kept >= 0 ? '+' : '\u2212'}
              <MoneyParts value={Math.abs(kept)} currency={currency} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** "4 waiting · $3,408.34", with the button that opens Review. */
export function WaitingStrip({
  count,
  totals,
  children,
}: {
  count: number
  totals: { currency: string; total: number }[]
  /** The Review button (the host decides what it does). */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-line bg-surface p-[10px_12px_10px_14px] text-[13px] shadow-1" role="status">
      <span className="flex items-center gap-2 whitespace-nowrap font-bold text-ink">
        <span className="size-[10px] rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]"></span>
        {count} waiting ·{' '}
        {totals.map((t, i) => (
          <Fragment key={t.currency}>
            <span className="amt">{formatMoney(t.total, t.currency, 'never')}</span>
            {i < totals.length - 1 ? ' · ' : ''}
          </Fragment>
        ))}
      </span>
      <span className="ml-auto flex items-center gap-2">{children}</span>
    </div>
  )
}

/** Column captions above the rows (desktop only). */
export function LedgerColumns() {
  return (
    <div className="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_108px] items-center gap-[8px] border-b border-line bg-surface-2 p-[8px_14px] text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.08em] text-ink-3 sm:grid min-[1360px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_124px] min-[1360px]:gap-[12px]">
      <span>Merchant · Account</span>
      <span>Category</span>
      <span className="text-right">Amount</span>
    </div>
  )
}

/** Month heading inside the ledger; `children` is the right-hand In/Out/net summary or a row count. */
export function MonthDivider({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-[12px] border-b border-line p-[14px_14px_12px]">
      <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">{label}</h3>
      {children}
    </div>
  )
}

export function MonthFlowSummary({
  moneyIn,
  moneyOut,
  net,
  currency,
}: {
  moneyIn: number
  moneyOut: number
  net: number
  currency: string
}) {
  return (
    <div className="ml-auto flex flex-wrap items-baseline justify-end gap-[10px] text-[12px] text-ink-2">
      <span>
        In <span className="amt">{formatMoney(moneyIn, currency, 'never')}</span> ·{' '}
        Out <span className="amt">{formatMoney(moneyOut, currency, 'never')}</span> ·{' '}
        net <b className="font-display text-[16px] font-[800] text-ink">
          {net >= 0 ? '+' : '\u2212'}<span className="amt">{formatMoney(Math.abs(net), currency, 'never')}</span>
        </b>
      </span>
    </div>
  )
}
