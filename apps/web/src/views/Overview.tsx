import { useState } from 'react'
import { ConnectBank } from '../components/ConnectBank'
import { ConnectEuropeanBank } from '../components/ConnectEuropeanBank'
import { PossibleTransfers } from '../components/PossibleTransfers'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { Empty, ErrorState, Loading } from '../components/ui/States'
import { Money, PageHeader, SectionTitle } from '../components/ui/Typography'
import { getJson, listPossibleTransfers, type AccountBalance, type NotCountedKind, type Period, type Summary } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatMoney } from '../lib/format'
import { useResource } from '../lib/useResource'

const PERIODS: { value: Exclude<Period, 'this_week'>; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
]

const LINK = 'cursor-pointer underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink'

const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function Overview() {
  const { version, invalidate, navigate, reviewCount } = useApp()
  const [period, setPeriod] = useState<Exclude<Period, 'this_week'>>('this_month')
  const [currency, setCurrency] = useState<string | null>(null)

  const summary = useResource(
    (signal) =>
      getJson<Summary>(`/api/ledger/summary?period=${period}${currency ? `&currency=${encodeURIComponent(currency)}` : ''}`, signal),
    `${period}:${currency ?? ''}:${version}`,
  )

  const data = summary.data
  const noAccounts = data !== undefined && data.balances.length === 0
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase() ?? ''
  // The user's pick shows at once; once the scope turns out not to hold it, the server's fallback does.
  const shownCurrency = currency && (!data || data.currencies.includes(currency)) ? currency : (data?.currency ?? null)

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={today.format(new Date())}
        title="Overview"
        lede="Where your money stands, read straight from the ledger."
        actions={
          !noAccounts && (
            <>
              <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />
              {data && data.currencies.length > 1 && shownCurrency && (
                <Segmented
                  label="Currency"
                  value={shownCurrency}
                  options={data.currencies.map((c) => ({ value: c, label: c }))}
                  onChange={setCurrency}
                />
              )}
            </>
          )
        }
      />

      {noAccounts ? (
        <ConnectFirst onConnected={invalidate} />
      ) : (
        <>
          <section aria-label="Key figures">
            {data ? (
              <>
                <Kpis summary={data} period={period} periodLabel={periodLabel} onCurrency={setCurrency} />
                <AccountsLine balances={data.balances} onOpen={() => navigate('accounts')} />
              </>
            ) : summary.error ? (
              <ErrorState title="Couldn't load the summary" message={summary.error} onRetry={summary.reload} />
            ) : (
              <Loading label="Loading summary" rows={2} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <section className="lg:col-span-6">
              <SectionTitle aside={`Spent, ${periodLabel}`}>Where it went</SectionTitle>
              {data ? <CategoryBars summary={data} /> : summary.error ? null : <Loading rows={4} />}
            </section>

            <section className="lg:col-span-6">
              <SectionTitle aside={periodLabel}>Top merchants</SectionTitle>
              {data ? <Merchants summary={data} /> : summary.error ? null : <Loading rows={4} />}
            </section>
          </div>

          <section>
            <SectionTitle>Review</SectionTitle>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              {reviewCount === null ? (
                <p className="text-sm text-ink-3">The review queue is unavailable right now.</p>
              ) : reviewCount === 0 ? (
                <p className="text-sm text-ink-2">Nothing waiting. Every suggestion has been applied or decided.</p>
              ) : (
                <p className="text-[15px] text-ink-2">
                  <span className="figures font-display mr-2 text-[28px] leading-none text-ink">{reviewCount}</span>
                  {reviewCount === 1 ? 'suggestion is' : 'suggestions are'} waiting for your decision before they touch
                  the ledger.
                </p>
              )}
              <Button variant={reviewCount ? 'primary' : 'secondary'} onClick={() => navigate('review')}>
                Open review
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function ConnectFirst({ onConnected }: { onConnected: () => void }) {
  return (
    <section className="grid grid-cols-1 gap-8 border-y border-rule py-10 md:grid-cols-12">
      <div className="md:col-span-7">
        <p className="eyebrow mb-3">Getting started</p>
        <h2 className="text-[34px] leading-tight text-ink">Connect your first account.</h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">
          Fluide links to your bank through Plaid (US) or Enable Banking (Europe) with read-only access, imports
          your transactions into a double-entry ledger on your own server, and never has permission to move money.
        </p>
        <div className="mt-6 flex flex-col items-start gap-3">
          <ConnectBank onConnected={onConnected} />
          <ConnectEuropeanBank variant="secondary" />
        </div>
      </div>
      <ul className="flex flex-col gap-4 text-sm text-ink-2 md:col-span-5 md:border-l md:border-rule md:pl-8">
        <li>
          <p className="font-medium text-ink">Read-only by design</p>
          No payments, no transfers — the connection only reads.
        </li>
        <li>
          <p className="font-medium text-ink">Balanced, auditable ledger</p>
          Every transaction is a posting pair that sums to zero.
        </li>
        <li>
          <p className="font-medium text-ink">Your server, your data</p>
          Credentials stay in your deployment.
        </li>
      </ul>
    </section>
  )
}

const isDebt = (b: AccountBalance) => b.kind === 'credit' || b.kind === 'loan'

function AccountsLine({ balances, onOpen }: { balances: AccountBalance[]; onOpen: () => void }) {
  const counted = balances.filter((b) => b.countsTowardTotals)
  const attention = counted.filter(
    (b) => b.connectionStatus === 'reauth_required' || b.connectionStatus === 'error' || b.mismatch || b.balance === null,
  ).length
  const notCounted = balances.length - counted.length
  const parts: string[] = []
  if (attention > 0) parts.push(`${attention} need${attention === 1 ? 's' : ''} attention`)
  else if (notCounted === 0) parts.push('all connected')
  if (notCounted > 0) parts.push(`${notCounted} not counted`)
  return (
    <p className="figures flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-3 text-[13px] text-ink-2">
      <span>
        {balances.length} account{balances.length === 1 ? '' : 's'}
        {parts.map((part) => (
          <span key={part}>
            <span className="text-ink-3"> · </span>
            {part}
          </span>
        ))}
      </span>
      <button type="button" onClick={onOpen} className={LINK}>
        View accounts →
      </button>
    </p>
  )
}

const NOT_COUNTED_LABEL: Record<NotCountedKind, string> = {
  between_accounts: 'moved between your accounts',
  card_payoffs: 'card payments',
  invested: 'moved to investments',
  savings: 'moved to savings',
}

function Kpis({
  summary,
  period,
  periodLabel,
  onCurrency,
}: {
  summary: Summary
  period: Period
  periodLabel: string
  onCurrency: (currency: string) => void
}) {
  // Every figure is the server's chosen currency; balances in other currencies are noted, never added.
  const currency = summary.currency
  const known = summary.balances.flatMap((b) => (b.balance === null || !b.countsTowardTotals ? [] : [{ ...b, balance: b.balance }]))
  const totals: Record<string, number> = {}
  for (const b of known) totals[b.currency] = (totals[b.currency] ?? 0) + b.balance
  const others = Object.keys(totals)
    .filter((c) => c !== currency)
    .sort()
  const inCurrency = known.filter((b) => b.currency === currency)
  const assets = inCurrency.filter((b) => !isDebt(b)).reduce((sum, b) => sum + b.balance, 0)
  const owed = inCurrency.filter(isDebt).reduce((sum, b) => sum - b.balance, 0)
  const { income, expense, net, debtPayments } = summary.incomeVsExpense

  const cells = [
    {
      label: 'Net worth',
      value: <Money amount={totals[currency] ?? 0} currency={currency} />,
      note:
        `${formatMoney(assets, currency)} assets · ${formatMoney(owed, currency)} owed` +
        (others.length ? ` · plus ${others.map((c) => formatMoney(totals[c], c)).join(', ')}` : ''),
    },
    { label: 'Money in', value: <Money amount={income} currency={currency} />, note: periodLabel },
    {
      label: 'Money out',
      value: <Money amount={expense} currency={currency} />,
      note: periodLabel,
      detail: debtPayments > 0 ? `incl. ${formatMoney(debtPayments, currency)} debt payments` : undefined,
    },
    {
      label: 'Net',
      value: <Money amount={net} currency={currency} tone="flow" className={net < 0 ? 'text-red' : ''} />,
      note: net >= 0 ? 'more in than out' : 'more out than in',
    },
  ]
  const notCounted = summary.notCounted.filter((n) => n.count > 0)
  const otherCurrencies = summary.otherCurrencies

  return (
    <>
      <dl className="grid grid-cols-2 border-y border-rule lg:grid-cols-4">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={`flex flex-col gap-2 px-0 py-5 lg:px-6 lg:first:pl-0 ${i % 2 === 1 ? 'border-l border-rule pl-5' : ''} ${
              i >= 2 ? 'border-t border-rule lg:border-t-0' : ''
            } ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <dt className="eyebrow">{c.label}</dt>
            <dd className="font-display text-[30px] leading-none text-ink sm:text-[36px]">{c.value}</dd>
            <dd className="text-[12px] text-ink-3 first-letter:uppercase">{c.note}</dd>
            {c.detail && <dd className="figures text-[12px] text-ink-3">{c.detail}</dd>}
          </div>
        ))}
      </dl>
      {(notCounted.length > 0 || otherCurrencies.length > 0) && (
        <p className="figures pt-3 text-[12px] text-ink-3">
          Not counted:{' '}
          {notCounted.map((n, i) => (
            <span key={n.kind}>
              {i > 0 && ' · '}
              {`${formatMoney(n.total, currency)} ${NOT_COUNTED_LABEL[n.kind]} (${n.count})`}
            </span>
          ))}
          {otherCurrencies.map((o, i) => (
            <span key={o.currency}>
              {(notCounted.length > 0 || i > 0) && ' · '}
              <button type="button" onClick={() => onCurrency(o.currency)} title={`Switch the page to ${o.currency}`} className={LINK}>
                Other currency ({o.currency}){' '}
                {[o.moneyIn > 0 && `${formatMoney(o.moneyIn, o.currency)} in`, o.moneyOut > 0 && `${formatMoney(o.moneyOut, o.currency)} out`]
                  .filter(Boolean)
                  .join(', ')}{' '}
                ({o.count})
              </button>
            </span>
          ))}
          {otherCurrencies.length > 0 && ' — not in these totals'}
        </p>
      )}
      {summary.possibleTransfers.count > 0 && (
        <PossibleTransfers
          currency={currency}
          {...summary.possibleTransfers}
          load={(signal) => listPossibleTransfers(period, currency, signal)}
          loadKey={`${period}:${currency}`}
        />
      )}
    </>
  )
}

function CategoryBars({ summary }: { summary: Summary }) {
  const rows = summary.topCategories.slice(0, 7)
  const currency = summary.currency
  if (rows.length === 0) return <Empty title="No spending in this period" />
  const max = Math.max(...rows.map((r) => r.total), 1)
  const spent = summary.incomeVsExpense.spending
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-rule py-3">
          <span className="truncate text-[14px] text-ink">{r.category}</span>
          <span className="flex items-baseline gap-3">
            {spent > 0 && <span className="figures text-[12px] text-ink-3">{Math.round((r.total / spent) * 100)}%</span>}
            <Money amount={r.total} currency={currency} className="text-[14px]" />
          </span>
          <span aria-hidden className="col-span-2 block h-1 bg-paper-sunk">
            <span className="block h-full bg-green" style={{ width: `${(r.total / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Merchants({ summary }: { summary: Summary }) {
  const rows = summary.topMerchants.slice(0, 8)
  const currency = summary.currency
  if (rows.length === 0) return <Empty title="No merchants in this period" />
  return (
    <table className="w-full text-[14px]">
      <thead className="sr-only">
        <tr>
          <th>Merchant</th>
          <th>Transactions</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={m.merchant} className="border-b border-rule">
            <td className="py-3 pr-4 text-ink">
              <span className="figures mr-3 inline-block w-5 text-[12px] text-ink-3">{i + 1}</span>
              {m.merchant}
            </td>
            <td className="figures py-3 pr-4 text-right text-[12px] whitespace-nowrap text-ink-3">
              {m.count} {m.count === 1 ? 'txn' : 'txns'}
            </td>
            <td className="py-3 text-right">
              <Money amount={m.total} currency={currency} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
