import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccountIcon } from '../components/AccountIcon'
import { BalanceSheet } from '../components/accounts/BalanceSheet'
import { DataAge } from '../components/accounts/DataAge'
import { NeedsYou } from '../components/accounts/NeedsYou'
import { NetWorthCard } from '../components/accounts/NetWorthCard'
import { OweCard } from '../components/accounts/OweCard'
import { balanceLabel, balanceText, CARD, displayBalance, identity, isDebt, isLive, TAG, totalsByCurrency } from '../components/accounts/model'
import { MismatchNote } from '../components/accounts/shared'
import { ConnectBank } from '../components/ConnectBank'
import { ConnectEuropeanBank } from '../components/ConnectEuropeanBank'
import { Empty, ErrorState, Loading } from '../components/ui/States'
import { Money } from '../components/ui/Typography'
import { getJson, type AccountBalance, type ConnectionStatus, type ConnectionSummary, type LedgerRow } from '../lib/api'
import { useApp } from '../lib/app-context'
import { summarizeConnections, timeAgo } from '../lib/connection-health'
import { formatLedgerDate, formatLocalDate, formatMoney, formatTimestamp } from '../lib/format'
import { useResource } from '../lib/useResource'

const STRIP = 'bg-surface-2/60'
const PREVIEW_ROWS = 10

const STATUS_DOT: Record<ConnectionStatus, string> = {
  active: 'bg-positive',
  reauth_required: 'bg-broken',
  error: 'bg-broken',
  disconnected: 'bg-ink-3',
}

const ADD_CONNECTION = '#add-connection'

/** Settings mounts after `navigate`; bring its "Add a connection" section into view as soon as it exists. */
function showAddConnection(tries = 20) {
  const section = document.querySelector<HTMLElement>(ADD_CONNECTION)
  if (section) {
    section.tabIndex = -1
    section.scrollIntoView({ block: 'start' })
    section.focus({ preventScroll: true })
  } else if (tries > 0) {
    requestAnimationFrame(() => showAddConnection(tries - 1))
  }
}

export function Accounts() {
  const { version, invalidate, navigate } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const accounts = useResource(
    (signal) => getJson<{ accounts: AccountBalance[] }>('/api/ledger/account-balances', signal).then((r) => r.accounts),
    version,
  )
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )

  const returnTo = useRef<string | null>(null)

  const select = (id: string | null) => {
    if (id === null) returnTo.current = selectedId
    setSelectedId(id)
    window.scrollTo({ top: 0 })
  }

  const data = accounts.data
  const selected = data?.find((a) => a.id === selectedId)
  const listShown = !selected && data !== undefined
  useEffect(() => {
    if (!listShown || returnTo.current === null) return
    document.querySelector<HTMLElement>(`[data-account-row="${CSS.escape(returnTo.current)}"]`)?.focus()
    returnTo.current = null
  }, [listShown])
  if (selected) return <AccountDetail key={selected.id} account={selected} onBack={() => select(null)} />

  return (
    <div className="flex flex-col gap-5">
      {accounts.error ? (
        <ErrorState title="Couldn't load your accounts" message={accounts.error} onRetry={accounts.reload} />
      ) : !data ? (
        <Loading label="Loading accounts" rows={4} />
      ) : data.length === 0 ? (
        <Empty title="No accounts yet">
          Connect a bank and your accounts will appear here.
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ConnectBank onConnected={invalidate} variant="secondary" showSandboxHint={false} />
            <ConnectEuropeanBank variant="secondary" />
          </div>
        </Empty>
      ) : (
        <AccountsBody
          accounts={data}
          connections={connections.data}
          connectionsError={connections.error}
          onOpen={select}
          onSettings={() => navigate('settings')}
          onAddBank={() => {
            navigate('settings')
            requestAnimationFrame(() => showAddConnection())
          }}
        />
      )}
    </div>
  )
}

