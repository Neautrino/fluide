import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CategoryBar } from '../components/cashflow/CategoryBar'
import { KpiMini } from '../components/cashflow/KpiMini'
import { MonthBars } from '../components/cashflow/MonthBars'
import { PaceChart } from '../components/cashflow/PaceChart'
import { Sankey, SankeyTable } from '../components/cashflow/Sankey'
import { MASK } from '../components/cashflow/shared'
import { TickGauge } from '../components/cashflow/TickGauge'
import { PossibleTransfers } from '../components/PossibleTransfers'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Segmented } from '../components/ui/Segmented'
import { Empty, ErrorState, Loading } from '../components/ui/States'
import { Money } from '../components/ui/Typography'
import {
  getCashFlow,
  getCashFlowTransactions,
  getJson,
  type CashFlow as CashFlowData,
  type CashFlowCompare,
  type CashFlowDelta,
  type CashFlowFilter,
  type CashFlowParams,
  type ConnectionSummary,
  type NotCountedKind,
} from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatLedgerDate, formatMoney } from '../lib/format'
import { useResource } from '../lib/useResource'

const HIDE_KEY = 'fluide.cashflow.hideAmounts'
const STALE_MS = 24 * 60 * 60 * 1000

type Drill = { token: CashFlowFilter; label: string; amount: number }

const HiddenContext = createContext(false)
const DrillContext = createContext<(drill: Drill) => void>(() => {})

const LINK =
  'cursor-pointer rounded-[2px] underline decoration-(--cf-line) decoration-dotted decoration-[1.5px] underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink'

const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthOnly = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' })
const monthShortYear = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
const partsFormatters = new Map<string, Intl.NumberFormat>()
const wholeFormatters = new Map<string, Intl.NumberFormat>()

function cachedFormatter(cache: Map<string, Intl.NumberFormat>, currency: string, fractionDigits?: number) {
  let f = cache.get(currency)
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      ...(fractionDigits === undefined ? {} : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
    })
    cache.set(currency, f)
  }
  return f
}

/** Rounded to whole units, for baselines quoted inside sentences. */
function formatWhole(value: number, currency: string): string {
  return cachedFormatter(wholeFormatters, currency, 0).format(Math.abs(value))
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`)
}

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function monthTitle(month: string): string {
  const now = currentMonth()
  if (month === now) return 'This month'
  if (month === shiftMonth(now, -1)) return 'Last month'
  return monthLong.format(monthStart(month))
}

function monthRange(month: string): string {
  const partial = month === currentMonth()
  const end = partial ? new Date().getUTCDate() : daysIn(month)
  const d = monthStart(month)
  const short = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(d)
  return `1–${end} ${short} ${d.getUTCFullYear()}${partial ? ' · to date' : ''}`
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

function percent(share: number, digits = 1): string {
  const body = `${Math.abs(share * 100).toFixed(digits)}%`
  return share < 0 && body !== `${(0).toFixed(digits)}%` ? `\u2212${body}` : body
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)} days ago`
}

function baselineNoun(compare: CashFlowCompare, month: string): string {
  if (compare === 'average') return 'your average month'
  if (compare === 'previous') return 'the previous month'
  return `${monthOnly.format(monthStart(month))} last year`
}

const NOT_COUNTED_LABEL: Record<NotCountedKind, string> = {
  between_accounts: 'moved between your accounts',
  card_payoffs: 'card payments',
  invested: 'moved to investments',
  savings: 'moved to savings',
}

const COMPARE_OPTIONS: { value: CashFlowCompare; label: string }[] = [
  { value: 'average', label: 'Average' },
  { value: 'previous', label: 'Previous' },
  { value: 'last_year', label: 'Last year' },
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function CashFlow() {
  const { version } = useApp()
  const [month, setMonth] = useState(currentMonth)
  const [compare, setCompare] = useState<CashFlowCompare>('average')
  const [accounts, setAccounts] = useState<string[]>([])
  const [currency, setCurrency] = useState<string | null>(null)
  const [hidden, setHidden] = useState(readHidden)
  const [sankeyView, setSankeyView] = useState<'flow' | 'table'>('flow')
  const [drill, setDrill] = useState<Drill | null>(null)

  const params: CashFlowParams = { month, compare, accounts, currency }
  const paramsKey = `${month}|${compare}|${accounts.join(',')}|${currency ?? ''}`
  const flow = useResource((signal) => getCashFlow(params, signal), `${paramsKey}|${version}`)
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )

  useEffect(() => {
    try {
      localStorage.setItem(HIDE_KEY, hidden ? '1' : '0')
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }, [hidden])

  const data = flow.data
  const accountNames =
    accounts.length === 0
      ? 'All accounts'
      : accounts.length === 1
        ? (data?.accounts.find((a) => a.id === accounts[0])?.name ?? '1 account')
        : `${accounts.length} accounts`
  // The drawer describes the figures on screen, which stay the previous response's while a new one loads.
  const drawerMonth = data ? `${monthShortYear.format(monthStart(data.month))}${data.partial ? ' to date' : ''}` : ''
  // The user's pick shows at once; once the scope turns out not to hold it, the server's fallback does.
  const shownCurrency = currency && (!data || data.currencies.includes(currency)) ? currency : (data?.currency ?? null)

  return (
    <HiddenContext.Provider value={hidden}>
      <DrillContext.Provider value={setDrill}>
        <div className="cashflow flex flex-col text-[14px] leading-[1.45]" aria-busy={flow.loading || undefined}>
          <Header
            month={month}
            onMonth={setMonth}
            compare={compare}
            onCompare={setCompare}
            accounts={accounts}
            onAccounts={setAccounts}
            currency={shownCurrency}
            onCurrency={setCurrency}
            hidden={hidden}
            onHidden={setHidden}
            data={data}
            connections={connections.data}
          />

          {flow.error && !data ? (
            <div className="mt-8">
              <ErrorState title="Couldn't load your cash flow" message={flow.error} onRetry={flow.reload} />
            </div>
          ) : !data ? (
            <div className="mt-8">
              <Loading label="Loading cash flow" rows={4} />
            </div>
          ) : data.totals.moneyIn === 0 &&
            data.totals.moneyOut === 0 &&
            data.notCounted.length === 0 &&
            data.otherCurrencies.length === 0 &&
            data.possibleTransfers.count === 0 ? (
            <div className="mt-8 border-t border-rule">
              <Empty title={`Nothing counted in ${monthLong.format(monthStart(data.month))}`}>
                No money came in or went out of these accounts this month. Pick another month or include more accounts.
              </Empty>
            </div>
          ) : (
            <Page
              data={data}
              sankeyView={sankeyView}
              onSankeyView={setSankeyView}
              onMonth={setMonth}
              onCurrency={setCurrency}
              possible={
                data.possibleTransfers.count > 0 && (
                  <PossibleTransfers
                    currency={data.currency}
                    {...data.possibleTransfers}
                    load={(signal) =>
                      getCashFlowTransactions({ ...params, currency: data.currency }, 'possible', signal).then((r) => r.rows)
                    }
                    loadKey={paramsKey}
                    hidden={hidden}
                  />
                )
              }
            />
          )}

          {drill && data && (
            <DrillDrawer
              key={`${drill.token}|${paramsKey}`}
              drill={drill}
              params={{ ...params, month: data.month, currency: data.currency }}
              title={`${drill.label} · ${drawerMonth} · ${accountNames}`}
              onClose={() => setDrill(null)}
            />
          )}
        </div>
      </DrillContext.Provider>
    </HiddenContext.Provider>
  )
}

/* ─── Small building blocks ─── */

function Amt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const hidden = useContext(HiddenContext)
  return <span className={className}>{hidden ? MASK : children}</span>
}

