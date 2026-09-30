import type { AccountBalance, ConnectionSummary } from '../../lib/api'
import { timeAgo } from '../../lib/connection-health'
import { accountHealth, connectionFor, currencySymbol, displayBalance, identity, isDebt, PROVIDER_LABEL, TAG } from './model'
import { Amt, StatusDot } from './shared'
import { ConnectionAction } from './ConnectionAction'

const TILE_BG = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']

export function OtherCurrencies({
  accounts,
  connections,
  now,
  onSettings,
}: {
  accounts: AccountBalance[]
  connections: ConnectionSummary[]
  now: number
  onSettings: () => void
}) {
  return (
    <div className="border-b border-line px-6 pt-3.5 pb-[18px]">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-display text-[16px] font-extrabold tracking-[-0.01em] whitespace-nowrap text-ink">Other currencies</h3>
        <span className="text-[12px] whitespace-nowrap text-ink-3">not converted, not in totals</span>
        <span aria-hidden className="flex-1 border-t border-dashed border-line-strong opacity-50" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <ul className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {accounts.map((b, i) => (
            <li key={b.id}>
              <Tile account={b} index={i} connections={connections} now={now} onSettings={onSettings} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 [html[data-theme=dark]_&]:bg-surface-2 text-[12px] leading-normal text-ink-2 shadow-1 md:w-72 md:shrink-0">
          <span>
            <b className="font-semibold text-ink">Held as is.</b> Each balance stays in its own currency. Fluide never adds one currency to another.
          </span>
          <span>Not in net worth above.</span>
          <button type="button" onClick={onSettings} className="self-start text-[12px] text-ink-3 hover:text-ink">
            Manage connections ›
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({
  account: b,
  index,
  connections,
  now,
  onSettings,
}: {
  account: AccountBalance
  index: number
  connections: ConnectionSummary[]
  now: number
  onSettings: () => void
}) {
  const c = connectionFor(b, connections)
  const health = accountHealth(b, connections, now)
  const bad = health.severity === 'broken'
  const meta = identity(b)
  const when = b.lastSyncedAt ? timeAgo(b.lastSyncedAt, now) : null
  const flag = health.severity === 'warning' ? health.label?.replace('access ends in ', '').concat(' left') : health.label

  return (
    <div
      className={`flex min-h-[150px] flex-col gap-1 rounded-md border p-3.5 ${
        bad
          ? 'border-dashed border-ink-3 bg-surface-2 text-ink'
          : `border-line-strong text-tile-ink [html[data-theme=dark]_&]:shadow-[inset_0_0_0_2px_var(--tile-ring-gap)] ${TILE_BG[index % TILE_BG.length]}`
      }`}
    >
      <div className="flex items-start justify-between gap-2 text-[11.5px] font-bold tracking-[0.04em] uppercase">
        <span className="min-w-0">
          <span className="block truncate">
            {b.institutionName ?? 'Bank'} · {b.name}
          </span>
          {meta && <span className="block truncate font-medium tracking-normal normal-case opacity-80">{meta}</span>}
        </span>
        <span className="font-display text-[20px] leading-none font-extrabold tracking-normal">{currencySymbol(b.currency)}</span>
      </div>
      <p className={`mt-auto font-display text-[24px] font-extrabold tracking-[-0.02em] [&_.amt_small]:text-current [&_.amt_small]:opacity-65 ${bad ? 'opacity-60' : ''}`}>
        {b.balance === null ? '—' : <Amt value={displayBalance(b, b.balance).value} currency={b.currency} />}
        {isDebt(b) && b.balance !== null && (
          <small className="ml-1.5 font-sans text-[12px] font-medium tracking-normal opacity-70">{displayBalance(b, b.balance).credit ? 'in credit' : 'owed'}</small>
        )}
      </p>
      <div className="flex items-center justify-between gap-1.5 text-[12px] opacity-85">
        <span>
          {b.currency}
          {bad && when ? ` · stale, ${when}` : ''}
          {!b.countsTowardTotals && <span className={`${TAG} ml-1.5 inline-block`}>Not in net worth</span>}
        </span>
        {flag && (
          <span
            className={`rounded-full border bg-surface px-[7px] py-0.5 text-[10.5px] font-bold ${health.severity === 'warning' ? 'border-warning text-warning' : 'border-broken text-broken'}`}
          >
            {flag}
          </span>
        )}
      </div>
      <div className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t pt-2 text-[11.5px] ${bad ? 'border-line' : 'border-tile-ink/25'}`}>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot bad={bad} />
          <span>
            {b.connectionStatus === null
              ? 'Manual entry'
              : `Bank sync${c ? ` · ${PROVIDER_LABEL[c.provider]}` : ''} · ${bad ? 'broken' : 'connected'}${when ? `, ${when}` : ''}`}
          </span>
        </span>
        {c && health.severity !== 'ok' && (
          <span className="ml-auto">
            <ConnectionAction connection={c} health={health} onSettings={onSettings} />
          </span>
        )}
      </div>
    </div>
  )
}