function AccountsBody({
  accounts,
  connections,
  connectionsError,
  onOpen,
  onSettings,
  onAddBank,
}: {
  accounts: AccountBalance[]
  connections: ConnectionSummary[] | undefined
  connectionsError: string | null
  onOpen: (id: string) => void
  onSettings: () => void
  onAddBank: () => void
}) {
  const live = accounts.filter(isLive)
  const main = totalsByCurrency(live).find((t) => t.currency === 'USD')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever connections are (re)loaded
  const now = useMemo(() => Date.now(), [connections])
  const { live: liveConnections, syncStamp: stamp } = summarizeConnections(connections ?? [], now)
  const hasDebt = main !== undefined && main.owed > 0
  const showAge = liveConnections.length > 0

  return (
    <>
      <NeedsYou connections={connections} error={connectionsError} now={now} onSettings={onSettings} />
      {!main && live.length > 0 && (
        <p role="status" className="rounded-md border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-2">
          No net worth to show: every account is either left out of net worth or has no known balance.
        </p>
      )}
      {main && <NetWorthCard totals={main} uncounted={live.filter((a) => !a.countsTowardTotals).length} stamp={stamp} />}
      {(hasDebt || showAge) && (
        <div className={`grid gap-4 ${hasDebt && showAge ? 'lg:grid-cols-2' : ''}`}>
          {main && hasDebt && <OweCard totals={main} accounts={live} />}
          {showAge && <DataAge connections={liveConnections} stamp={stamp} now={now} />}
        </div>
      )}
      {live.length > 0 && (
        <BalanceSheet accounts={live} connections={connections} main="USD" mainTotals={main} now={now} onOpen={onOpen} onAddBank={onAddBank} />
      )}
      <NoLongerConnected accounts={accounts.filter((a) => !isLive(a))} onOpen={onOpen} />
    </>
  )
}

