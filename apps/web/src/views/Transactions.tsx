import { Fragment, useMemo, useState } from 'react'
import { SyncNotice } from '../components/SyncNotice'
import { TransactionDrawer, type DrawerRow } from '../components/TransactionDrawer'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { Empty, ErrorState, Loading, Notice } from '../components/ui/States'
import { Money, PageHeader } from '../components/ui/Typography'
import { errorMessage, getJson, sendJson, type Account, type CategorizeResult, type LedgerRow, type SyncOutcome } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatLedgerDate, toNumber } from '../lib/format'
import { useResource } from '../lib/useResource'

const UNCATEGORIZED = '__uncategorized'

type Row = DrawerRow & { key: string }

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Statement-style sections; net is shown only when the month is single-currency. */
function groupByMonth(rows: Row[]) {
  const groups: { month: string; label: string; rows: Row[]; net: number | null }[] = []
  for (const r of rows) {
    const month = r.date.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.month !== month) {
      g = { month, label: monthLabel.format(new Date(r.date)), rows: [], net: 0 }
      groups.push(g)
    }
    g.rows.push(r)
  }
  for (const g of groups) {
    const currency = g.rows[0].posting.currency
    g.net = g.rows.every((r) => r.posting.currency === currency) ? g.rows.reduce((sum, r) => sum + toNumber(r.posting.amount), 0) : null
  }
  return groups
}

type Action =
  | { kind: 'idle' }
  | { kind: 'busy'; which: 'sync' | 'categorize' }
  | { kind: 'done'; tone: 'success' | 'error'; message: string }
  | { kind: 'synced'; outcomes: SyncOutcome[] }

