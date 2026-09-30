import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import { SyncNotice } from '../components/SyncNotice'
import { TransactionDrawer, type DrawerRow } from '../components/TransactionDrawer'
import { DayHeading } from '../components/TransactionDay'
import { groupByDay } from '../components/groupByDay'
import { TransactionRow } from '../components/TransactionRow'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Field'
import { Empty, ErrorState, Loading, Notice } from '../components/ui/States'
import { errorMessage, getJson, sendJson, getCashFlow, type Account, type CategorizeResult, type LedgerRow, type SyncOutcome, type ReviewItem, type CashFlowParams } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatMoneyParts, formatMoney, toNumber } from '../lib/format'
import { useResource } from '../lib/useResource'

const UNCATEGORIZED = '__uncategorized'

type Row = DrawerRow & { key: string }

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthOnlyLabel = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })

function MoneyParts({ value, currency }: { value: number; currency: string }) {
  const { whole, fraction } = formatMoneyParts(value, currency, 'never')
  return (
    <span className="amt">
      {whole}
      {fraction && <small className="opacity-55" style={{ color: 'inherit' }}>{fraction}</small>}
    </span>
  )
}

function groupByMonth(rows: Row[]) {
  const groups: { month: string; label: string; rows: Row[] }[] = []
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

type DayInfo = { count: number; total: number | null; currency: string | null }

function dayTotals(rows: Row[]) {
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

function DayTotal({ info }: { info: DayInfo }) {
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

type Action =
  | { kind: 'idle' }
  | { kind: 'busy'; which: 'sync' | 'categorize' }
  | { kind: 'done'; tone: 'success' | 'error'; message: string }
  | { kind: 'synced'; outcomes: SyncOutcome[] }
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1280 : false)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1280px)')
    const fn = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return isDesktop
}