function NoLongerConnected({ accounts, onOpen }: { accounts: AccountBalance[]; onOpen: (id: string) => void }) {
  if (accounts.length === 0) return null
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2
          aria-label={`No longer connected, ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          className="font-sans text-[13px] font-semibold tracking-[0.04em] text-ink-3 uppercase"
        >
          No longer connected
          <span className="figures ml-1.5 font-medium tracking-normal text-ink-3">{accounts.length}</span>
        </h2>
        <p className="text-[13px] text-ink-3">Not counted in any total</p>
      </div>
      <ul className="flex flex-col">
        {accounts.map((b) => {
          const asOf = b.bankBalanceAt ?? b.lastSyncedAt
          const meta = identity(b)
          return (
            <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-3">
              <button type="button" onClick={() => onOpen(b.id)} className="text-left text-[14px] text-ink-2 hover:text-ink">
                {b.name}
                {meta && <span className="text-[12.5px] text-ink-3"> · {meta}</span>}
              </button>
              <span className="figures text-[12.5px] text-ink-3">
                {b.balance === null ? 'Unknown' : <span className="amt">{balanceText(b, b.balance)}</span>}
                {asOf && ` — last known balance on ${formatLocalDate(asOf)}`}
                {b.replacedByConnectorId && ` · replaced by your current ${b.institutionName ?? 'bank'} login`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AccountDetail({ account: b, onBack }: { account: AccountBalance; onBack: () => void }) {
  const { version } = useApp()
  const tx = useResource(
    (signal) =>
      getJson<{ transactions: LedgerRow[] }>(`/api/ledger/transactions?accountId=${encodeURIComponent(b.id)}`, signal).then(
        (r) => r.transactions,
      ),
    `${b.id}:${version}`,
  )
  const [now] = useState(() => Date.now())
  const idLine = [b.institutionName, identity(b), b.currency].filter(Boolean).join(' · ')
  const reach = isDebt(b) ? { label: 'Limit', value: b.creditLimit } : { label: 'Available', value: b.availableBalance }
  const [showAll, setShowAll] = useState(false)
  const shown = b.balance === null ? null : displayBalance(b, b.balance)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <div className="flex animate-rise flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-[13px] text-ink-3 transition-colors hover:text-ink">
        ← Accounts
      </button>

      <section className={CARD}>
        <div className="flex flex-col gap-6 p-[22px] sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <AccountIcon kind={b.kind} subtype={b.subtype} size="lg" />
            <div className="min-w-0">
              <h1 ref={heading} tabIndex={-1} className="text-[30px] leading-[1.2] tracking-[-0.015em] text-ink outline-none">
                {b.name}
              </h1>
              {b.officialName && <p className="mt-0.5 text-[13.5px] text-ink-2">{b.officialName}</p>}
              {idLine && <p className="mt-px text-[13px] text-ink-3">{idLine}</p>}
              {b.excludeFromNetWorth && <span className={`mt-2 inline-block ${TAG}`}>Not in net worth</span>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-[12px] text-ink-3">{shown?.credit ? 'In credit' : balanceLabel(b.kind)}</p>
            {b.balance === null ? (
              <p className="mt-0.5 font-display text-[38px] leading-[1.1] text-ink-3 sm:text-[46px]">
                — <span className="font-sans text-[14px] italic">Unknown</span>
              </p>
            ) : (
              <Money
                amount={shown?.value ?? 0}
                currency={b.currency}
                className="mt-0.5 block font-display text-[38px] leading-[1.1] font-[350] tracking-[-0.02em] text-ink sm:text-[46px]"
              />
            )}
            {b.mismatch && <p className="figures mt-1.5 text-[12.5px] text-warning">≠ <MismatchNote account={b} /></p>}
            {b.bankBalanceIsFallback && <p className="mt-1 text-[12.5px] text-ink-3">Estimated by the bank</p>}
          </div>
        </div>
        <dl className={`grid grid-cols-1 rounded-b-xl border-t border-line ${STRIP} sm:grid-cols-3`}>
          <Fact label={reach.label}>{reach.value === null ? '—' : <span className="amt">{formatMoney(reach.value, b.currency)}</span>}</Fact>
          <Fact label="Pending"><span className="amt">{balanceText(b, b.pendingBalance)}</span></Fact>
          <Fact label="Last synced">
            {b.lastSyncedAt ? (
              <>
                {b.connectionStatus && (
                  <span aria-hidden className={`inline-block size-1.5 rounded-full ${STATUS_DOT[b.connectionStatus]}`} />
                )}
                <span title={formatTimestamp(b.lastSyncedAt)}>{timeAgo(b.lastSyncedAt, now)}</span>
              </>
            ) : (
              '—'
            )}
          </Fact>
        </dl>
      </section>

      <section className={`overflow-hidden ${CARD}`}>
        <div className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-3">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal text-ink">
            Transactions
            {tx.data && tx.data.length > 0 && (
              <span className="figures ml-1.5 text-[13px] font-normal text-ink-3">{tx.data.length}</span>
            )}
          </h2>
          {tx.data && tx.data.length > 0 && <p className="text-[12.5px] text-ink-3">Newest first</p>}
        </div>
        {tx.error ? (
          <div className="px-5 pb-5">
            <ErrorState title="Couldn't load transactions" message={tx.error} onRetry={tx.reload} />
          </div>
        ) : !tx.data ? (
          <div className="px-5 pb-5">
            <Loading label="Loading transactions" rows={6} />
          </div>
        ) : tx.data.length === 0 ? (
          <div className="border-t border-line px-5 pb-2">
            <Empty title="This bank reports a balance only — no transactions imported." />
          </div>
        ) : (
          <>
            <TransactionTable rows={showAll ? tx.data : tx.data.slice(0, PREVIEW_ROWS)} />
            {!showAll && tx.data.length > PREVIEW_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="figures w-full border-t border-line px-5 py-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2/40 hover:text-ink"
              >
                Show all {tx.data.length} transactions
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line px-[22px] py-[13px] first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="figures flex items-center gap-[7px] text-[15px] font-medium text-ink">{children}</dd>
    </div>
  )
}

function TransactionTable({ rows }: { rows: LedgerRow[] }) {
  const th = `border-y border-line ${STRIP} px-5 py-2.5 text-[12px] font-medium text-ink-3`
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr className="text-left">
          <th scope="col" className={`${th} w-32 md:w-36`}>
            Date
          </th>
          <th scope="col" className={th}>
            Merchant
          </th>
          <th scope="col" className={`${th} hidden w-56 md:table-cell`}>
            Category
          </th>
          <th scope="col" className={`${th} text-right`}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody className="figures">
        {rows.map((r) => (
          <tr
            key={r.posting.id ?? `${r.id}:${r.posting.accountId}`}
            className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2/40"
          >
            <td className="px-5 py-[11px] align-top whitespace-nowrap text-ink-3">{formatLedgerDate(r.date, true)}</td>
            <td className="px-5 py-[11px] align-top font-medium text-ink">
              {r.posting.counterpartyRaw || r.description}
              {r.status === 'pending' && <span className="ml-2 text-[12px] font-normal text-warning">Pending</span>}
              {!r.countsTowardTotals && <span className={`${TAG} ml-2 inline-block`}>not counted (replaced login)</span>}
              <p className="mt-0.5 text-[12px] font-normal text-ink-3 md:hidden">{r.category?.label ?? 'Uncategorized'}</p>
            </td>
            <td className="hidden px-5 py-[11px] align-top md:table-cell">
              {r.category?.label ? (
                <span className="text-ink-2">{r.category.label}</span>
              ) : (
                <span className="inline-block rounded-md border border-dashed border-line-strong px-2 text-[12px] leading-5 text-ink-3">
                  Uncategorized
                </span>
              )}
            </td>
            <td className="px-5 py-[11px] text-right align-top font-medium">
              <Money amount={r.posting.amount} currency={r.posting.currency} tone="flow" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
