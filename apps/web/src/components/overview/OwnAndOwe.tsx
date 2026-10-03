import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Fragment, type ReactNode } from 'react'
import type { AccountBalance, ConnectionSummary } from '../../lib/api'
import { shortName } from '../../lib/connection-health'
import { formatLocalDate, formatMoney } from '../../lib/format'
import { accountHealth, creditUsage, debtNote, isLive, totalsByCurrency } from '../accounts/model'
import { Amt } from '../accounts/shared'
import { money } from '../cashflow/shared'
import { countedIn, oldestOf, plural } from './model'
import { CardLink, OverviewCard, Pending } from './shared'

const PASTEL = 'text-tile-ink [html[data-theme=dark]_&]:shadow-[inset_0_0_0_2px_var(--tile-ring-gap)]'

function Tile({ tone, label, value, children }: { tone: string; label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-md border border-line-strong p-3.5 ${tone}`}>
      <span className="text-[12px] font-semibold">{label}</span>
      <b className="mt-2 mb-1 block font-display text-[16px] font-extrabold whitespace-nowrap [&_.amt_small]:text-current [&_.amt_small]:opacity-65">{value}</b>
      <em className="text-[11.5px] not-italic opacity-75 [html[data-theme=dark]_&]:opacity-100">{children}</em>
    </div>
  )
}

export function OwnAndOwe({
  accounts,
  connections,
  currency,
  currencyKnown,
  now,
}: {
  accounts: UseQueryResult<AccountBalance[]>
  connections: UseQueryResult<ConnectionSummary[]>
  currency: string | null
  /** False while the cash-flow response that names the currency is still pending. */
  currencyKnown: boolean
  now: number
}) {
  const navigate = useNavigate()
  const balances = accounts.isError ? undefined : accounts.data
  const list = balances ?? []
  const all = totalsByCurrency(list.filter(isLive))
  const totals = all.find((t) => t.currency === currency)
  const counted = currency ? countedIn(list, currency) : []
  const usage = creditUsage(counted)
  const oldestInput = oldestOf(counted.map((b) => b.bankBalanceAt ?? b.lastSyncedAt))
  const count = (kind: AccountBalance['kind']) => counted.filter((b) => b.kind === kind).length
  const held = all.filter((t) => t.currency !== currency)

  return (
    <OverviewCard title="What you own & owe" aside={<CardLink onClick={() => void navigate({ to: '/accounts' })}>Accounts ›</CardLink>}>
      <Pending resource={accounts} what="balances" ready={balances !== undefined && currencyKnown} />
      {balances &&
        currencyKnown &&
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
                <Tile tone={`bg-tile-1 ${PASTEL}`} label="Cash" value={<Amt value={totals.cash} currency={currency} />}>
                  {plural(count('cash'), 'account')}
                </Tile>
              )}
              {totals.kinds.has('investment') && (
                <Tile tone={`bg-tile-2 ${PASTEL}`} label="Investments" value={<Amt value={totals.investments} currency={currency} />}>
                  {plural(count('investment'), 'account')}
                </Tile>
              )}
              {totals.kinds.has('credit') && (
                <Tile tone={`bg-tile-3 ${PASTEL}`} label="Cards" value={<Amt value={-totals.cards} currency={currency} />}>
                  {usage ? (
                    <>
                      <span className="relative my-2 block h-2 rounded-full border border-line-strong bg-surface [html[data-theme=dark]_&]:border-tile-ink [html[data-theme=dark]_&]:bg-tile-ink/10">
                        <span className="absolute inset-y-[-1px] left-0 rounded-full bg-tile-ink" style={{ width: `${Math.min(100, usage.percent)}%` }} />
                      </span>
                      {usage.percent}% of <span className="amt">{money(usage.limit, currency, { whole: true })}</span> limit used
                    </>
                  ) : (
                    plural(count('credit'), 'card')
                  )}
                </Tile>
              )}
              {totals.kinds.has('loan') && (
                <Tile tone={`bg-tile-4 ${PASTEL}`} label="Loans" value={<Amt value={-totals.loans} currency={currency} />}>
                  {plural(count('loan'), 'loan')}
                </Tile>
              )}
              {totals.otherAssets !== 0 && (
                <Tile tone="bg-surface-2 text-ink" label="Other" value={<Amt value={totals.otherAssets} currency={currency} />}>
                  {plural(counted.length - count('cash') - count('investment') - count('credit') - count('loan'), 'account')}
                </Tile>
              )}
            </div>

            {held.length > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-2">
                Held separately, not summed:{' '}
                {held.map((t, i) => {
                  const inCurrency = countedIn(list, t.currency)
                  const banks = [...new Set(inCurrency.map((b) => shortName(b.institutionName ?? 'Bank')))].join(', ')
                  const stale = inCurrency.some((b) => accountHealth(b, connections.data ?? [], now).severity === 'broken')
                  return (
                    <Fragment key={t.currency}>
                      {i > 0 && ' · '}
                      <span className={stale ? 'rounded-full border border-dashed border-ink-3 px-2 py-0.5' : undefined}>
                        <span className="amt">{formatMoney(t.net, t.currency)}</span> {banks}
                        {stale && ' (stale)'}
                      </span>
                    </Fragment>
                  )
                })}
              </p>
            )}
          </>
        ))}
    </OverviewCard>
  )
}