export function Transactions() {
  const { version, invalidate, navigate } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [action, setAction] = useState<Action>({ kind: 'idle' })
  const [limit, setLimit] = useState(50)

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

  const reviewQueue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items),
    version
  )

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const cfParams: CashFlowParams = useMemo(() => ({ month: currentMonthStr, compare: 'average', accounts: [], currency: null }), [currentMonthStr])
  const cashFlow = useResource((signal) => getCashFlow(cfParams, signal), `${currentMonthStr}|${version}`)

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
  const isDesktop = useIsDesktop()
  const listHeadingRef = useRef<HTMLHeadingElement>(null)

  const monthInfo = useMemo(() => {
    const info = new Map<string, { count: number; currencies: Set<string> }>()
    for (const r of visible) {
      const month = r.date.slice(0, 7)
      const entry = info.get(month) ?? { count: 0, currencies: new Set<string>() }
      entry.count++
      entry.currencies.add(r.posting.currency)
      info.set(month, entry)
    }
    return info
  }, [visible])

  const dayInfo = useMemo(() => dayTotals(visible), [visible])

  const monthFlow = (month: string) => {
    const currency = cashFlow.data?.currency
    if (!currency || !monthInfo.get(month)?.currencies.has(currency)) return null
    return cashFlow.data?.months.find((m) => m.month === month) ?? null
  }

  const closeDetail = () => {
    const key = selectedKey
    setSelectedKey(null)
    if (!key) return
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`)
      const target = row ?? listHeadingRef.current
      target?.focus()
    })
  }

  return (
    <div className={`-mx-[28px] -mb-[30px] mt-[20px] min-h-0 flex-1 border-t border-line ${selected && isDesktop ? 'grid grid-cols-[minmax(0,1fr)_372px]' : 'flex flex-col'}`}>
      <div className="flex min-w-0 flex-col gap-[16px] p-[20px_28px_30px]">
        {/* 1. Review strip */}
        {reviewQueue.data && reviewQueue.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-line bg-surface p-[10px_12px_10px_14px] text-[13px] shadow-1" role="status">
          <span className="flex items-center gap-2 whitespace-nowrap font-bold text-ink">
            <span className="size-[10px] rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]"></span>
            {reviewQueue.data.length} waiting ·{' '}
            {(() => {
              const sums: Record<string, number> = {}
              for (const item of reviewQueue.data) {
                if (!item.posting) continue
                const curr = item.posting.currency
                sums[curr] = (sums[curr] || 0) + Math.abs(toNumber(item.posting.amount))
              }
              const entries = Object.entries(sums)
              return entries.map(([curr, amount], i) => (
                <Fragment key={curr}>
                  <span className="amt">{formatMoney(amount, curr, 'never')}</span>
                  {i < entries.length - 1 ? ' · ' : ''}
                </Fragment>
              ))
            })()}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => navigate('review')}>
              Review {reviewQueue.data.length}
            </Button>
          </span>
        </div>
      )}

      {/* 2. Out in <Month> card */}
      {cashFlow.error ? (
        <ErrorState title="Couldn't load cash flow" message={cashFlow.error} onRetry={cashFlow.reload} />
      ) : !cashFlow.data ? (
        <Loading label="Loading month summary" rows={3} />
      ) : (
        <div className="@container">
          <section
            className="grid grid-cols-1 overflow-hidden rounded-lg bg-surface-inverse text-ink-inverse @[600px]:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]"
            aria-label={`${monthLabel.format(new Date(`${cashFlow.data.month}-01T00:00:00Z`))} ledger`}
          >
            <div className="flex flex-col gap-[6px] p-[20px_22px]">
              <div className="flex items-center gap-[8px] text-[12.5px] font-semibold opacity-[.78]">
                Out in {monthOnlyLabel.format(new Date(`${cashFlow.data.month}-01T00:00:00Z`))} · {cashFlow.data.currency}
              </div>
              <div className="mt-[6px] whitespace-nowrap font-display text-[44px] font-[800] leading-none tracking-[-0.03em]">
                {cashFlow.data.totals.moneyOut > 0 && '\u2212'}
                <MoneyParts value={cashFlow.data.totals.moneyOut} currency={cashFlow.data.currency} />
              </div>
            </div>
            <div className="flex min-w-0 flex-row gap-[22px] border-t border-ink-inverse/20 p-[16px_22px] @[600px]:flex-col @[600px]:gap-[10px] @[600px]:border-t-0 @[600px]:border-l @[600px]:p-[18px_22px_16px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-[8px] text-[11px] font-semibold opacity-[.8]">
                  In
                </div>
                <div className="mt-[6px] whitespace-nowrap font-display text-[26px] font-[800] leading-none tracking-[-0.03em]">
                  <MoneyParts value={cashFlow.data.totals.moneyIn} currency={cashFlow.data.currency} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-[8px] text-[11px] font-semibold opacity-[.8]">
                  Kept
                </div>
                <div className="mt-[6px] whitespace-nowrap font-display text-[26px] font-[800] leading-none tracking-[-0.03em]">
                  {cashFlow.data.totals.kept >= 0 ? '+' : '\u2212'}
                  <MoneyParts value={Math.abs(cashFlow.data.totals.kept)} currency={cashFlow.data.currency} />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. Transactions card */}
      <div className="flex items-end gap-[12px]">
        <div>
          <h2 ref={listHeadingRef} tabIndex={-1} className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink outline-none">Ledger</h2>
          <p className="mt-[3px] text-[12px] text-ink-3">{ledger.data?.length ?? 0} transactions · all accounts</p>
        </div>
        <div className="ml-auto flex gap-[8px]">
          <Button
            size="sm"
            onClick={() => run('sync')}
            busy={busy === 'sync'}
            disabled={busy !== null}
          >
            {busy === 'sync' ? 'Syncing…' : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[14px]"><path d="M13.5 6.5A5.6 5.6 0 0 0 3.2 4.6M2.5 9.5a5.6 5.6 0 0 0 10.3 1.9"/><path d="M3 1.8v3h3M13 14.2v-3h-3"/></svg>
                Sync
              </>
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => run('categorize')}
            busy={busy === 'categorize'}
            disabled={busy !== null}
          >
            {busy === 'categorize' ? 'Categorizing…' : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[14px]"><path d="M14 8.5L7.5 15l-6-6V2h7l6.5 6.5z"/><circle cx="5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/></svg>
                Run categorization
                {uncategorizedCount > 0 && <small className="hidden text-[11px] font-medium opacity-[.65] min-[1360px]:inline-block">{uncategorizedCount} uncategorized</small>}
              </>
            )}
          </Button>
        </div>
      </div>

      {busy === 'categorize' && (
        <Notice>Categorizing uncategorized postings — rules first, then the Jev model. This can take a while.</Notice>
      )}
      {action.kind === 'done' && <Notice tone={action.tone}>{action.message}</Notice>}
      {action.kind === 'synced' && <SyncNotice outcomes={action.outcomes} />}

      <div className="flex flex-wrap items-center gap-[8px]">
        <label className="flex h-[34px] min-w-[170px] max-w-[260px] flex-1 items-center gap-[8px] rounded-[17px] border border-line bg-surface px-[12px] transition-colors focus-within:border-line-strong hover:border-line-strong">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-[14px] flex-none text-ink-3">
            <circle cx="7" cy="7" r="4.8" />
            <path d="m10.5 10.5 3.5 3.5" />
          </svg>
          <input
            id="tx-search"
            type="search"
            aria-label="Search merchant or description"
            placeholder="Search merchant or description"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(50)
            }}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <Select
          id="tx-category"
          aria-label="Filter by category"
          pill
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setLimit(50)
          }}
          className="w-auto sm:w-[150px]"
        >
          <option value="">All categories</option>
          <option value={UNCATEGORIZED}>Uncategorized{uncategorizedCount ? ` (${uncategorizedCount})` : ''}</option>
          {categoryOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        {ledger.data && (
          <span className="ml-auto whitespace-nowrap text-[12px] text-ink-3">
            <span className="font-display text-[15px] font-[800] text-ink">{visible.length}</span> of {ledger.data.length}
          </span>
        )}
      </div>

      <div data-tx-list className="mt-[16px] overflow-hidden rounded-lg border border-line bg-surface shadow-1">
        {ledger.error ? (
          <ErrorState title="Couldn't load transactions" message={ledger.error} onRetry={ledger.reload} />
        ) : !ledger.data ? (
          <Loading label="Loading transactions" rows={8} />
        ) : ledger.data.length === 0 ? (
          <Empty title="No transactions yet">Connect a bank from the Overview, then sync. Sandbox accounts can take a moment to populate.</Empty>
        ) : visible.length === 0 ? (
          <Empty title="No matching transactions">Try a different search or category.</Empty>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_108px] items-center gap-[8px] border-b border-line bg-surface-2 p-[8px_14px] text-[10.5px] font-semibold uppercase leading-[1.2] tracking-[0.08em] text-ink-3 sm:grid min-[1360px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_124px] min-[1360px]:gap-[12px]">
              <span>Merchant · Account</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>
            {groupByMonth(visible.slice(0, limit)).map((g) => (
              <Fragment key={g.month}>
                <div className="flex flex-wrap items-baseline gap-[12px] border-b border-line p-[14px_14px_12px]">
                  <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">{g.label}</h3>
                  {(() => {
                    const flow = monthFlow(g.month)
                    const currency = cashFlow.data?.currency
                    if (!flow || !currency) {
                      const count = monthInfo.get(g.month)?.count ?? g.rows.length
                      return <span className="ml-auto text-[12px] text-ink-3">{count} row{count !== 1 ? 's' : ''}</span>
                    }
                    return (
                      <div className="ml-auto flex flex-wrap items-baseline justify-end gap-[10px] text-[12px] text-ink-2">
                        <span>
                          In <span className="amt">{formatMoney(flow.moneyIn, currency, 'never')}</span> ·{' '}
                          Out <span className="amt">{formatMoney(flow.moneyOut, currency, 'never')}</span> ·{' '}
                          net <b className="font-display text-[16px] font-[800] text-ink">
                            {flow.net >= 0 ? '+' : '\u2212'}<span className="amt">{formatMoney(Math.abs(flow.net), currency, 'never')}</span>
                          </b>
                        </span>
                      </div>
                    )
                  })()}
                </div>
                {groupByDay(g.rows).map((dGroup) => {
                  const day = dayInfo[dGroup.date]
                  return (
                  <Fragment key={dGroup.date}>
                    <DayHeading group={dGroup} count={day.count}>
                      <DayTotal info={day} />
                    </DayHeading>
                    {dGroup.rows.map((r) => (
                      <TransactionRow
                        key={r.key}
                        row={r}
                        selected={selectedKey === r.key}
                        onClick={() => setSelectedKey(r.key)}
                        mainCurrency={cashFlow.data?.currency}
                      />
                    ))}
                  </Fragment>
                  )
                })}
              </Fragment>
            ))}
            {visible.length > limit && (
              <div className="border-t border-line p-[14px] text-center text-[12.5px] text-ink-2">
                Latest {limit} rows ·{' '}
                <button
                  type="button"
                  onClick={() => setLimit(l => l + 50)}
                  className="font-semibold text-ink border-b border-line-strong hover:border-ink pb-[1px]"
                >
                  Show {Math.min(50, visible.length - limit)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      </div>
      {selected && <TransactionDrawer key={selected.key} row={selected} onClose={closeDetail} docked={isDesktop} />}
    </div>
  )
}
