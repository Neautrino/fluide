import { Fragment, type ReactNode } from 'react'
import { formatLocalDate, formatMoney } from '../../lib/format'
import { debtNote, type CurrencyTotals } from '../accounts/model'
import { Amt } from '../accounts/shared'
import { money } from '../cashflow/shared'
import { plural } from './model'
import { CardLink, OverviewCard } from './shared'

const PASTEL = 'text-tile-ink [html[data-theme=dark]_&]:shadow-[inset_0_0_0_2px_var(--tile-ring-gap)]'

/** One pastel balance tile: a kind, its total, and a line about what is in it. */
export function AccountTile({ tone, label, value, children }: { tone: string; label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-md border border-line-strong p-3.5 ${tone}`}>
      <span className="text-[12px] font-semibold">{label}</span>
      <b className="mt-2 mb-1 block font-display text-[16px] font-extrabold whitespace-nowrap [&_.amt_small]:text-current [&_.amt_small]:opacity-65">{value}</b>
      <em className="text-[11.5px] not-italic opacity-75 [html[data-theme=dark]_&]:opacity-100">{children}</em>
    </div>
  )
}

/** A currency the user also holds, never summed into the main total. */
export type HeldCurrency = { currency: string; net: number; banks: string; stale: boolean }

export type OwnAndOweCounts = { cash: number; investment: number; credit: number; loan: number; other: number }

export function OwnAndOweCard({
  currency,
  totals,
  counts,
  usage,
  oldestInput,
  held = [],
  ready = true,
  pending,
  onOpenAccounts,
}: {
  currency: string | null
  /** Counted totals in `currency`; undefined = nothing counted there. */
  totals: CurrencyTotals | undefined
  counts: OwnAndOweCounts
  /** Card use across the counted cards, or null without a limit. */
  usage: { limit: number; percent: number } | null
  /** Oldest bank balance or sync behind these figures. */
  oldestInput: string | null
  held?: HeldCurrency[]
  ready?: boolean
  pending?: ReactNode
  onOpenAccounts?: () => void
}) {
  return (
    <OverviewCard title="What you own & owe" aside={<CardLink onClick={() => onOpenAccounts?.()}>Accounts ›</CardLink>}>
      {pending}
      {ready &&
        (!currency || !totals ? (
          <p className="mt-2 text-[13px] text-ink-3">{currency ? `No counted balances in ${currency}.` : 'No counted balances.'}</p>
        ) : (
          <>
            <div className="mt-1.5 mb-3.5 flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <div className="text-[12px] text-ink-3">Net worth · {currency}</div>
                <div className="font-display text-[34px] font-extrabold tracking-[-0.02em] text-ink">
                  <Amt value={totals.net} currency={currency} />
                </div>
              </div>
              <div className="flex flex-col gap-0.5 pb-1.5 text-[12.5px] text-ink-2">
                <span>
                  Assets <span className="amt">{formatMoney(totals.assets, currency)}</span> · {debtNote(totals.owed) === 'owed' ? 'Owed' : 'In credit'}{' '}
                  <span className="amt">{formatMoney(Math.abs(totals.owed), currency)}</span>
                </span>
                {oldestInput && <span className="text-ink-3">as of {formatLocalDate(oldestInput)} (oldest input)</span>}
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
              {totals.kinds.has('cash') && (
                <AccountTile tone={`bg-tile-1 ${PASTEL}`} label="Cash" value={<Amt value={totals.cash} currency={currency} />}>
                  {plural(counts.cash, 'account')}
                </AccountTile>
              )}
              {totals.kinds.has('investment') && (
                <AccountTile tone={`bg-tile-2 ${PASTEL}`} label="Investments" value={<Amt value={totals.investments} currency={currency} />}>
                  {plural(counts.investment, 'account')}
                </AccountTile>
              )}
              {totals.kinds.has('credit') && (
                <AccountTile tone={`bg-tile-3 ${PASTEL}`} label="Cards" value={<Amt value={-totals.cards} currency={currency} />}>
                  {usage ? (
                    <>
                      <span className="relative my-2 block h-2 rounded-full border border-line-strong bg-surface [html[data-theme=dark]_&]:border-tile-ink [html[data-theme=dark]_&]:bg-tile-ink/10">
                        <span className="absolute inset-y-[-1px] left-0 rounded-full bg-tile-ink" style={{ width: `${Math.min(100, usage.percent)}%` }} />
                      </span>
                      {usage.percent}% of <span className="amt">{money(usage.limit, currency, { whole: true })}</span> limit used
                    </>
                  ) : (
                    plural(counts.credit, 'card')
                  )}
                </AccountTile>
              )}
              {totals.kinds.has('loan') && (
                <AccountTile tone={`bg-tile-4 ${PASTEL}`} label="Loans" value={<Amt value={-totals.loans} currency={currency} />}>
                  {plural(counts.loan, 'loan')}
                </AccountTile>
              )}
              {totals.otherAssets !== 0 && (
                <AccountTile tone="bg-surface-2 text-ink" label="Other" value={<Amt value={totals.otherAssets} currency={currency} />}>
                  {plural(counts.other, 'account')}
                </AccountTile>
              )}
            </div>

            {held.length > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-2">
                Held separately, not summed:{' '}
                {held.map((t, i) => (
                  <Fragment key={t.currency}>
                    {i > 0 && ' · '}
                    <span className={t.stale ? 'rounded-full border border-dashed border-ink-3 px-2 py-0.5' : undefined}>
                      <span className="amt">{formatMoney(t.net, t.currency)}</span> {t.banks}
                      {t.stale && ' (stale)'}
                    </span>
                  </Fragment>
                ))}
              </p>
            )}
          </>
        ))}
    </OverviewCard>
  )
}
