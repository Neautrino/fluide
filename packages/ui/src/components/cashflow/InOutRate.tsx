import type { ReactNode } from 'react'
import type { CashFlow, CashFlowDelta } from '../../types'
import { formatMoney } from '../../lib/format'
import { baselineNoun, compareShort, formatWhole, monthOnly, monthStart, ordinal, pct } from './figures'
import { Amt, Card, DrillButton, Figure } from './primitives'
import { compactMoney } from './shared'

const DOTTED =
  '[background-image:linear-gradient(var(--line-strong)_40%,transparent_0)] [background-size:1px_4px] bg-repeat-y bg-left'

function Comparison({ value, delta, noun, currency }: { value: number; delta: CashFlowDelta; noun: string; currency: string }) {
  if (delta.baseline === null) return <>No earlier months yet to compare with.</>
  const diff = value - delta.baseline
  const base = <Amt>({formatWhole(delta.baseline, currency)})</Amt>
  if (Math.abs(diff) < 0.005) return <>Same as {noun} {base}</>
  return (
    <>
      <b>
        {diff > 0 ? '▲' : '▼'}
        {delta.change !== null && ` ${Math.abs(delta.change * 100).toFixed(1)}%`}
      </b>{' '}
      · <b><Amt>{formatMoney(Math.abs(diff), currency)}</Amt></b> {diff > 0 ? 'more' : 'less'} than {noun} {base}
    </>
  )
}

function RateDelta({ rate, base, noun }: { rate: number; base: number; noun: string }) {
  const pts = (rate - base) * 100
  if (Math.abs(pts) < 0.05) return <>Same as {noun} ({pct(base)})</>
  return (
    <>
      <b>
        {pts > 0 ? '▲' : '▼'} {Math.abs(pts).toFixed(1)} pts
      </b>{' '}
      {pts > 0 ? 'above' : 'below'} {noun} ({pct(base)})
    </>
  )
}

