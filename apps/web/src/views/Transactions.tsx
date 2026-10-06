import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import { Button, Empty, ErrorState, Loading, Notice, Select } from '@repo/ui/primitives'
import {
  CategorizeGlyph,
  DayHeading,
  DayTotal,
  dayTotals,
  groupByDay,
  groupByMonth,
  LedgerColumns,
  MonthDivider,
  MonthFlowSummary,
  MonthTotalsCard,
  SyncGlyph,
  TransactionRow,
  TransactionsView,
  WaitingStrip,
} from '@repo/ui/transactions'
import { SyncNotice } from '../components/SyncNotice'
import { TransactionDrawer, type DrawerRow } from '../components/TransactionDrawer'
import { errorMessage, sendJson, type Account, type CategorizeResult, type LedgerRow, type SyncOutcome, type CashFlowParams } from '../lib/api'
import { useDisplayCurrency } from '../lib/app-context'
import { toNumber } from '@repo/ui/format'
import { accountsOptions, cashFlowOptions, queryError, reviewQueueOptions, transactionsOptions } from '../lib/queries'

const UNCATEGORIZED = '__uncategorized'

const route = getRouteApi('/currency/transactions')

type Row = DrawerRow & { key: string }

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

function ledgerRows(transactions: LedgerRow[], accounts: Account[]): Row[] {
  const accountsById: Record<string, Account> = {}
  for (const acct of accounts) accountsById[acct.id] = acct
  return transactions.map((row) => ({
    ...row,
    key: row.posting.id ?? `${row.id}:${row.posting.accountId}`,
    accountName: row.account?.name ?? accountsById[row.posting.accountId]?.name ?? 'Unknown account',
    merchant: row.posting.counterpartyRaw || row.description,
  }))
}