export function Transactions() {
  const { version, invalidate } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [action, setAction] = useState<Action>({ kind: 'idle' })

  const ledger = useResource(async (signal) => {
    const [a, t] = await Promise.all([
      getJson<{ accounts: Account[] }>('/api/ledger/accounts', signal),
      getJson<{ transactions: LedgerRow[] }>('/api/ledger/transactions', signal),
    ])
    const accountsById: Record<string, Account> = {}
    for (const acct of a.accounts) accountsById[acct.id] = acct
    const rows: Row[] = []
    for (const row of t.transactions) {
      const acct = accountsById[row.posting.accountId]
      rows.push({
        ...row,
        key: row.posting.id ?? `${row.id}:${row.posting.accountId}`,
        accountName: row.account?.name ?? acct?.name ?? 'Unknown account',
        merchant: row.posting.counterpartyRaw || row.description,
      })
    }
    return rows
  }, version)

  const categoryOptions = useMemo(() => {
    const seen: Record<string, string> = {}
    for (const r of ledger.data ?? []) {
      if (r.posting.categoryId && r.category?.label) seen[r.posting.categoryId] = r.category.label
    }
    return Object.entries(seen).sort((a, b) => a[1].localeCompare(b[1]))
  }, [ledger.data])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (ledger.data ?? []).filter((r) => {
      if (category === UNCATEGORIZED ? r.posting.categoryId : category && r.posting.categoryId !== category) return false
      if (!q) return true
      return r.merchant.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    })
  }, [ledger.data, query, category])

  const selected = ledger.data?.find((r) => r.key === selectedKey)

  const run = async (which: 'sync' | 'categorize') => {
    setAction({ kind: 'busy', which })
    try {
      if (which === 'sync') {
        const { synced } = await sendJson<{ synced: SyncOutcome[] }>('POST', '/api/providers/sync', undefined, 120_000)
        setAction({ kind: 'synced', outcomes: synced })
      } else {
        const { result } = await sendJson<{ result: CategorizeResult }>('POST', '/api/assistant/categorize', undefined, 180_000)
        setAction({
          kind: 'done',
          tone: 'success',
          message: `Checked ${result.checked} · categorized ${result.categorized} (${result.byTier.rule} by rule, ${result.byTier.jev} by Jev) · ${result.queuedForReview} sent to review · ${result.uncategorized} left uncategorized.`,
        })
      }
      invalidate()
    } catch (e) {
      setAction({ kind: 'done', tone: 'error', message: errorMessage(e) })
    }
  }

  const busy = action.kind === 'busy' ? action.which : null
  const uncategorizedCount = (ledger.data ?? []).filter((r) => !r.posting.categoryId).length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        lede="Every posting against your bank accounts, newest first."
        actions={
          <>
            <Button onClick={() => run('sync')} busy={busy === 'sync'} disabled={busy !== null}>
              {busy === 'sync' ? 'Syncing…' : 'Sync bank'}
            </Button>
            <Button variant="primary" onClick={() => run('categorize')} busy={busy === 'categorize'} disabled={busy !== null}>
              {busy === 'categorize' ? 'Categorizing…' : 'Run categorization'}
            </Button>
          </>
        }
      />

      {busy === 'categorize' && (
        <Notice>Categorizing uncategorized postings — rules first, then the Jev model. This can take a while.</Notice>
      )}
      {action.kind === 'done' && <Notice tone={action.tone}>{action.message}</Notice>}
      {action.kind === 'synced' && <SyncNotice outcomes={action.outcomes} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="tx-search">
          Search merchant or description
        </label>
        <Input
          id="tx-search"
          type="search"
          placeholder="Search merchant or description"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        <label className="sr-only" htmlFor="tx-category">
          Filter by category
        </label>
        <Select id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-64">
          <option value="">All categories</option>
          <option value={UNCATEGORIZED}>Uncategorized{uncategorizedCount ? ` (${uncategorizedCount})` : ''}</option>
          {categoryOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        {ledger.data && (
          <p className="figures text-[13px] text-ink-3 sm:ml-auto">
            {visible.length} of {ledger.data.length}
          </p>
        )}
      </div>

      {ledger.error ? (
        <ErrorState title="Couldn't load transactions" message={ledger.error} onRetry={ledger.reload} />
      ) : !ledger.data ? (
        <Loading label="Loading transactions" rows={8} />
      ) : ledger.data.length === 0 ? (
        <Empty title="No transactions yet">Connect a bank from the Overview, then sync. Sandbox accounts can take a moment to populate.</Empty>
      ) : visible.length === 0 ? (
        <Empty title="No matching transactions">Try a different search or category.</Empty>
      ) : (
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th scope="col" className="eyebrow w-20 py-2 pr-3 font-[550] md:w-24 md:pr-4">
                Date
              </th>
              <th scope="col" className="eyebrow py-2 pr-4 font-[550]">
                Merchant
              </th>
              <th scope="col" className="eyebrow hidden py-2 pr-4 font-[550] lg:table-cell">
                Account
              </th>
              <th scope="col" className="eyebrow hidden py-2 pr-4 font-[550] md:table-cell">
                Category
              </th>
              <th scope="col" className="eyebrow py-2 text-right font-[550]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {groupByMonth(visible).map((g) => (
              <Fragment key={g.month}>
                <tr>
                  <th scope="colgroup" colSpan={5} className="pt-7 pb-2 text-left font-[450]">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="font-display text-[19px] text-ink">{g.label}</span>
                      {g.net !== null && (
                        <span className="text-[12px] font-normal text-ink-3">
                          Net <Money amount={g.net} currency={g.rows[0].posting.currency} tone="flow" />
                        </span>
                      )}
                    </span>
                  </th>
                </tr>
                {g.rows.map((r) => (
                <tr
                  key={r.key}
                  onClick={() => setSelectedKey(r.key)}
                  className={`cursor-pointer border-b border-rule transition-colors hover:bg-paper-sunk/70 ${
                    r.key === selectedKey ? 'bg-paper-sunk' : ''
                  }`}
                >
                  <td className="figures py-3 pr-4 align-top whitespace-nowrap text-ink-3">{formatLedgerDate(r.date)}</td>
                  <td className="py-3 pr-4 align-top">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedKey(r.key)
                      }}
                      className="text-left text-ink hover:underline hover:decoration-rule-strong hover:underline-offset-4"
                    >
                      {r.merchant}
                    </button>
                    {r.status === 'pending' && <span className="ml-2 text-[12px] text-amber">Pending</span>}
                    {!r.countsTowardTotals && (
                      <span className="ml-2 inline-block rounded-[5px] border border-rule px-1.5 text-[11px] leading-[18px] font-medium text-ink-3">
                        not counted (replaced login)
                      </span>
                    )}
                    <p className="mt-0.5 text-[12px] text-ink-3 md:hidden">
                      {r.category?.label ?? 'Uncategorized'} · {r.accountName}
                    </p>
                  </td>
                  <td className="hidden py-3 pr-4 align-top text-ink-2 lg:table-cell">{r.accountName}</td>
                  <td className="hidden py-3 pr-4 align-top md:table-cell">
                    {r.category?.label ? (
                      <span className="text-ink-2">{r.category.label}</span>
                    ) : (
                      <span className="text-ink-3 italic">Uncategorized</span>
                    )}
                  </td>
                  <td className="py-3 text-right align-top">
                    <Money amount={r.posting.amount} currency={r.posting.currency} tone="flow" />
                  </td>
                </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {selected && <TransactionDrawer key={selected.key} row={selected} onClose={() => setSelectedKey(null)} />}
    </div>
  )
}