function Stat({ icon, name, bar, first = false, children }: { icon: ReactNode; name: string; bar: ReactNode; first?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 px-4 pt-0.5 first:pl-0 ${first ? '' : DOTTED}`}>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-2">
        <span className="grid size-[26px] shrink-0 place-items-center rounded-full border border-line-strong">
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            {icon}
          </svg>
        </span>
        {name}
      </div>
      {children}
      <div aria-hidden className="mt-auto pt-2">
        <div className="h-1 overflow-hidden rounded-sm bg-surface-2">{bar}</div>
      </div>
    </div>
  )
}

const VALUE = 'mt-1.5 font-display text-[18px] font-extrabold tracking-[-0.02em] whitespace-nowrap min-[1360px]:text-[21px]'
const DETAIL = 'text-[12px] leading-[1.4] text-ink-2 [&_b]:font-bold [&_b]:text-ink'

function PaceBar({ data }: { data: CashFlow }) {
  const { totals, currency, compare, daysElapsed, partial } = data
  const baseline = totals.vs.moneyOut.baseline
  if (baseline === null) return null
  const out = totals.moneyOut
  const max = Math.max(out, baseline) * 1.2
  const diff = out - baseline
  const short = compareShort(compare)
  const at = (v: number) => `${max > 0 ? (v / max) * 100 : 0}%`
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em]">
          {partial ? `Out so far vs ${short} by today` : `Out vs ${short}`}
        </h3>
        <span
          className={`ml-auto rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap ${
            diff < -0.005 ? 'bg-positive-wash text-positive' : 'border border-line bg-surface-2 text-ink-2'
          }`}
        >
          {Math.abs(diff) < 0.005 ? (
            `Same as ${short}`
          ) : (
            <>
              <Amt>{formatWhole(diff, currency)}</Amt> {diff < 0 ? 'under' : 'over'}
            </>
          )}
        </span>
      </div>
      <div className="relative mt-8 mb-7 h-3 rounded-full border border-line bg-surface-2">
        <div className="absolute -top-px -bottom-px left-0 rounded-l-full bg-chart-1" style={{ width: at(out) }} />
        <div className="absolute -top-2.5 -bottom-2.5 w-0.5 rounded-[1px] bg-ink" style={{ left: at(baseline) }}>
          <span className="absolute bottom-[calc(100%+3px)] left-1/2 -translate-x-[78%] rounded-full bg-surface-inverse px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-ink-inverse">
            {short} by the {ordinal(daysElapsed)} <span className="amt">{formatWhole(baseline, currency)}</span>
          </span>
        </div>
        <span className="amt absolute top-[calc(100%+6px)] left-0 text-[10.5px] whitespace-nowrap text-ink-3">{compactMoney(0, currency)}</span>
        <span
          className="absolute top-[calc(100%+6px)] -translate-x-1/2 text-[10.5px] whitespace-nowrap text-ink-3"
          style={{ left: at(out) }}
        >
          <span className="amt">{formatWhole(out, currency)}</span> out
        </span>
        <span className="amt absolute top-[calc(100%+6px)] right-0 text-[10.5px] whitespace-nowrap text-ink-3">{compactMoney(max, currency)}</span>
      </div>
    </div>
  )
}

export function InOutRate({ data }: { data: CashFlow }) {
  const { totals, currency, compare, month } = data
  const noun = baselineNoun(compare, month)
  const rate = totals.savingsRate
  const rateBase = totals.vs.savingsRate.baseline
  const inn = totals.moneyIn
  const outShare = inn > 0 ? Math.min(100, (totals.moneyOut / inn) * 100) : 0
  const rateShare = rate !== null ? Math.min(100, Math.max(0, rate * 100)) : 0

  return (
    <Card title="In · Out · Savings rate" sub={`${monthOnly.format(monthStart(month))} vs ${noun}${data.partial ? `, through day ${data.daysElapsed}` : ''}`}>
      <div className="grid grid-cols-3">
        <Stat
          first
          name="In"
          icon={<path d="M8 3v10M3 8h10" />}
          bar={inn > 0 && <div className="h-full w-full bg-positive" />}
        >
          <p className={VALUE}>
            <DrillButton drill={{ token: 'in', label: 'Money in', amount: inn }}>
              <Amt>
                <Figure value={inn} currency={currency} />
              </Amt>
            </DrillButton>
          </p>
          <p className={DETAIL}>
            <Comparison value={inn} delta={totals.vs.moneyIn} noun={noun} currency={currency} />
          </p>
        </Stat>
        <Stat name="Out" icon={<path d="M3 8h10" />} bar={<div className="h-full bg-chart-1" style={{ width: `${outShare}%` }} />}>
          <p className={VALUE}>
            <DrillButton drill={{ token: 'out', label: 'Money out', amount: totals.moneyOut }}>
              <Amt>
                <Figure value={totals.moneyOut} currency={currency} />
              </Amt>
            </DrillButton>
          </p>
          <p className={DETAIL}>
            <Comparison value={totals.moneyOut} delta={totals.vs.moneyOut} noun={noun} currency={currency} />
            <br />
            <DrillButton drill={{ token: 'spending', label: 'Spending', amount: totals.spending }}>
              Spending <Amt>{formatMoney(totals.spending, currency)}</Amt>
            </DrillButton>
            {totals.debtPayments > 0 && (
              <>
                {' + '}
                <DrillButton drill={{ token: 'debt', label: 'Debt payments', amount: totals.debtPayments }}>
                  Debt payments <Amt>{formatMoney(totals.debtPayments, currency)}</Amt>
                </DrillButton>
              </>
            )}
          </p>
        </Stat>
        <Stat
          name="Savings rate"
          icon={
            <>
              <circle cx="4.5" cy="4.5" r="1.8" />
              <circle cx="11.5" cy="11.5" r="1.8" />
              <path d="M12 3.5 4 12.5" />
            </>
          }
          bar={<div className="h-full bg-chart-2" style={{ width: `${rateShare}%` }} />}
        >
          <p className={`${VALUE} figures`}>{rate === null ? '—' : pct(rate)}</p>
          <p className={DETAIL}>
            {rate === null ? 'Nothing came in yet' : rateBase === null ? 'No earlier months yet' : <RateDelta rate={rate} base={rateBase} noun={noun} />} · kept ÷
            money in
          </p>
        </Stat>
      </div>
      <PaceBar data={data} />
    </Card>
  )
}