function DrillButton({
  drill,
  children,
  plain = false,
  className = '',
}: {
  drill: Drill
  children: ReactNode
  /** Row labels open the same drill-down as their figure but aren't underlined. */
  plain?: boolean
  className?: string
}) {
  const open = useContext(DrillContext)
  return (
    <button
      type="button"
      onClick={() => open(drill)}
      className={`${plain ? 'cursor-pointer hover:underline hover:underline-offset-[3px]' : LINK} ${className}`}
    >
      {children}
    </button>
  )
}

/** Large figure with a small raised currency sign and small decimals, as on the d1 KPI strip. */
function Figure({ value, currency, signed = false }: { value: number; currency: string; signed?: boolean }) {
  const parts = cachedFormatter(partsFormatters, currency).formatToParts(Math.abs(value))
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '\u2212' : '') : value < 0 ? '\u2212' : ''
  return (
    <span className="figures whitespace-nowrap">
      {sign}
      {parts.map((p, i) =>
        p.type === 'currency' ? (
          <span key={i} className="align-[0.62em] text-[0.6em] tracking-normal text-ink-3">
            {p.value}
          </span>
        ) : p.type === 'decimal' || p.type === 'fraction' ? (
          <span key={i} className="text-[0.6em] tracking-normal text-ink-3">
            {p.value}
          </span>
        ) : p.type === 'literal' ? null : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  )
}

function Card({
  title,
  sub,
  aside,
  hero = false,
  className = '',
  children,
}: {
  title: string
  sub?: ReactNode
  aside?: ReactNode
  hero?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`min-w-0 rounded-[10px] border border-rule bg-paper-raised ${className}`}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">
          <h2
            className={
              hero
                ? 'font-display text-[28px] leading-[1.15] font-normal tracking-[-0.015em] text-ink'
                : 'font-sans text-[15px] leading-[1.3] font-semibold tracking-normal text-ink'
            }
          >
            {title}
          </h2>
          {sub && <p className="mt-1 text-[13px] text-ink-3 [&_b]:font-semibold [&_b]:text-ink">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 shrink-0 text-ink-2" aria-hidden>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

const CONTROL =
  'relative inline-flex h-[38px] items-center gap-2 rounded-[3px] border border-rule-strong bg-paper-raised px-3 text-[13px] whitespace-nowrap text-ink transition-colors hover:border-(--cf-line) hover:bg-(--cf-hover)'

function Popover({
  button,
  buttonClassName,
  label,
  align = 'left',
  children,
}: {
  button: ReactNode
  buttonClassName: string
  label: string
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 w-max max-w-[340px] rounded-[8px] border border-rule bg-paper-raised p-4 text-[13px] text-ink-2 shadow-[0_1px_2px_rgb(27_26_23/.06),0_8px_24px_-8px_rgb(27_26_23/.18)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* ─── Header ─── */

type HeaderProps = {
  month: string
  onMonth: (m: string) => void
  compare: CashFlowCompare
  onCompare: (c: CashFlowCompare) => void
  accounts: string[]
  onAccounts: (ids: string[]) => void
  currency: string | null
  onCurrency: (c: string) => void
  hidden: boolean
  onHidden: (h: boolean) => void
  data: CashFlowData | undefined
  connections: ConnectionSummary[] | undefined
}

function Header(p: HeaderProps) {
  const now = currentMonth()
  const months = Array.from({ length: 13 }, (_, i) => shiftMonth(now, -i))
  return (
    <header>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div>
          <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] text-ink">Cash flow</h1>
          <p className="mt-2 text-[14px] text-ink-3">What came into your accounts, and where it went. Calendar months.</p>
        </div>
        <div className="flex items-center gap-5 text-[13px] text-ink-2">
          <button
            type="button"
            role="switch"
            aria-checked={p.hidden}
            onClick={() => p.onHidden(!p.hidden)}
            className="inline-flex h-8 items-center gap-2"
          >
            <span
              aria-hidden
              className={`relative h-[18px] w-8 rounded-full transition-colors ${p.hidden ? 'bg-green' : 'bg-(--cf-line)'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-paper-raised shadow-[0_1px_2px_rgb(0_0_0/.3)] transition-transform ${
                  p.hidden ? 'translate-x-3.5' : ''
                }`}
              />
            </span>
            Hide amounts
          </button>
          <Popover
            label="How we count"
            align="right"
            buttonClassName={`${LINK} text-[13px] text-ink-2`}
            button="How we count"
          >
            <p className="mb-2 font-medium text-ink">How we count</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 leading-relaxed">
              <li>Money in is everything that reached your accounts, refunds included (shown as their own source).</li>
              <li>Money out is spending plus debt payments. Card purchases count when you make them, not when you pay the card.</li>
              <li>Kept is money in minus money out. Money you invest or move to savings counts as kept; savings rate is kept ÷ money in.</li>
              <li>Moves between your own accounts and card payments are left out and listed under Not counted. Pending transactions and transfers we couldn’t match still count.</li>
              <li>Calendar months, one currency at a time, never converted or mixed. Averages use complete months only.</li>
            </ul>
          </Popover>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className={`${CONTROL} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green`}>
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink-2" aria-hidden>
            <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <b className="font-semibold">{monthTitle(p.month)}</b>
          <span className="text-ink-3">· {monthRange(p.month)}</span>
          <Chevron />
          <select
            aria-label="Month"
            value={p.month}
            onChange={(e) => p.onMonth(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m === now ? `This month (${monthLong.format(monthStart(m))})` : monthLong.format(monthStart(m))}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-[13px] text-ink-3">
            Compare
          </span>
          <Segmented label="Compare with" value={p.compare} options={COMPARE_OPTIONS} onChange={p.onCompare} />
        </span>
        {p.data && <AccountFilter all={p.data.accounts} selected={p.accounts} onChange={p.onAccounts} />}
        {p.data && p.data.currencies.length > 1 && p.currency && (
          <Segmented
            label="Currency"
            value={p.currency}
            options={p.data.currencies.map((c) => ({ value: c, label: c }))}
            onChange={p.onCurrency}
          />
        )}
        {p.data && p.connections && <Freshness data={p.data} selected={p.accounts} connections={p.connections} />}
      </div>
    </header>
  )
}

function AccountFilter({
  all,
  selected,
  onChange,
}: {
  all: CashFlowData['accounts']
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const label =
    selected.length === 0
      ? `All accounts (${all.length})`
      : selected.length === 1
        ? (all.find((a) => a.id === selected[0])?.name ?? '1 account')
        : `${selected.length} of ${all.length} accounts`
  const toggle = (id: string) => {
    const current = selected.length === 0 ? all.map((a) => a.id) : selected
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    if (next.length > 0) onChange(next.length === all.length ? [] : next)
  }
  return (
    <Popover
      label="Accounts"
      buttonClassName={CONTROL}
      button={
        <>
          {label}
          <Chevron />
        </>
      }
    >
      <div className="flex min-w-[260px] flex-col">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
          className="mb-2 self-start text-[12px] font-medium text-green disabled:text-ink-3"
        >
          All accounts
        </button>
        <ul className="flex max-h-[320px] flex-col overflow-y-auto">
          {all.map((a) => (
            <li key={a.id}>
              <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-[4px] px-1 hover:bg-(--cf-hover)">
                <input
                  type="checkbox"
                  checked={selected.length === 0 || selected.includes(a.id)}
                  onChange={() => toggle(a.id)}
                  className="accent-green"
                />
                <span className="truncate text-ink">{a.name}</span>
                {a.mask && <span className="figures text-[12px] text-ink-3">··{a.mask}</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  )
}

function Freshness({
  data,
  selected,
  connections,
}: {
  data: CashFlowData
  selected: string[]
  connections: ConnectionSummary[]
}) {
  const inScope = data.accounts.filter((a) => selected.length === 0 || selected.includes(a.id))
  const linked = inScope.flatMap((a) => {
    const c = connections.find((conn) => conn.id === a.connectorId)
    return c ? [{ account: a.name, connection: c }] : []
  })
  if (linked.length === 0) return null
  const oldest = linked.reduce<string | null>((min, l) => {
    const at = l.connection.lastSyncedAt
    if (!at) return min
    return min === null || at < min ? at : min
  }, null)
  const stale = linked.filter(
    (l) =>
      l.connection.status !== 'active' ||
      !l.connection.lastSyncedAt ||
      Date.now() - new Date(l.connection.lastSyncedAt).getTime() > STALE_MS,
  )
  const perConnection = [...new Set(linked.map((l) => l.connection))]
    .map((c) => `${c.institutionName ?? 'Bank'} ${c.lastSyncedAt ? ago(c.lastSyncedAt) : 'never'}`)
    .join(' · ')
  const first = stale[0]
  return (
    <>
      <span
        tabIndex={0}
        title={`Freshness, per connection: ${perConnection}`}
        className="inline-flex h-8 cursor-help items-center gap-2 pl-1 text-[12px] text-ink-3"
      >
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${
            first ? 'bg-amber shadow-[0_0_0_3px_var(--color-amber-wash)]' : 'bg-green shadow-[0_0_0_3px_var(--color-green-wash)]'
          }`}
        />
        {oldest ? `Synced ${ago(oldest)}` : 'Not synced yet'}
      </span>
      {first && (
        <p role="status" className="w-full text-[12px] text-amber">
          Totals may be incomplete:{' '}
          {first.connection.status !== 'active'
            ? `${first.account} needs to reconnect`
            : `${first.account} last synced ${first.connection.lastSyncedAt ? ago(first.connection.lastSyncedAt) : 'never'}`}
          {stale.length > 1 && ` (and ${stale.length - 1} more)`}.
        </p>
      )}
    </>
  )
}

/* ─── Page body ─── */

function Page({
  data,
  sankeyView,
  onSankeyView,
  onMonth,
  onCurrency,
  possible,
}: {
  data: CashFlowData
  sankeyView: 'flow' | 'table'
  onSankeyView: (v: 'flow' | 'table') => void
  onMonth: (m: string) => void
  onCurrency: (c: string) => void
  possible: ReactNode
}) {
  const hidden = useContext(HiddenContext)
  const open = useContext(DrillContext)
  const { totals, currency } = data
  const keptShare = totals.moneyIn > 0 ? Math.round((totals.kept / totals.moneyIn) * 100) : null
  const spentShare = totals.moneyIn > 0 ? Math.round((totals.moneyOut / totals.moneyIn) * 100) : null

  return (
    <>
      <Kpis data={data} />
      <NotCounted data={data} onCurrency={onCurrency} />
      {possible}

      <Card
        hero
        className="mt-10"
        title="Where your money went"
        sub={
          keptShare !== null && spentShare !== null ? (
            <>
              {keptShare >= 0 ? (
                <>
                  You kept <b>{keptShare}%</b> of what came in and spent <b>{spentShare}%</b>.
                </>
              ) : (
                <>
                  You spent <b>{spentShare}%</b> of what came in; the rest came from your balances.
                </>
              )}{' '}
              {sankeyView === 'flow' && 'Hover a flow to trace it; click to see its transactions.'}
            </>
          ) : (
            'Nothing came in this month, so everything that went out came from your balances.'
          )
        }
        aside={
          <Segmented
            label="View"
            value={sankeyView}
            options={[
              { value: 'flow', label: 'Flow' },
              { value: 'table', label: 'Table' },
            ]}
            onChange={onSankeyView}
          />
        }
      >
        <div className="px-6 pt-4 pb-6">
          {sankeyView === 'flow' ? (
            <Sankey sankey={data.sankey} currency={currency} hidden={hidden} onSelect={(t, l, a) => open({ token: t, label: l, amount: a })} />
          ) : (
            <SankeyTable sankey={data.sankey} currency={currency} hidden={hidden} onSelect={(t, l, a) => open({ token: t, label: l, amount: a })} />
          )}
        </div>
      </Card>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Transfers data={data} />
        <MonthByMonth data={data} onMonth={onMonth} />
      </div>

      <div
        className={`mt-10 grid grid-cols-1 gap-6 ${data.partial ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]' : ''}`}
      >
        {data.partial && <Pace data={data} />}
        <Categories data={data} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[110rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,.85fr)_minmax(0,1.1fr)]">
        <Merchants data={data} />
        <Sources data={data} />
        <Largest data={data} className="lg:col-span-2 min-[110rem]:col-span-1" />
      </div>
    </>
  )
}

/* ─── KPI strip ─── */

function Comparison({
  value,
  delta,
  noun,
  currency,
  goodWhenUp,
}: {
  value: number
  delta: CashFlowDelta
  noun: string
  currency: string
  goodWhenUp: boolean
}) {
  if (delta.baseline === null) return <>No earlier months yet to compare with.</>
  const diff = value - delta.baseline
  const base = <Amt>({formatWhole(delta.baseline, currency)})</Amt>
  if (Math.abs(diff) < 0.005) return <>Same as {noun} {base}</>
  const up = diff > 0
  const good = up === goodWhenUp
  return (
    <>
      <span className={`font-semibold ${good ? 'text-green' : 'text-ink-2'}`}>
        {up ? '▲' : '▼'}
        {delta.change !== null && ` ${Math.abs(delta.change * 100).toFixed(1)}%`}
      </span>{' '}
      · <b className="font-semibold text-ink-2">
        <Amt>{formatMoney(Math.abs(diff), currency)}</Amt>
      </b>{' '}
      {up ? 'more' : 'less'} than {noun} {base}
    </>
  )
}

function Kpis({ data }: { data: CashFlowData }) {
  const { totals, currency, compare, month } = data
  const noun = baselineNoun(compare, month)
  const hidden = useContext(HiddenContext)
  const cmpTitle = data.partial ? `Compared with ${noun}, through day ${data.daysElapsed}` : `Compared with ${noun}`
  const rate = totals.savingsRate
  const rateBase = totals.vs.savingsRate.baseline

  return (
    <section
      aria-label="This month in four numbers"
      className="mt-8 grid grid-cols-2 border-y border-rule lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <Kpi label="Money in">
        <p className="self-end font-display text-[30px] leading-none tracking-[-0.02em] text-ink">
          <DrillButton drill={{ token: 'in', label: 'Money in', amount: totals.moneyIn }}>
            <Amt>
              <Figure value={totals.moneyIn} currency={currency} />
            </Amt>
          </DrillButton>
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.4] text-ink-3" title={cmpTitle}>
          <Comparison value={totals.moneyIn} delta={totals.vs.moneyIn} noun={noun} currency={currency} goodWhenUp />
        </p>
        <div className="self-end pt-3">
          <KpiMini kind="in" months={data.months} averages={data.averages} currency={currency} hidden={hidden} />
        </div>
      </Kpi>

      <Kpi label="Money out" className="border-l border-rule">
        <p className="self-end font-display text-[30px] leading-none tracking-[-0.02em] text-ink">
          <DrillButton drill={{ token: 'out', label: 'Money out', amount: totals.moneyOut }}>
            <Amt>
              <Figure value={totals.moneyOut} currency={currency} />
            </Amt>
          </DrillButton>
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.4] text-ink-3" title={cmpTitle}>
          <Comparison value={totals.moneyOut} delta={totals.vs.moneyOut} noun={noun} currency={currency} goodWhenUp={false} />
          <br />
          <DrillButton drill={{ token: 'spending', label: 'Spending', amount: totals.spending }}>
            Spending <Amt>{formatMoney(totals.spending, currency)}</Amt>
          </DrillButton>
          {totals.debtPayments > 0 && (
            <>
              {' + '}
              <DrillButton drill={{ token: 'debt', label: 'Debt payments', amount: totals.debtPayments }}>
                Debt payments <Amt>{formatMoney(totals.debtPayments, currency)}</Amt>
              </DrillButton>
            </>
          )}
        </p>
        <div className="self-end pt-3">
          <KpiMini kind="out" months={data.months} averages={data.averages} currency={currency} hidden={hidden} />
        </div>
      </Kpi>

      <Kpi label="Kept" className="border-t border-rule lg:border-t-0 lg:border-l">
        <p className="self-end font-display text-[44px] leading-none tracking-[-0.02em] text-ink xl:text-[52px]">
          <Amt>
            <Figure value={totals.kept} currency={currency} signed />
          </Amt>
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.4] text-ink-3" title={cmpTitle}>
          {totals.kept > 0 ? (
            <>
              Surplus: <b className="font-semibold text-ink-2"><Amt>{formatMoney(totals.kept, currency)}</Amt></b> more came in
              than went out
            </>
          ) : totals.kept < 0 ? (
            <>
              Deficit: you spent <b className="font-semibold text-ink-2"><Amt>{formatMoney(-totals.kept, currency)}</Amt></b>{' '}
              more than came in
            </>
          ) : (
            <>Exactly what came in went out</>
          )}
          {' · '}
          {totals.vs.kept.baseline === null ? (
            'no earlier months yet'
          ) : (
            <KeptDelta value={totals.kept} delta={totals.vs.kept} noun={noun} currency={currency} />
          )}
        </p>
        <div className="self-end pt-3">
          <KpiMini kind="kept" months={data.months} averages={data.averages} currency={currency} hidden={hidden} />
        </div>
      </Kpi>

      <Kpi label="Savings rate" className="border-t border-l border-rule lg:border-t-0">
        <div className="flex items-end justify-between gap-2 self-end">
          <p className="figures font-display text-[30px] leading-none tracking-[-0.02em] text-ink">
            {rate === null ? (
              '—'
            ) : (
              <>
                {percent(rate).slice(0, -1)}
                <span className="text-[0.6em] text-ink-3">%</span>
              </>
            )}
          </p>
          <div className="-mb-2 size-16 shrink-0">
            <TickGauge value={rate} baseline={rateBase} baselineLabel={noun} />
          </div>
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.4] text-ink-3" title={cmpTitle}>
          {rate === null ? (
            'Nothing came in yet'
          ) : rateBase === null ? (
            'No earlier months yet'
          ) : (
            <RateDelta rate={rate} base={rateBase} noun={noun} />
          )}{' '}
          · kept ÷ money in
        </p>
        <div className="self-end pt-3">
          <KpiMini kind="rate" months={data.months} averages={data.averages} currency={currency} hidden={hidden} />
        </div>
      </Kpi>
    </section>
  )
}

function Kpi({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <article
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_64px_auto_1fr] px-4 pt-5 pb-4 first:pl-0 lg:px-6 lg:last:pr-0 ${className}`}
    >
      <span className="text-[13px] font-medium text-ink-3">{label}</span>
      {children}
    </article>
  )
}

function KeptDelta({ value, delta, noun, currency }: { value: number; delta: CashFlowDelta; noun: string; currency: string }) {
  const base = delta.baseline ?? 0
  const diff = value - base
  const up = diff > 0
  return (
    <>
      <span className={`font-semibold ${up ? 'text-green' : 'text-ink-2'}`}>
        {Math.abs(diff) < 0.005 ? '=' : up ? '▲' : '▼'}
        {delta.change !== null && Math.abs(diff) >= 0.005 && ` ${Math.abs(delta.change * 100).toFixed(1)}%`}
      </span>{' '}
      vs {noun} (
      <Amt>{formatMoney(base, currency)}</Amt>)
    </>
  )
}

function RateDelta({ rate, base, noun }: { rate: number; base: number; noun: string }) {
  const pts = (rate - base) * 100
  if (Math.abs(pts) < 0.05) return <>Same as {noun} ({percent(base)})</>
  return (
    <>
      <span className={`font-semibold ${pts > 0 ? 'text-green' : 'text-ink-2'}`}>
        {pts > 0 ? '▲' : '▼'} {Math.abs(pts).toFixed(1)} pts
      </span>{' '}
      {pts > 0 ? 'above' : 'below'} {noun} ({percent(base)})
    </>
  )
}

/* ─── Not counted ─── */

function NotCounted({ data, onCurrency }: { data: CashFlowData; onCurrency: (c: string) => void }) {
  const entries = data.notCounted.filter((n) => n.count > 0)
  return (
    <div role="note" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-2">
      <span aria-hidden className="cf-sw-no size-3 shrink-0 rounded-[2px] border-[1.5px] border-dashed border-(--cf-line)" />
      <span className="eyebrow text-ink-2">Not counted</span>
      {entries.length === 0 && data.otherCurrencies.length === 0 ? (
        <span className="text-ink-3">Nothing was left out of these totals.</span>
      ) : (
        <span className="figures">
          {entries.map((n, i) => (
            <span key={n.kind}>
              {i > 0 && <span className="px-1.5 text-ink-3">·</span>}
              <DrillButton drill={{ token: `notcounted:${n.kind}`, label: capitalize(NOT_COUNTED_LABEL[n.kind]), amount: n.total }}>
                {capitalize(NOT_COUNTED_LABEL[n.kind])} <Amt>{formatMoney(n.total, data.currency)}</Amt> ({n.count})
              </DrillButton>
            </span>
          ))}
          {data.otherCurrencies.map((o, i) => (
            <span key={o.currency}>
              {(entries.length > 0 || i > 0) && <span className="px-1.5 text-ink-3">·</span>}
              <button
                type="button"
                onClick={() => onCurrency(o.currency)}
                title={`Switch the page to ${o.currency}`}
                className={LINK}
              >
                Other currency ({o.currency}){' '}
                <Amt>
                  {[
                    o.moneyIn > 0 && `${formatMoney(o.moneyIn, o.currency)} in`,
                    o.moneyOut > 0 && `${formatMoney(o.moneyOut, o.currency)} out`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Amt>{' '}
                ({o.count})
              </button>
            </span>
          ))}
          <span className="text-ink-3"> — not in these totals</span>
        </span>
      )}
    </div>
  )
}

/* ─── Transfers & savings ─── */

const TRANSFER_LABEL: Record<CashFlowData['transfers'][number]['kind'], string> = {
  invested: 'Invested',
  savings: 'Moved to savings',
  card_payoffs: 'Card payoffs',
  between_accounts: 'Between your accounts',
  debt_payments: 'Debt payments',
}

const TRANSFER_SWATCH: Record<CashFlowData['transfers'][number]['kind'], string> = {
  invested: 'bg-(--cf-in)',
  savings: 'bg-(--cf-in-tint) shadow-[inset_0_0_0_1.5px_var(--cf-in)]',
  card_payoffs: 'border-[1.5px] border-dashed border-(--cf-line)',
  between_accounts: 'border-[1.5px] border-dashed border-(--cf-line) bg-paper-sunk',
  debt_payments: 'bg-(--cf-out)',
}

function Transfers({ data }: { data: CashFlowData }) {
  const rows = data.transfers.filter((t) => t.count > 0)
  const total = rows.reduce((s, t) => s + t.total, 0)
  const count = rows.reduce((s, t) => s + t.count, 0)
  return (
    <Card
      className="flex flex-col"
      title="Transfers & savings"
      sub={
        rows.length === 0 ? (
          'Nothing moved between your own accounts this month.'
        ) : (
          <>
            <b>
              <Amt>{formatWhole(total, data.currency)}</Amt>
            </b>{' '}
            moved to your own accounts in {count} {count === 1 ? 'transfer' : 'transfers'}
          </>
        )
      }
    >
      {rows.length > 0 && (
        <div className="px-6 pt-2 pb-4">
          <div aria-hidden className="my-2 flex h-3 gap-1">
            {rows.map((t) => (
              <i key={t.kind} className={`block min-w-1 rounded-[2px] ${TRANSFER_SWATCH[t.kind]}`} style={{ flexGrow: t.total }} />
            ))}
          </div>
          <ul>
            {rows.map((t) => (
              <li
                key={t.kind}
                className="-mx-2 grid min-h-14 grid-cols-[12px_1fr_auto] items-center gap-3 rounded-[6px] border-b border-rule p-2 last:border-b-0 hover:bg-(--cf-hover)"
              >
                <span aria-hidden className={`size-2.5 rounded-[2px] ${TRANSFER_SWATCH[t.kind]}`} />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{TRANSFER_LABEL[t.kind]}</p>
                  {t.accounts.length > 0 && (
                    <p className="truncate text-[12.5px] text-ink-3">→ {t.accounts.join(', ')}</p>
                  )}
                </div>
                <div className="text-right">
                  <DrillButton
                    drill={{ token: t.kind === 'debt_payments' ? 'debt' : `notcounted:${t.kind}`, label: TRANSFER_LABEL[t.kind], amount: t.total }}
                    className="figures text-[14px] font-medium text-ink"
                  >
                    <Amt>{formatMoney(t.total, data.currency)}</Amt>
                  </DrillButton>
                  <small className="block text-[12px] text-ink-3">
                    {t.count} {t.kind === 'debt_payments' ? (t.count === 1 ? 'payment' : 'payments') : t.count === 1 ? 'transfer' : 'transfers'}
                    {t.kind === 'debt_payments' && ' · counted'}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-auto flex items-center gap-2 border-t border-rule px-6 py-3 text-[12.5px] text-ink-3">
        <span aria-hidden className="cf-sw-no size-3 shrink-0 rounded-[2px] border-[1.5px] border-dashed border-(--cf-line)" />
        {rows.some((t) => t.kind === 'debt_payments')
          ? 'These moved between your own accounts, so they’re not spending. Debt payments still count in Money out.'
          : 'These moved between your own accounts, so they’re not spending.'}
      </p>
    </Card>
  )
}

/* ─── Month by month ─── */

function MonthByMonth({ data, onMonth }: { data: CashFlowData; onMonth: (m: string) => void }) {
  const hidden = useContext(HiddenContext)
  const selected = data.months.find((m) => m.month === data.month)
  const active = data.months.filter((m) => m.moneyIn > 0 || m.moneyOut > 0)
  const best = selected && active.length > 1 && active.every((m) => m === selected || m.net < selected.net)
  const name = monthOnly.format(monthStart(data.month))
  return (
    <Card
      title="Month by month"
      sub={
        selected ? (
          <>
            {name}
            {data.partial ? ' so far' : ''}:{' '}
            {selected.net >= 0 ? (
              <>
                you kept{' '}
                <b>
                  <Amt>{formatWhole(selected.net, data.currency)}</Amt>
                </b>
              </>
            ) : (
              <>
                you spent{' '}
                <b>
                  <Amt>{formatWhole(-selected.net, data.currency)}</Amt>
                </b>{' '}
                more than came in
              </>
            )}
            {best ? `, your best month of the last ${data.months.length}.` : '.'}
          </>
        ) : (
          'The last 12 months, in and out.'
        )
      }
    >
      <div className="px-6 pt-2 pb-5">
        <MonthBars
          months={data.months}
          averages={data.averages}
          currency={data.currency}
          daysElapsed={data.daysElapsed}
          daysInMonth={data.daysInMonth}
          hidden={hidden}
          onMonth={onMonth}
        />
      </div>
    </Card>
  )
}

/* ─── Pace ─── */

function Pace({ data }: { data: CashFlowData }) {
  const hidden = useContext(HiddenContext)
  const open = useContext(DrillContext)
  const noun = baselineNoun(data.compare, data.month)
  const today = data.pace.find((p) => p.day === data.daysElapsed)
  const current = today?.current ?? null
  const base = today?.baseline ?? null
  const diff = current !== null && base !== null ? current - base : null
  const day = ordinal(data.daysElapsed)
  const callout =
    diff !== null && base !== null && base > 0
      ? `${diff < 0 ? '\u2212' : '+'}${Math.abs((diff / base) * 100).toFixed(1)}% vs ${noun} by the ${day}`
      : undefined
  return (
    <Card
      className="flex flex-col"
      title="This month’s pace"
      sub={
        diff === null ? (
          <>Spent so far this month. No earlier months to compare with yet. History only, no forecast.</>
        ) : (
          <>
            <b>
              <Amt>{formatWhole(diff, data.currency)}</Amt>
            </b>{' '}
            {diff <= 0 ? 'less' : 'more'} out than {noun} by the {day}. History only, no forecast.
          </>
        )
      }
    >
      <div className="flex-1 px-6 pt-2 pb-5">
        <PaceChart
          pace={data.pace}
          month={data.month}
          daysElapsed={data.daysElapsed}
          daysInMonth={data.daysInMonth}
          compare={data.compare}
          currency={data.currency}
          hidden={hidden}
          callout={callout}
          onSelect={(t, l, a) => open({ token: t, label: l, amount: a })}
        />
      </div>
    </Card>
  )
}

/* ─── Spending by category ─── */

const CATEGORY_ROWS = 9
const CAT_GRID = 'grid grid-cols-[140px_minmax(48px,1fr)_76px_56px_52px_68px] items-center gap-2.5'

function Categories({ data }: { data: CashFlowData }) {
  const [all, setAll] = useState(false)
  const noun = baselineNoun(data.compare, data.month)
  const cats = data.categories
  if (cats.length === 0) {
    return (
      <Card title="Spending by category">
        <div className="px-6 pb-4">
          <Empty title="No spending this month" />
        </div>
      </Card>
    )
  }
  const rows = all ? cats : cats.slice(0, CATEGORY_ROWS)
  const max = Math.max(...cats.map((c) => Math.max(c.amount, c.baseline ?? 0)), 1)
  const top = cats[0]
  const above = cats
    .filter((c) => c.baseline !== null && c.amount - c.baseline >= 1)
    .sort((a, b) => b.amount - (b.baseline ?? 0) - (a.amount - (a.baseline ?? 0)))[0]
  const fromBank = cats.some((c) => c.fromBank)
  return (
    <Card
      title="Spending by category"
      sub={
        <>
          {top.label} is <b>{percent(top.shareOfSpending)}</b> of spending.
          {above && (
            <>
              {' '}
              {above.label} is{' '}
              <b>
                <Amt>{formatWhole(above.amount - (above.baseline ?? 0), data.currency)}</Amt>
              </b>{' '}
              above {noun}.
            </>
          )}
        </>
      }
      aside={
        fromBank && (
          <span
            tabIndex={0}
            title="Categories from your bank: until Fluide has a category for a transaction, it shows the one your bank assigned."
            className="inline-flex h-6 shrink-0 cursor-help items-center gap-1 rounded-[4px] border border-rule px-2 text-[12px] font-medium whitespace-nowrap text-ink-3"
          >
            <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
              <path d="M2 6.5 8 3l6 3.5M3.5 7v5M6.5 7v5M9.5 7v5M12.5 7v5M2 13.5h12" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            from bank
          </span>
        )
      }
    >
      <div className="overflow-x-auto px-6 pt-2 pb-4">
        <div className={`${CAT_GRID} h-8 border-b border-rule`}>
          {['Category', `vs ${data.compare === 'average' ? 'avg' : data.compare === 'previous' ? 'prev' : 'last yr'}`, 'Spent', '% spend', '% in', 'Change'].map(
            (h, i) => (
              <span
                key={h}
                title={i === 1 ? `Compared with ${noun}` : i === 5 ? `Change vs ${noun}` : undefined}
                className={`truncate text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase ${i >= 2 ? 'text-right' : ''}`}
              >
                {h}
              </span>
            ),
          )}
        </div>
        <ul>
          {rows.map((c) => {
            const drill: Drill = { token: `category:${c.label}`, label: c.label, amount: c.amount }
            return (
              <li
                key={c.label}
                className={`${CAT_GRID} -mx-2 h-10 rounded-[6px] border-b border-rule px-2 text-[13px] last:border-b-0 hover:bg-(--cf-hover)`}
              >
                <DrillButton drill={drill} plain className="truncate text-left font-medium text-ink">
                  {c.label}
                  {c.fromBank && <span className="sr-only"> (category from your bank)</span>}
                </DrillButton>
                <CategoryBar amount={c.amount} baseline={c.baseline} max={max} highlight={c === above} />
                <span className="text-right">
                  <DrillButton drill={drill} className="figures text-ink">
                    <Amt>{formatMoney(c.amount, data.currency)}</Amt>
                  </DrillButton>
                </span>
                <span className="figures text-right text-[12.5px] text-ink-3">{percent(c.shareOfSpending)}</span>
                <span className="figures text-right text-[12.5px] text-ink-3">
                  {c.shareOfIncome === null ? '—' : percent(c.shareOfIncome)}
                </span>
                <span className="text-right">
                  <DeltaChip amount={c.amount} baseline={c.baseline} currency={data.currency} />
                </span>
              </li>
            )
          })}
        </ul>
        {cats.length > CATEGORY_ROWS && (
          <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setAll((a) => !a)}>
            {all ? 'Show fewer' : `Show all ${cats.length} categories`}
          </Button>
        )}
      </div>
    </Card>
  )
}

function DeltaChip({ amount, baseline, currency }: { amount: number; baseline: number | null; currency: string }) {
  const base = 'inline-flex h-6 min-w-16 items-center justify-center rounded-[4px] px-1.5 text-[12px] font-medium whitespace-nowrap'
  if (baseline === null) return <span className={`${base} text-ink-3`}>new</span>
  const diff = amount - baseline
  if (Math.abs(diff) < 1) return <span className={`${base} text-ink-3 shadow-[inset_0_0_0_1px_var(--color-rule)]`}>= avg</span>
  return (
    <span className={`${base} ${diff > 0 ? 'bg-paper-sunk text-ink-2' : 'bg-green-wash text-green-deep'}`}>
      {diff > 0 ? '▲' : '▼'}&nbsp;<Amt>{formatWhole(diff, currency)}</Amt>
    </span>
  )
}

/* ─── Bottom row ─── */

function Merchants({ data }: { data: CashFlowData }) {
  const rows = data.merchants
  const grid = 'grid grid-cols-[20px_minmax(0,1fr)_40px_72px_80px] items-center gap-3'
  return (
    <Card
      title="Top merchants"
      sub={
        rows[0] ? (
          <>
            {rows[0].name} leads at{' '}
            <b>
              <Amt>{formatWhole(rows[0].amount, data.currency)}</Amt>
            </b>
            .
          </>
        ) : (
          'No spending this month.'
        )
      }
    >
      {rows.length > 0 && (
        <div className="px-6 pt-2 pb-4">
          <div className={`${grid} h-8 border-b border-rule text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase`}>
            <span>#</span>
            <span>Merchant</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Avg</span>
            <span className="text-right">Spent</span>
          </div>
          <ol>
            {rows.map((m, i) => {
              const drill: Drill = { token: `merchant:${m.name}`, label: m.name, amount: m.amount }
              return (
                <li
                  key={m.name}
                  className={`${grid} -mx-2 min-h-10 rounded-[6px] border-b border-rule px-2 py-1 text-[13px] last:border-b-0 hover:bg-(--cf-hover)`}
                >
                  <span className="figures text-[12px] text-ink-3">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    <span className="line-clamp-2 break-words" title={m.name}>
                      {m.name}
                    </span>
                    {m.isNew && (
                      <span className="inline-flex h-[18px] shrink-0 items-center rounded-[4px] bg-green px-1.5 text-[10px] font-semibold tracking-[0.08em] text-paper-raised">
                        NEW
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    <DrillButton drill={drill} className="figures text-ink-3">
                      {m.count}
                    </DrillButton>
                  </span>
                  <span className="figures text-right text-ink-3">
                    <Amt>{formatMoney(m.average, data.currency)}</Amt>
                  </span>
                  <span className="text-right">
                    <DrillButton drill={drill} className="figures text-ink">
                      <Amt>{formatMoney(m.amount, data.currency)}</Amt>
                    </DrillButton>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </Card>
  )
}

function Sources({ data }: { data: CashFlowData }) {
  const rows = data.sources
  const regular = rows.filter((s) => s.regularity === 'monthly').reduce((sum, s) => sum + s.share, 0)
  const irregular = rows.filter((s) => s.regularity === 'irregular').reduce((sum, s) => sum + s.share, 0)
  const other = Math.max(0, 1 - regular - irregular)
  const top = rows[0]
  return (
    <Card
      title="Money in by source"
      sub={
        top ? (
          <>
            <b>{percent(top.share, 0)}</b> came from {top.name}.
          </>
        ) : (
          'Nothing came in this month.'
        )
      }
    >
      {rows.length > 0 && (
        <div className="px-6 pt-3 pb-4">
          <div aria-hidden className="flex h-3 gap-1">
            {regular > 0 && <i className="block min-w-1 rounded-[2px] bg-(--cf-in)" style={{ flexGrow: regular }} />}
            {irregular > 0 && (
              <i
                className="block min-w-1 rounded-[2px] bg-(--cf-in-tint) shadow-[inset_0_0_0_1.5px_var(--cf-in)]"
                style={{ flexGrow: irregular }}
              />
            )}
            {other > 0.0005 && <i className="block min-w-1 rounded-[2px] bg-(--cf-line)" style={{ flexGrow: other }} />}
          </div>
          <p className="figures flex justify-between gap-2 border-b border-rule pt-2 pb-3 text-[12px] text-ink-3 [&_b]:font-semibold [&_b]:text-ink">
            <span>
              <b>{percent(regular, 0)}</b> regular
            </span>
            <span>
              <b>{percent(irregular, 0)}</b> irregular
            </span>
            <span>
              <b>{percent(other, 0)}</b> other
            </span>
          </p>
          <ul>
            {rows.map((s) => (
              <li key={`${s.kind}:${s.name}`} className="border-b border-rule py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium text-ink">{s.name}</span>
                  <DrillButton
                    drill={{ token: s.kind === 'refunds' ? 'refunds' : `source:${s.name}`, label: s.name, amount: s.amount }}
                    className="figures shrink-0 text-ink"
                  >
                    <Amt>{formatMoney(s.amount, data.currency, 'always')}</Amt>
                  </DrillButton>
                </div>
                <p className="mt-2 flex items-center text-[12px] text-ink-3">
                  {s.regularity && (
                    <span className="mr-2 inline-flex h-[18px] items-center rounded-[4px] border border-rule px-1.5 text-[11px] font-medium">
                      {s.regularity}
                    </span>
                  )}
                  {percent(s.share)} of money in
                </p>
                <div aria-hidden className="mt-2 h-1 rounded-[2px] bg-paper-sunk">
                  <i className="block h-full rounded-[2px] bg-(--cf-in)" style={{ width: `${Math.min(100, s.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Largest({ data, className }: { data: CashFlowData; className: string }) {
  const rows = data.largest
  const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0)
  return (
    <Card
      className={className}
      title="Largest transactions"
      sub={`Money out, ${data.partial ? 'this month so far' : monthOnly.format(monthStart(data.month))}`}
      aside={
        rows.length > 0 && (
          <LargestLink total={total} />
        )
      }
    >
      {rows.length === 0 ? (
        <div className="px-6 pb-4">
          <Empty title="No money out this month" />
        </div>
      ) : (
        <ul className="px-6 pt-2 pb-4">
          {rows.map((r) => (
            <li
              key={r.transactionId}
              className="-mx-2 grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[6px] border-b border-rule p-2 last:border-b-0 hover:bg-(--cf-hover)"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">
                  {r.description}
                  {r.pending && <span className="ml-2 text-[12px] font-normal text-amber">Pending</span>}
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  {r.category}
                  {r.fromBank && ' · from bank'}
                </p>
              </div>
              <div className="text-right">
                <Amt className="figures text-[14px] font-medium text-ink">{formatMoney(r.amount, r.currency)}</Amt>
                <small className="mt-0.5 block font-mono text-[11px] text-ink-3">
                  {formatLedgerDate(r.date)} · {r.accountName}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function LargestLink({ total }: { total: number }) {
  const open = useContext(DrillContext)
  return (
    <Button variant="ghost" size="sm" onClick={() => open({ token: 'largest', label: 'Largest transactions', amount: total })}>
      Open list
    </Button>
  )
}

/* ─── Drill-down drawer ─── */

function DrillDrawer({
  drill,
  params,
  title,
  onClose,
}: {
  drill: Drill
  params: CashFlowParams
  title: string
  onClose: () => void
}) {
  const res = useResource((signal) => getCashFlowTransactions(params, drill.token, signal), drill.token)
  const currency = params.currency ?? 'USD'
  return (
    <Drawer title={title} onClose={onClose}>
      {res.data ? (
        <>
          <div className="border-b border-ink pb-4">
            <p className="eyebrow">Total</p>
            <p className="mt-1 font-display text-[36px] leading-none text-ink">
              <Amt>
                <Figure value={res.data.total} currency={currency} />
              </Amt>
            </p>
            <p className="figures mt-2 text-[13px] text-ink-3">
              {res.data.count} {res.data.count === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
          {res.data.rows.length === 0 ? (
            <Empty title="No transactions" />
          ) : (
            <ul>
              {res.data.rows.map((r, i) => (
                <li key={`${r.transactionId}:${i}`} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {r.description}
                      {r.pending && <span className="ml-2 text-[12px] text-amber">Pending</span>}
                    </p>
                    <p className="figures mt-0.5 text-[12px] text-ink-3">
                      {formatLedgerDate(r.date)} · {r.accountName} · {r.category}
                      {r.fromBank && ' (from bank)'}
                    </p>
                  </div>
                  <Amt>
                    <Money amount={r.amount} currency={r.currency} tone="flow" className="text-[14px]" />
                  </Amt>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : res.error ? (
        <ErrorState title="Couldn't load these transactions" message={res.error} onRetry={res.reload} />
      ) : (
        <Loading label="Loading transactions" rows={5} />
      )}
    </Drawer>
  )
}
