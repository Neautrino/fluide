import { useState, type ReactNode } from 'react'
import { AccountIcon } from '../components/AccountIcon'
import { ConnectBank } from '../components/ConnectBank'
import { ConnectEuropeanBank } from '../components/ConnectEuropeanBank'
import { Empty, ErrorState, Loading } from '../components/ui/States'
import { Money, PageHeader } from '../components/ui/Typography'
import { getJson, type AccountBalance, type AccountKind, type ConnectionStatus, type LedgerRow } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatLedgerDate, formatMoney, formatTimestamp } from '../lib/format'
import { useResource } from '../lib/useResource'

const CARD = 'rounded-xl border border-rule bg-paper-raised shadow-[0_1px_2px_rgb(27_26_23/0.05)]'
const STRIP = 'bg-paper-sunk/60'
const TAG = 'shrink-0 rounded-[5px] border border-rule px-1.5 text-[11px] leading-[18px] font-medium text-ink-3'
const PREVIEW_ROWS = 10

const TILES: { kind: AccountKind; label: string; noun: string }[] = [
  { kind: 'cash', label: 'Cash on hand', noun: 'account' },
  { kind: 'credit', label: 'Credit cards owed', noun: 'card' },
  { kind: 'loan', label: 'Loans owed', noun: 'loan' },
  { kind: 'investment', label: 'Investments', noun: 'account' },
]

const GROUPS: { title: string; kinds: (AccountKind | null)[] }[] = [
  { title: 'Cash', kinds: ['cash'] },
  { title: 'Credit cards', kinds: ['credit'] },
  { title: 'Loans', kinds: ['loan'] },
  { title: 'Investments', kinds: ['investment'] },
  { title: 'Other', kinds: ['property', 'vehicle', 'crypto', 'other', null] },
]

const STATUS_DOT: Record<ConnectionStatus, string> = {
  active: 'bg-green',
  reauth_required: 'bg-amber',
  error: 'bg-red',
  disconnected: 'bg-ink-3',
}

const isDebt = (b: AccountBalance) => b.kind === 'credit' || b.kind === 'loan'

/** Liabilities are stored negative; this page shows what is owed as a positive amount. */
const owedSign = (b: AccountBalance, n: number) => (isDebt(b) ? -n : n)

/** Share of a credit limit in use, clamped at 0 for accounts in credit; null without a limit. */
function usedPercent(owed: number, limit: number): number | null {
  return limit > 0 ? Math.max(0, Math.round((owed / limit) * 100)) : null
}

function balanceLabel(kind: AccountKind | null): string {
  if (kind === 'credit' || kind === 'loan') return 'Owed'
  if (kind === 'investment' || kind === 'property' || kind === 'vehicle' || kind === 'crypto') return 'Value'
  return 'Current balance'
}

/** "Checking •••• 0000", omitting whichever part the bank didn't report; short subtypes (cd, hsa, ira) are acronyms. */
function identity(b: AccountBalance): string {
  const s = b.subtype
  const subtype = !s ? null : /^[a-z]{2,3}$/.test(s) ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)
  return [subtype, b.mask ? `•••• ${b.mask}` : null].filter(Boolean).join(' ')
}

function mismatchNote(b: AccountBalance, sep = ' · '): string {
  return `Bank reports ${formatMoney(owedSign(b, b.bankBalance ?? 0), b.currency)}${sep}ledger shows ${formatMoney(owedSign(b, b.ledgerBalance), b.currency)}`
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const UNITS = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
] as const

function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return iso
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/** Known balances summed per currency — never across currencies — most-used currency first. */
function totalsByCurrency(list: AccountBalance[]): { currency: string; amount: number; count: number }[] {
  const totals = new Map<string, { currency: string; amount: number; count: number }>()
  for (const b of list) {
    if (b.balance === null) continue
    const t = totals.get(b.currency) ?? { currency: b.currency, amount: 0, count: 0 }
    t.amount += owedSign(b, b.balance)
    t.count += 1
    totals.set(b.currency, t)
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency))
}

