import { useState } from 'react'
import { ConnectBank } from '../components/ConnectBank'
import { ConnectEuropeanBank } from '../components/ConnectEuropeanBank'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { Empty, ErrorState, Loading } from '../components/ui/States'
import { Money, PageHeader, SectionTitle } from '../components/ui/Typography'
import { getJson, type Account, type Period, type Summary } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories, categoryName } from '../lib/categories'
import { formatMoney } from '../lib/format'
import { useResource } from '../lib/useResource'

/** SOURCE OF TRUTH: the Overview screen.
 * WHAT: period-scoped GET /api/summary (KPIs, balances, top categories and
 * merchants) plus GET /accounts to decide whether to lead with "Connect a
 * bank", and the pending-review count from app context.
 * WHY: the first thing a person needs is where they stand; everything else
 * is one click away. Equity accounts are internal suspense legs and never
 * count as a bank account here.
 * WHERE: read-only rendering; bank connection is delegated to ConnectBank.
 */

const PERIODS: { value: Exclude<Period, 'this_week'>; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
]

const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function Overview() {
  const { version, invalidate, navigate, reviewCount } = useApp()
  const [period, setPeriod] = useState<Exclude<Period, 'this_week'>>('this_month')

  const accounts = useResource(
    (signal) => getJson<{ accounts: Account[] }>('/accounts', signal).then((r) => r.accounts.filter((a) => a.type !== 'equity')),
    version,
  )
  const summary = useResource(
    (signal) => getJson<Summary>(`/api/summary?period=${period}`, signal),
    `${period}:${version}`,
  )
  const categories = useCategories()

  const noAccounts = accounts.data !== undefined && accounts.data.length === 0
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase()

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={today.format(new Date())}
        title="Overview"
        lede="Where your money stands, read straight from the ledger."
        actions={
          !noAccounts && <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />
        }
      />

      {accounts.error && <ErrorState title="Couldn't load your accounts" message={accounts.error} onRetry={accounts.reload} />}

      {noAccounts ? (
        <ConnectFirst onConnected={invalidate} />
      ) : (
        <>
          <section aria-label="Key figures">
            {summary.data ? (
              <Kpis summary={summary.data} periodLabel={periodLabel ?? ''} />
            ) : summary.error ? (
              <ErrorState title="Couldn't load the summary" message={summary.error} onRetry={summary.reload} />
            ) : (
              <Loading label="Loading summary" rows={2} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <section className="lg:col-span-5">
              <SectionTitle aside="Asset accounts">Accounts</SectionTitle>
              {summary.data ? (
                summary.data.balances.length === 0 ? (
                  <Empty title="No balances yet">Balances appear once transactions have synced.</Empty>
                ) : (
                  <ul>
                    {summary.data.balances.map((b) => (
                      <li key={`${b.name}:${b.currency}`} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                        <span className="min-w-0 truncate text-[15px] text-ink">{b.name}</span>
                        <Money amount={b.balance} currency={b.currency} className="font-display text-[19px]" />
                      </li>
                    ))}
                  </ul>
                )
              ) : summary.error ? (
                <p className="py-3 text-[13px] text-ink-3">Balances come from the summary, which is unavailable.</p>
              ) : (
                <Loading rows={3} />
              )}
              <div className="mt-5 flex flex-col items-start gap-3">
                <ConnectBank onConnected={invalidate} variant="secondary" showSandboxHint={false} />
                <ConnectEuropeanBank variant="secondary" />
              </div>
            </section>

            <section className="lg:col-span-7">
              <SectionTitle aside={`Spent, ${periodLabel}`}>Where it went</SectionTitle>
              {summary.data ? (
                <CategoryBars summary={summary.data} name={(ref) => categoryName(categories.data, ref)} />
              ) : summary.error ? null : (
                <Loading rows={4} />
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <section className="lg:col-span-7">
              <SectionTitle aside={periodLabel}>Top merchants</SectionTitle>
              {summary.data ? (
                <Merchants summary={summary.data} />
              ) : summary.error ? null : (
                <Loading rows={4} />
              )}
            </section>

            <section className="lg:col-span-5">
              <SectionTitle>Review</SectionTitle>
              <div className="flex flex-col items-start gap-4 pt-2">
                {reviewCount === null ? (
                  <p className="text-sm text-ink-3">The review queue is unavailable right now.</p>
                ) : reviewCount === 0 ? (
                  <p className="text-sm text-ink-2">Nothing waiting. Every suggestion has been applied or decided.</p>
                ) : (
                  <p className="text-[15px] leading-relaxed text-ink-2">
                    <span className="figures font-display text-[40px] leading-none text-ink">{reviewCount}</span>
                    <br />
                    {reviewCount === 1 ? 'suggestion is' : 'suggestions are'} waiting for your decision before they
                    touch the ledger.
                  </p>
                )}
                <Button variant={reviewCount ? 'primary' : 'secondary'} onClick={() => navigate('review')}>
                  Open review
                </Button>
              </div>
            </section>
          </div>
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

function Kpis({ summary, periodLabel }: { summary: Summary; periodLabel: string }) {
  // Totals are per currency; the headline uses the currency most balances are in.
  const totals: Record<string, number> = {}
  for (const b of summary.balances) totals[b.currency] = (totals[b.currency] ?? 0) + b.balance
  const currencies = Object.keys(totals).sort(
    (a, b) => summary.balances.filter((x) => x.currency === b).length - summary.balances.filter((x) => x.currency === a).length,
  )
  const currency = currencies[0] ?? 'USD'
  const others = currencies.slice(1)
  const { income, expense, net } = summary.incomeVsExpense

  const cells = [
    {
      label: 'Total balance',
      value: <Money amount={totals[currency] ?? 0} currency={currency} />,
      note: others.length
        ? `plus ${others.map((c) => formatMoney(totals[c], c)).join(', ')}`
        : `across ${summary.balances.length} ${summary.balances.length === 1 ? 'account' : 'accounts'}`,
    },
    { label: 'Money in', value: <Money amount={income} currency={currency} />, note: periodLabel },
    { label: 'Money out', value: <Money amount={expense} currency={currency} />, note: periodLabel },
    {
      label: 'Net',
      value: <Money amount={net} currency={currency} tone="flow" className={net < 0 ? 'text-red' : ''} />,
      note: net >= 0 ? 'more in than out' : 'more out than in',
    },
  ]

  return (
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
        </div>
      ))}
    </dl>
  )
}

function CategoryBars({ summary, name }: { summary: Summary; name: (ref: string) => string }) {
  const rows = summary.topCategories.slice(0, 7)
  const currency = summary.balances[0]?.currency ?? 'USD'
  if (rows.length === 0) return <Empty title="No spending in this period" />
  const max = Math.max(...rows.map((r) => r.total), 1)
  const spent = summary.incomeVsExpense.expense
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-rule py-3">
          <span className="truncate text-[14px] text-ink">{name(r.category)}</span>
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
  const currency = summary.balances[0]?.currency ?? 'USD'
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
