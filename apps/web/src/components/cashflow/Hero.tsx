import type { CashFlow } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { baselineNoun, monthOnly, monthStart, ordinal } from './figures'
import { PaceChart } from './PaceChart'
import { Amt, DrillButton, Figure, useDrill } from './primitives'

const INVERSE_LINK = 'underline decoration-ink-inverse/50 decoration-dotted decoration-[1.5px] underline-offset-[3px] hover:decoration-ink-inverse'

function KeptDelta({ kept, delta, noun, currency, through }: { kept: number; delta: CashFlow['totals']['vs']['kept']; noun: string; currency: string; through: number | null }) {
  if (delta.baseline === null) return <>No earlier months yet to compare with</>
  const diff = kept - delta.baseline
  const flat = Math.abs(diff) < 0.005
  return (
    <>
      <span className="font-bold">
        {flat ? '=' : diff > 0 ? '▲' : '▼'}
        {delta.change !== null && !flat && ` ${Math.abs(delta.change * 100).toFixed(1)}%`}
      </span>{' '}
      vs {noun} (<Amt>{formatMoney(delta.baseline, currency)}</Amt>)
      {through !== null && `, through day ${through}`}
    </>
  )
}

export function Hero({ data, syncStamp }: { data: CashFlow; syncStamp: string | null }) {
  const open = useDrill()
  const { totals, currency, compare, month, partial, daysElapsed } = data
  const noun = baselineNoun(compare, month)
  const monthName = monthOnly.format(monthStart(month))
  const hasBaseline = data.pace.some((p) => p.baseline !== null)
  const today = data.pace.find((p) => p.day === daysElapsed)
  const current = today?.current ?? null
  const baseline = today?.baseline ?? null
  const callout =
    current !== null && baseline !== null && baseline > 0
      ? `${current < baseline ? '\u2212' : '+'}${Math.abs(((current - baseline) / baseline) * 100).toFixed(1)}% vs ${noun} by the ${ordinal(daysElapsed)}`
      : undefined

  return (
    <section
      aria-label={`${partial ? 'Kept so far' : 'Kept'} in ${monthName}, and spending pace`}
      className="grid grid-cols-1 overflow-hidden rounded-lg shadow-1 lg:max-[1359.98px]:grid-cols-[320px_minmax(0,1fr)] min-[1360px]:grid-cols-[360px_minmax(0,1fr)]"
    >
      <div className="cf-inverse flex flex-col gap-1.5 bg-surface-inverse px-6 py-[22px] text-ink-inverse">
        <p className="text-[12.5px] font-semibold opacity-80">
          {partial ? `Kept so far · ${monthName}` : `Kept · ${monthName}`}
        </p>
        <p className="mt-2 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em] min-[1360px]:text-[50px]">
          <Amt>
            <Figure value={totals.kept} currency={currency} signed />
          </Amt>
        </p>
        <p className="text-[13px] leading-[1.45]">
          {totals.kept > 0 ? (
            <>
              <Amt>{formatMoney(totals.kept, currency)}</Amt> more came in than went out
            </>
          ) : totals.kept < 0 ? (
            <>
              You spent <Amt>{formatMoney(-totals.kept, currency)}</Amt> more than came in
            </>
          ) : (
            'Exactly what came in went out'
          )}
        </p>
        <p className="text-[13px] leading-[1.45]">
          <KeptDelta kept={totals.kept} delta={totals.vs.kept} noun={noun} currency={currency} through={partial ? daysElapsed : null} />
        </p>
        {syncStamp && <p className="text-[11.5px] opacity-70">{syncStamp}</p>}
        <div className="mt-auto grid grid-cols-2 gap-2.5 border-t border-ink-inverse/20 pt-3 text-[12px]">
          <div>
            <p className="opacity-70">In</p>
            <DrillButton
              plain
              drill={{ token: 'in', label: 'Money in', amount: totals.moneyIn }}
              className={`mt-0.5 font-display text-[15px] font-bold ${INVERSE_LINK}`}
            >
              <Amt>
                <Figure value={totals.moneyIn} currency={currency} signed />
              </Amt>
            </DrillButton>
          </div>
          <div>
            <p className="opacity-70">Out</p>
            <DrillButton
              plain
              drill={{ token: 'out', label: 'Money out', amount: totals.moneyOut }}
              className={`mt-0.5 font-display text-[15px] font-bold ${INVERSE_LINK}`}
            >
              <Amt>
                <Figure value={totals.moneyOut} currency={currency} />
              </Amt>
            </DrillButton>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col bg-(--hero-bg) px-5 pt-4 pb-3 text-ink">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h2 className="font-display text-[17px] leading-[1.2] font-bold tracking-[-0.01em]">Spending pace</h2>
          <div className="ml-auto flex flex-wrap gap-x-3.5 text-[11.5px] font-medium">
            <span className="flex items-center gap-1.5">
              <i aria-hidden className="inline-block w-4 border-t-[2.4px] border-ink" />
              {monthName}
            </span>
            {hasBaseline && (
              <span className="flex items-center gap-1.5">
                <i aria-hidden className="inline-block w-4 border-t-2 border-dotted border-ink" />
                {noun}
              </span>
            )}
          </div>
        </div>
        <PaceChart
          pace={data.pace}
          month={month}
          daysElapsed={daysElapsed}
          daysInMonth={data.daysInMonth}
          partial={partial}
          compare={compare}
          currency={currency}
          callout={callout}
          onSelect={(token, label, amount) => open({ token, label, amount })}
        />
        <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11.5px] text-ink-2">
          <span>Cumulative out by day{hasBaseline && ` · dotted = ${noun}`}</span>
          <span>
            1–{daysElapsed} {monthStart(month).toLocaleString(undefined, { month: 'short', timeZone: 'UTC' })}
          </span>
        </div>
      </div>
    </section>
  )
}