export function Accounts() {
  const { version, invalidate, navigate } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const accounts = useResource(
    (signal) => getJson<{ accounts: AccountBalance[] }>('/api/ledger/account-balances', signal).then((r) => r.accounts),
    version,
  )

  const select = (id: string | null) => {
    setSelectedId(id)
    window.scrollTo({ top: 0 })
  }

  const data = accounts.data
  const selected = data?.find((a) => a.id === selectedId)
  if (selected) return <AccountDetail key={selected.id} account={selected} onBack={() => select(null)} />

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Accounts"
        lede="Your bank accounts, cards, loans and investments — read-only."
        actions={
          <>
            <ConnectBank onConnected={invalidate} variant="secondary" showSandboxHint={false} />
            <ConnectEuropeanBank variant="secondary" />
          </>
        }
      />

      {accounts.error ? (
        <ErrorState title="Couldn't load your accounts" message={accounts.error} onRetry={accounts.reload} />
      ) : !data ? (
        <Loading label="Loading accounts" rows={4} />
      ) : data.length === 0 ? (
        <Empty title="No accounts yet">Connect a bank above and your accounts will appear here.</Empty>
      ) : (
        <>
          <Tiles accounts={data} />
          <div className="flex flex-col gap-9">
            {GROUPS.map((g) => {
              const list = data.filter((a) => g.kinds.includes(a.kind))
              return (
                list.length > 0 && (
                  <AccountGroup
                    key={g.title}
                    title={g.title}
                    accounts={list}
                    onOpen={select}
                    onSettings={() => navigate('settings')}
                  />
                )
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Tiles({ accounts }: { accounts: AccountBalance[] }) {
  const tiles = TILES.flatMap((t) => {
    const list = accounts.filter((a) => a.kind === t.kind)
    return list.length > 0 ? [{ ...t, list }] : []
  })
  if (tiles.length === 0) return null
  return (
    <section aria-label="Totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Tile key={t.kind} kind={t.kind} label={t.label} noun={t.noun} accounts={t.list} />
      ))}
    </section>
  )
}

function Tile({ kind, label, noun, accounts }: { kind: AccountKind; label: string; noun: string; accounts: AccountBalance[] }) {
  const totals = totalsByCurrency(accounts)
  const [main, ...others] = totals
  let caption = `${accounts.length} ${noun}${accounts.length === 1 ? '' : 's'}`
  const limited = kind === 'credit' ? accounts.filter((b) => b.creditLimit !== null && b.currency === main?.currency) : []
  if (main && limited.length > 0) {
    const limit = limited.reduce((sum, b) => sum + (b.creditLimit ?? 0), 0)
    const pct = limited.every((b) => b.balance !== null)
      ? usedPercent(limited.reduce((sum, b) => sum + owedSign(b, b.balance ?? 0), 0), limit)
      : null
    caption = `Limit ${formatMoney(limit, main.currency)}${pct === null ? '' : ` (${pct}% used)`}`
  }

  return (
    <article className={`@container ${CARD} px-[18px] pt-[18px] pb-4`}>
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-ink-2">
        <AccountIcon kind={kind} />
        {label}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 font-display text-[28px] leading-[1.1] tracking-[-0.02em] text-ink xl:flex-nowrap xl:text-[length:clamp(24px,calc(18cqi_-_7px),32px)]">
        {main ? (
          <>
            <Money amount={main.amount} currency={main.currency} />
            {others.map((t) => (
              <span key={t.currency} className="figures font-sans text-[13px] font-medium tracking-normal whitespace-nowrap text-ink-3">
                · {formatMoney(t.amount, t.currency)}
              </span>
            ))}
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </p>
      <p className="figures mt-2 text-[12.5px] text-ink-3">{caption}</p>
    </article>
  )
}

function AccountGroup({
  title,
  accounts,
  onOpen,
  onSettings,
}: {
  title: string
  accounts: AccountBalance[]
  onOpen: (id: string) => void
  onSettings: () => void
}) {
  const totals = totalsByCurrency(accounts)
  const count = `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2
          aria-label={`${title}, ${count}`}
          className="font-sans text-[13px] font-semibold tracking-[0.04em] text-ink-2 uppercase"
        >
          {title}
          <span className="figures ml-1.5 font-medium tracking-normal text-ink-3">{accounts.length}</span>
        </h2>
        {totals.length > 0 && (
          <p className="figures text-right text-[13px] font-medium text-ink-2">
            {accounts.every(isDebt) && <span className="font-normal text-ink-3">owed </span>}
            {totals.map((t, i) => (
              <span key={t.currency} className="whitespace-nowrap">
                {i > 0 && <span className="text-ink-3"> · </span>}
                {formatMoney(t.amount, t.currency)}
              </span>
            ))}
          </p>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((b) => (
          <li key={b.id}>
            <AccountCard account={b} onOpen={() => onOpen(b.id)} onSettings={onSettings} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function AccountCard({ account: b, onOpen, onSettings }: { account: AccountBalance; onOpen: () => void; onSettings: () => void }) {
  const broken = b.connectionStatus === 'reauth_required' || b.connectionStatus === 'error'
  const meta = identity(b)
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden ${CARD} transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-rule-strong hover:shadow-[0_10px_24px_-12px_rgb(27_26_23/0.25),0_2px_4px_rgb(27_26_23/0.05)] ${
        b.connectionStatus === 'disconnected' ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View ${b.name}`}
        className="absolute inset-0 rounded-xl focus-visible:rounded-xl focus-visible:outline-offset-[-2px]"
      />
      <div className="flex items-center gap-3 px-4 pt-4">
        <AccountIcon kind={b.kind} subtype={b.subtype} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-[14.5px] leading-[1.3] font-medium tracking-normal text-ink">{b.name}</h3>
          {meta && <p className="mt-px truncate text-[12.5px] text-ink-3">{meta}</p>}
        </div>
        {b.excludeFromNetWorth && <span className={TAG}>Not in net worth</span>}
      </div>

      <div className="px-4 pt-[18px] pb-4">
        <p className="mb-0.5 text-[12px] text-ink-3">{balanceLabel(b.kind)}</p>
        <p className="flex items-center gap-2">
          {b.balance === null ? (
            <>
              <span className="font-display text-[27px] leading-[1.2] text-ink-3">—</span>
              <span className="text-[13px] text-ink-3 italic">Unknown</span>
            </>
          ) : (
            <Money
              amount={owedSign(b, b.balance)}
              currency={b.currency}
              className={`font-display text-[27px] leading-[1.2] tracking-[-0.02em] ${broken ? 'text-ink-2' : 'text-ink'}`}
            />
          )}
          {b.bankBalanceIsFallback && (
            <span className="pointer-events-none relative rounded-[5px] border border-rule bg-paper-sunk/60 px-1.5 text-[11px] leading-[18px] font-medium tracking-[0.02em] text-ink-2">
              <span aria-hidden>est.</span>
              <span className="sr-only">balance estimated by the bank</span>
            </span>
          )}
          {b.mismatch && (
            <span className="pointer-events-none relative text-[16px] font-medium text-amber">
              <span aria-hidden>≠</span>
              <span className="sr-only">{mismatchNote(b, ', ')}</span>
            </span>
          )}
        </p>
      </div>

      <CardFooter account={b} onSettings={onSettings} />
    </article>
  )
}

function CardFooter({ account: b, onSettings }: { account: AccountBalance; onSettings: () => void }) {
  if (b.connectionStatus === 'reauth_required' || b.connectionStatus === 'error') {
    const reauth = b.connectionStatus === 'reauth_required'
    return (
      <div
        className={`mt-auto flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[12.5px] font-medium ${
          reauth ? 'border-amber/30 bg-amber-wash text-amber' : 'border-red/25 bg-red-wash text-red'
        }`}
      >
        <span>{reauth ? 'Reconnect needed' : 'Sync failed'}</span>
        <button
          type="button"
          onClick={onSettings}
          className="relative whitespace-nowrap underline-offset-4 hover:underline"
        >
          Settings →
        </button>
      </div>
    )
  }

  let detail: ReactNode = null
  if (b.kind === 'cash' && b.availableBalance !== null) {
    detail = (
      <>
        Available <b className="font-medium text-ink-2">{formatMoney(b.availableBalance, b.currency)}</b>
      </>
    )
  } else if (isDebt(b) && b.creditLimit !== null) {
    const pct = b.balance === null ? null : usedPercent(owedSign(b, b.balance), b.creditLimit)
    detail = (
      <>
        Limit <b className="font-medium text-ink-2">{formatMoney(b.creditLimit, b.currency)}</b>
        {pct !== null && ` · ${pct}% used`}
      </>
    )
  } else if (b.lastSyncedAt) {
    detail = `Synced ${timeAgo(b.lastSyncedAt)}`
  }

  return (
    <div className={`mt-auto flex items-center justify-between gap-3 border-t border-rule ${STRIP} px-4 py-2.5 text-[12.5px] text-ink-3`}>
      <span className="figures min-w-0 truncate">{detail}</span>
      <span aria-hidden className="font-medium whitespace-nowrap text-ink-2 transition-colors group-hover:text-green">
        View →
      </span>
    </div>
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
  const idLine = [b.institutionName, identity(b), b.currency].filter(Boolean).join(' · ')
  const reach = isDebt(b) ? { label: 'Limit', value: b.creditLimit } : { label: 'Available', value: b.availableBalance }
  const [showAll, setShowAll] = useState(false)

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
              <h1 className="text-[30px] leading-[1.2] tracking-[-0.015em] text-ink">{b.name}</h1>
              {b.officialName && <p className="mt-0.5 text-[13.5px] text-ink-2">{b.officialName}</p>}
              {idLine && <p className="mt-px text-[13px] text-ink-3">{idLine}</p>}
              {b.excludeFromNetWorth && <span className={`mt-2 inline-block ${TAG}`}>Not in net worth</span>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-[12px] text-ink-3">{balanceLabel(b.kind)}</p>
            {b.balance === null ? (
              <p className="mt-0.5 font-display text-[38px] leading-[1.1] text-ink-3 sm:text-[46px]">
                — <span className="font-sans text-[14px] italic">Unknown</span>
              </p>
            ) : (
              <Money
                amount={owedSign(b, b.balance)}
                currency={b.currency}
                className="mt-0.5 block font-display text-[38px] leading-[1.1] font-[350] tracking-[-0.02em] text-ink sm:text-[46px]"
              />
            )}
            {b.mismatch && <p className="figures mt-1.5 text-[12.5px] text-amber">≠ {mismatchNote(b)}</p>}
            {b.bankBalanceIsFallback && <p className="mt-1 text-[12.5px] text-ink-3">Estimated by the bank</p>}
          </div>
        </div>
        <dl className={`grid grid-cols-1 rounded-b-xl border-t border-rule ${STRIP} sm:grid-cols-3`}>
          <Fact label={reach.label}>{reach.value === null ? '—' : formatMoney(reach.value, b.currency)}</Fact>
          <Fact label="Pending">{formatMoney(owedSign(b, b.pendingBalance), b.currency)}</Fact>
          <Fact label="Last synced">
            {b.lastSyncedAt ? (
              <>
                {b.connectionStatus && (
                  <span aria-hidden className={`inline-block size-1.5 rounded-full ${STATUS_DOT[b.connectionStatus]}`} />
                )}
                <span title={formatTimestamp(b.lastSyncedAt)}>{timeAgo(b.lastSyncedAt)}</span>
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
          <div className="border-t border-rule px-5 pb-2">
            <Empty title="This bank reports a balance only — no transactions imported." />
          </div>
        ) : (
          <>
            <TransactionTable rows={showAll ? tx.data : tx.data.slice(0, PREVIEW_ROWS)} />
            {!showAll && tx.data.length > PREVIEW_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="figures w-full border-t border-rule px-5 py-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-paper-sunk/40 hover:text-ink"
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
    <div className="border-t border-rule px-[22px] py-[13px] first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="figures flex items-center gap-[7px] text-[15px] font-medium text-ink">{children}</dd>
    </div>
  )
}

function TransactionTable({ rows }: { rows: LedgerRow[] }) {
  const th = `border-y border-rule ${STRIP} px-5 py-2.5 text-[12px] font-medium text-ink-3`
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
            className="border-b border-rule transition-colors last:border-b-0 hover:bg-paper-sunk/40"
          >
            <td className="px-5 py-[11px] align-top whitespace-nowrap text-ink-3">{formatLedgerDate(r.date, true)}</td>
            <td className="px-5 py-[11px] align-top font-medium text-ink">
              {r.posting.counterpartyRaw || r.description}
              {r.status === 'pending' && <span className="ml-2 text-[12px] font-normal text-amber">Pending</span>}
              <p className="mt-0.5 text-[12px] font-normal text-ink-3 md:hidden">{r.category?.label ?? 'Uncategorized'}</p>
            </td>
            <td className="hidden px-5 py-[11px] align-top md:table-cell">
              {r.category?.label ? (
                <span className="text-ink-2">{r.category.label}</span>
              ) : (
                <span className="inline-block rounded-md border border-dashed border-rule-strong px-2 text-[12px] leading-5 text-ink-3">
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