export function Transactions() {
  const { q, category } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const currency = useDisplayCurrency()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [action, setAction] = useState<Action>({ kind: 'idle' })
  const [limit, setLimit] = useState(50)
  const [query, setQuery] = useState(q)
  const pushed = useRef(q)
  useEffect(() => {
    if (q === pushed.current) return
    pushed.current = q
    setQuery(q)
  }, [q])

  const setFilter = (next: { q?: string; category?: string }, replace = false) => {
    setLimit(50)
    if (next.q !== undefined) {
      pushed.current = next.q
      setQuery(next.q)
    }
    void navigate({ to: '/transactions', search: (prev) => ({ ...prev, ...next }), replace, resetScroll: false })
  }

  const accounts = useQuery(accountsOptions())
  const transactions = useQuery(transactionsOptions())
  const ledgerError = queryError(transactions) ?? queryError(accounts)
  const rows = useMemo(
    () => (transactions.data && accounts.data && !ledgerError ? ledgerRows(transactions.data, accounts.data) : undefined),
    [transactions.data, accounts.data, ledgerError],
  )

  const reviewQueue = useQuery(reviewQueueOptions())
  const waiting = reviewQueue.isError ? undefined : reviewQueue.data

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const cfParams: CashFlowParams = useMemo(() => ({ month: currentMonthStr, compare: 'average', accounts: [], currency }), [currentMonthStr, currency])
  const cashFlow = useQuery({ ...cashFlowOptions(cfParams), placeholderData: keepPreviousData })
  const cashFlowData = cashFlow.isError ? undefined : cashFlow.data

  const categoryOptions = useMemo(() => {
    const seen: Record<string, string> = {}
    for (const r of rows ?? []) {
      if (r.posting.categoryId && r.category?.label) seen[r.posting.categoryId] = r.category.label
    }
    return Object.entries(seen).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (category === UNCATEGORIZED ? r.posting.categoryId : category && r.posting.categoryId !== category) return false
      if (!q) return true
      return r.merchant.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    })
  }, [rows, query, category])

  const selected = rows?.find((r) => r.key === selectedKey)

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
      void queryClient.invalidateQueries()
    } catch (e) {
      setAction({ kind: 'done', tone: 'error', message: errorMessage(e) })
    }
  }

  const busy = action.kind === 'busy' ? action.which : null
  const uncategorizedCount = (rows ?? []).filter((r) => !r.posting.categoryId).length
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
    const currency = cashFlowData?.currency
    if (!currency || !monthInfo.get(month)?.currencies.has(currency)) return null
    return cashFlowData?.months.find((m) => m.month === month) ?? null
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
    <TransactionsView
      docked={!!selected && isDesktop}
      count={rows?.length ?? 0}
      headingRef={listHeadingRef}
      search={{ value: query, onChange: (q) => setFilter({ q }, true) }}
      shown={rows ? { visible: visible.length, total: rows.length } : null}
      drawer={selected && <TransactionDrawer key={selected.key} row={selected} onClose={closeDetail} docked={isDesktop} />}
      waiting={
        waiting &&
        waiting.length > 0 && (
          <WaitingStrip
            count={waiting.length}
            totals={Object.entries(
              waiting.reduce<Record<string, number>>((sums, item) => {
                if (item.posting) sums[item.posting.currency] = (sums[item.posting.currency] ?? 0) + Math.abs(toNumber(item.posting.amount))
                return sums
              }, {}),
            ).map(([currency, total]) => ({ currency, total }))}
          >
            <Button variant="primary" size="sm" onClick={() => void navigate({ to: '/review' })}>
              Review {waiting.length}
            </Button>
          </WaitingStrip>
        )
      }
      monthCard={
        cashFlow.isError ? (
          <ErrorState title="Couldn't load cash flow" message={queryError(cashFlow)} onRetry={() => void cashFlow.refetch()} />
        ) : !cashFlowData ? (
          <Loading label="Loading month summary" rows={3} />
        ) : (
          <MonthTotalsCard
            month={cashFlowData.month}
            currency={cashFlowData.currency}
            moneyOut={cashFlowData.totals.moneyOut}
            moneyIn={cashFlowData.totals.moneyIn}
            kept={cashFlowData.totals.kept}
          />
        )
      }
      actions={
        <>
          <Button size="sm" onClick={() => run('sync')} busy={busy === 'sync'} disabled={busy !== null}>
            {busy === 'sync' ? 'Syncing…' : (
              <>
                <SyncGlyph />
                Sync
              </>
            )}
          </Button>
          <Button variant="primary" size="sm" onClick={() => run('categorize')} busy={busy === 'categorize'} disabled={busy !== null}>
            {busy === 'categorize' ? 'Categorizing…' : (
              <>
                <CategorizeGlyph />
                Run categorization
                {uncategorizedCount > 0 && <small className="hidden text-[11px] font-medium opacity-[.65] min-[1360px]:inline-block">{uncategorizedCount} uncategorized</small>}
              </>
            )}
          </Button>
        </>
      }
      notices={
        <>
          {busy === 'categorize' && (
            <Notice>Categorizing uncategorized postings — rules first, then the Jev model. This can take a while.</Notice>
          )}
          {action.kind === 'done' && <Notice tone={action.tone}>{action.message}</Notice>}
          {action.kind === 'synced' && <SyncNotice outcomes={action.outcomes} />}
        </>
      }
      filter={
        <Select
          id="tx-category"
          aria-label="Filter by category"
          pill
          value={category}
          onChange={(e) => setFilter({ category: e.target.value })}
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
      }
    >
        {ledgerError ? (
          <ErrorState
            title="Couldn't load transactions"
            message={ledgerError}
            onRetry={() => {
              void transactions.refetch()
              void accounts.refetch()
            }}
          />
        ) : !rows ? (
          <Loading label="Loading transactions" rows={8} />
        ) : rows.length === 0 ? (
          <Empty title="No transactions yet">Connect a bank from the Overview, then sync. Sandbox accounts can take a moment to populate.</Empty>
        ) : visible.length === 0 ? (
          <Empty title="No matching transactions">Try a different search or category.</Empty>
        ) : (
          <>
            <LedgerColumns />
            {groupByMonth(visible.slice(0, limit)).map((g) => (
              <Fragment key={g.month}>
                <MonthDivider label={g.label}>
                  {(() => {
                    const flow = monthFlow(g.month)
                    const currency = cashFlowData?.currency
                    if (!flow || !currency) {
                      const count = monthInfo.get(g.month)?.count ?? g.rows.length
                      return <span className="ml-auto text-[12px] text-ink-3">{count} row{count !== 1 ? 's' : ''}</span>
                    }
                    return <MonthFlowSummary moneyIn={flow.moneyIn} moneyOut={flow.moneyOut} net={flow.net} currency={currency} />
                  })()}
                </MonthDivider>
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
                        mainCurrency={cashFlowData?.currency}
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
    </TransactionsView>
  )
}
