import { Fragment, useState, type ReactNode } from 'react'
import type { AccountBalance, ConnectionSummary } from '../../types'
import { shortName, timeAgo } from '../../lib/connection-health'
import { formatMoney } from '../../lib/format'
import { AccountIcon } from '../ui/AccountIcon'
import { Segmented } from '../ui/Segmented'
import { accountHealth, CARD, CARD_TITLE, connectionFor, creditUsage, debtNote, displayBalance, identity, isDebt, KIND_GROUPS, owedSign, percent, PROVIDER_LABEL, shareOf, TAG, totalsByCurrency, usedPercent, type CurrencyTotals } from './model'
import { Amt, MismatchNote, StatusDot } from './shared'

type Mode = 'kind' | 'currency' | 'institution'

type Group = {
  id: string
  title: string
  swatch: string
  accounts: AccountBalance[]
  meta: ReactNode
  bar: { fraction: number; text: string } | null
  totals: { amount: number; currency: string; note: string | null }[]
  debtGroup: boolean
}

const SWATCHES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6']
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[18px] px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(120px,0.7fr)] xl:grid-cols-[minmax(200px,1.35fr)_minmax(200px,1.3fr)_minmax(150px,1fr)_minmax(130px,0.7fr)]'
const SHARE_HEAD: Record<Mode, string> = { kind: 'Share of group', currency: 'Share of assets or debts', institution: 'Share of assets or debts' }

function uniq(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((x): x is string => Boolean(x)))]
}

function joinMeta(parts: ReactNode[]): ReactNode {
  const shown = parts.filter(Boolean)
  if (shown.length === 0) return null
  return shown.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && ' · '}
      {part}
    </Fragment>
  ))
}

const money = (n: number, currency: string) => <span className="amt">{formatMoney(n, currency)}</span>

function uncountedNote(list: AccountBalance[]): string | null {
  const n = list.filter((b) => !b.countsTowardTotals).length
  return n > 0 ? `${n} not in net worth` : null
}

function buildGroups(mode: Mode, live: AccountBalance[], main: string, connections: ConnectionSummary[]): Group[] {
  const mainTotals = totalsByCurrency(live).find((t) => t.currency === main)

  if (mode === 'kind') {
    return KIND_GROUPS.flatMap((g) => {
      const list = live.filter((a) => a.currency === main && g.kinds.includes(a.kind))
      if (list.length === 0) return []
      const t = totalsByCurrency(list)[0]
      const debtGroup = g.id === 'credit' || g.id === 'loan'
      const amount = t ? (debtGroup ? t.owed : t.assets) : null
      const denom = debtGroup ? mainTotals?.owed : mainTotals?.assets
      const usage = g.id === 'credit' ? creditUsage(list) : null
      const fraction = amount === null || !denom ? null : shareOf(amount, denom)
      return [
        {
          id: g.id,
          title: g.title,
          swatch: g.color,
          accounts: list,
          meta: joinMeta([
            usage && (
              <>
                Limit {money(usage.limit, main)} · {usage.percent}% used
              </>
            ),
            uniq(list.map((b) => b.institutionName)).join(' · ') || null,
            uncountedNote(list),
          ]),
          bar: fraction === null ? null : { fraction, text: `${percent(fraction)} ${debtGroup ? 'of what you owe' : 'of assets'}` },
          totals: amount === null ? [] : debtGroup ? [{ amount: Math.abs(amount), currency: main, note: debtNote(amount) }] : [{ amount, currency: main, note: null }],
          debtGroup,
        },
      ]
    })
  }

  if (mode === 'currency') {
    const currencies = uniq(live.map((b) => b.currency)).sort((a, b) => (a === main ? -1 : b === main ? 1 : a.localeCompare(b)))
    return currencies.map((currency, i) => {
      const list = live.filter((b) => b.currency === currency)
      const t = totalsByCurrency(list)[0]
      return {
        id: currency,
        title: currency,
        swatch: SWATCHES[i % SWATCHES.length],
        accounts: list,
        meta: joinMeta([
          t && (
            <>
              Assets {money(t.assets, currency)} − owed {money(t.owed, currency)}
            </>
          ),
          currency === main ? null : 'Not converted',
          uncountedNote(list),
        ]),
        bar: null,
        totals: t ? [{ amount: t.net, currency, note: 'net' }] : [],
        debtGroup: false,
      }
    })
  }

  const names = uniq(live.map((b) => b.institutionName)).sort((a, b) => a.localeCompare(b))
  const groups: { name: string | null; list: AccountBalance[] }[] = names.map((name) => ({ name, list: live.filter((b) => b.institutionName === name) }))
  const unnamed = live.filter((b) => !b.institutionName)
  if (unnamed.length > 0) groups.push({ name: null, list: unnamed })
  return groups.map(({ name, list }, i) => {
    const per = totalsByCurrency(list)
    const m = per.find((t) => t.currency === main)
    const assetShare = m && mainTotals ? shareOf(m.assets, mainTotals.assets) : null
    const owedShare = m && mainTotals ? shareOf(m.owed, mainTotals.owed) : null
    const parts = [assetShare !== null && `${percent(assetShare)} of assets`, owedShare !== null && `${percent(owedShare)} of what you owe`].filter(Boolean)
    const fraction = assetShare ?? owedShare
    const providers = uniq(list.map((b) => connectionFor(b, connections)?.provider)).map((p) => PROVIDER_LABEL[p as ConnectionSummary['provider']])
    const source = list.every((b) => b.connectionStatus === null) ? 'Manual' : providers.length > 0 ? providers.join(' · ') : 'Bank sync'
    return {
      id: name ?? 'none',
      title: name ?? 'No institution',
      swatch: SWATCHES[i % SWATCHES.length],
      accounts: list,
      meta: joinMeta([source, uncountedNote(list)]),
      bar: fraction === null ? null : { fraction, text: parts.join(' · ') },
      totals: per.map((t) => ({ amount: t.net, currency: t.currency, note: t.owed > 0 && t.assets > 0 ? 'net' : t.owed > 0 ? 'owed' : null })),
      debtGroup: false,
    }
  })
}

export function BalanceSheet({
  accounts,
  connections,
  main,
  mainTotals,
  now,
  onOpen,
  onAddBank,
}: {
  accounts: AccountBalance[]
  connections: ConnectionSummary[] | undefined
  main: string
  mainTotals: CurrencyTotals | undefined
  now: number
  onOpen: (id: string) => void
  onAddBank: () => void
}) {
  const [mode, setMode] = useState<Mode>('kind')
  const conns = connections ?? []
  const groups = buildGroups(mode, accounts, main, conns)
  const byCurrency = new Map(totalsByCurrency(accounts).map((t) => [t.currency, t]))
  const inMain = accounts.filter((a) => a.currency === main).length
  const institutions = uniq(accounts.map((a) => a.institutionName)).length
  const needAttention = connections ? accounts.filter((a) => accountHealth(a, conns, now).severity === 'broken').length : 0
  const current = accounts.length - needAttention

  return (
    <section aria-label="Accounts" className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pt-4 pb-3.5">
        <div className="min-w-0">
          <h2 className={CARD_TITLE}>Balance sheet</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
            {institutions > 0 && ` at ${institutions} institution${institutions === 1 ? '' : 's'}`} · {inMain} in {main}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {connections && (
            <>
              <span className="inline-flex items-center gap-[5px] rounded-full border border-line bg-surface px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-ink-2">
                <StatusDot /> {current} connected
              </span>
              {needAttention > 0 && (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-broken-wash px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-broken">
                  <StatusDot bad /> {needAttention} need attention
                </span>
              )}
            </>
          )}
          <button type="button" onClick={onAddBank} className="text-[12.5px] whitespace-nowrap text-ink-3 hover:text-ink">
            Add a bank ›
          </button>
          <span className="text-[12px] text-ink-3">Group by</span>
          <Segmented
            label="Group by"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'kind', label: 'Kind' },
              { value: 'currency', label: 'Currency' },
              { value: 'institution', label: 'Institution' },
            ]}
          />
        </div>
      </div>

      <div className={`${GRID} h-8 border-y border-line bg-surface-2 text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase`}>
        <span>Account</span>
        <span className="hidden xl:block">Source · freshness</span>
        <span className="hidden md:block">{SHARE_HEAD[mode]}</span>
        <span className="text-right">Balance</span>
      </div>

      <div>
        {groups.map((g) => (
          <GroupBlock key={g.id} group={g} mode={mode} byCurrency={byCurrency} connections={conns} now={now} onOpen={onOpen} />
        ))}
      </div>

      {mainTotals && (
        <div className="grid grid-cols-2 items-end gap-x-8 gap-y-3 bg-surface-2 px-6 pt-3.5 pb-4 sm:grid-cols-[repeat(3,auto)_1fr]">
          <FootFigure label="Assets" value={mainTotals.assets} currency={main} />
          <FootFigure label={mainTotals.owed < 0 ? 'In credit' : 'Owed'} value={-mainTotals.owed} currency={main} />
          <FootFigure label={`Net worth · ${main}`} value={mainTotals.net} currency={main} />
        </div>
      )}
    </section>
  )
}

function FootFigure({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">{label}</p>
      <p className="font-display text-[18px] font-extrabold tracking-[-0.01em] whitespace-nowrap text-ink">
        <Amt value={value} currency={currency} />
      </p>
    </div>
  )
}

function GroupBlock({
  group: g,
  mode,
  byCurrency,
  connections,
  now,
  onOpen,
}: {
  group: Group
  mode: Mode
  byCurrency: Map<string, CurrencyTotals>
  connections: ConnectionSummary[]
  now: number
  onOpen: (id: string) => void
}) {
  const kindAmount = g.totals[0]?.amount ?? 0
  const denominatorOf = (b: AccountBalance): number => {
    if (mode === 'kind') return kindAmount
    const t = byCurrency.get(b.currency)
    return (isDebt(b) ? t?.owed : t?.assets) ?? 0
  }
  return (
    <div className="border-b border-line last:border-b-0">
      <div className={`${GRID} min-h-16 py-2.5`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <i aria-hidden className={`size-3 shrink-0 rounded-[3px] border border-line-strong ${g.swatch}`} />
            <h3 className="font-display text-[16px] font-extrabold tracking-[-0.01em] whitespace-nowrap text-ink" aria-label={`${g.title}, ${g.accounts.length} account${g.accounts.length === 1 ? '' : 's'}`}>
              {g.title}
            </h3>
            <span className="figures rounded-[10px] border border-line px-[7px] py-px text-[11px] font-semibold text-ink-3">{g.accounts.length}</span>
          </div>
          {g.meta && <p className="mt-1 pl-[22px] text-[12px] leading-[1.4] text-ink-2 xl:hidden">{g.meta}</p>}
        </div>
        <p className="hidden text-[12px] leading-[1.4] text-ink-2 xl:block">{g.meta}</p>
        <div className="hidden flex-col gap-[5px] md:flex">
          {g.bar && (
            <>
              <span className="relative block h-2.5 overflow-hidden rounded-[5px] border border-line bg-surface-2">
                <i className={`absolute inset-y-0 left-0 border-r border-line-strong ${g.swatch}`} style={{ width: `${g.bar.fraction * 100}%` }} />
              </span>
              <small className="figures text-[11px] text-ink-3">{g.bar.text}</small>
            </>
          )}
        </div>
        <div className="text-right font-display text-[20px] leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap text-ink">
          {g.totals.length === 0 ? (
            <span className="font-sans text-[12px] font-medium tracking-normal text-ink-3">Not counted</span>
          ) : (
            g.totals.map((t) => (
              <div key={t.currency}>
                <Amt value={t.amount} currency={t.currency} />
                {t.note && <small className="block font-sans text-[11px] font-medium tracking-normal text-ink-3">{t.note}</small>}
              </div>
            ))
          )}
        </div>
      </div>
      <ul>
        {g.accounts.map((b) => (
          <li key={b.id} className="border-t border-dashed border-line">
            <AccountRow account={b} denominator={denominatorOf(b)} swatch={g.swatch} connections={connections} now={now} onOpen={() => onOpen(b.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Source({ account: b, connections, now }: { account: AccountBalance; connections: ConnectionSummary[]; now: number }) {
  const c = connectionFor(b, connections)
  const health = accountHealth(b, connections, now)
  const bad = health.severity === 'broken'
  if (b.connectionStatus === null) return <span className="text-[12px] text-ink-3">Manual entry</span>
  const when = b.lastSyncedAt ? timeAgo(b.lastSyncedAt, now) : null
  return (
    <span className="flex min-w-0 flex-col gap-[5px] text-[12px]">
      <span className="w-max max-w-full truncate rounded-full border border-line-strong bg-surface px-[9px] py-0.5 text-[11.5px] leading-[15px] font-semibold text-ink-2">
        {shortName(b.institutionName ?? 'Bank')}
        {c && ` · ${PROVIDER_LABEL[c.provider]}`}
      </span>
      <span className={`inline-flex items-center gap-[7px] font-semibold whitespace-nowrap ${bad ? 'text-broken' : ''}`}>
        <StatusDot bad={bad} />
        {bad ? health.label : 'connected'}
        <span className="font-medium text-ink-3">{when ? `· ${bad ? 'last synced ' : ''}${when}` : '· never synced'}</span>
      </span>
    </span>
  )
}

function AccountRow({
  account: b,
  denominator,
  swatch,
  connections,
  now,
  onOpen,
}: {
  account: AccountBalance
  denominator: number
  swatch: string
  connections: ConnectionSummary[]
  now: number
  onOpen: () => void
}) {
  const meta = identity(b)
  const counted = b.countsTowardTotals && b.balance !== null
  const owed = b.balance === null ? 0 : owedSign(b, b.balance)
  const util = b.kind === 'credit' && counted && b.creditLimit !== null ? usedPercent(owed, b.creditLimit) : null
  const share = counted ? shareOf(owed, denominator) : null
  let small: ReactNode = null
  const shown = b.balance === null ? null : displayBalance(b, b.balance)
  if (isDebt(b)) small = shown?.credit ? 'in credit' : 'owed'
  else if (b.kind === 'cash' && b.availableBalance !== null) small = <>Available <span className="amt">{formatMoney(b.availableBalance, b.currency)}</span></>

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${b.name}`}
      data-account-row={b.id}
      className={`${GRID} min-h-[60px] w-full py-[9px] text-left transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-2px]`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <AccountIcon kind={b.kind} subtype={b.subtype} label={b.institutionName ?? b.name} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-ink">{b.name}</span>
            {!b.countsTowardTotals && <span className={TAG}>Not in net worth</span>}
            {b.bankBalanceIsFallback && (
              <span className="shrink-0 rounded-sm border border-line bg-surface-2 px-1.5 text-[11px] leading-[18px] font-medium text-ink-2">
                <span aria-hidden>est.</span>
                <span className="sr-only">balance estimated by the bank</span>
              </span>
            )}
          </span>
          {meta && <span className="block truncate text-[12px] text-ink-3">{meta}</span>}
          {b.mismatch && (
            <span className="figures block text-[12px] text-warning">
              ≠ <MismatchNote account={b} />
            </span>
          )}
          <span className="mt-1 block xl:hidden">
            <Source account={b} connections={connections} now={now} />
          </span>
        </span>
      </span>
      <span className="hidden min-w-0 xl:block">
        <Source account={b} connections={connections} now={now} />
      </span>
      <span className="figures hidden items-center gap-2.5 text-[12px] text-ink-2 md:flex">
        {util !== null ? (
          <>
            <Bar fraction={Math.min(util / 100, 1)} className="bg-chart-3" />
            <span className="w-[74px] text-right font-semibold text-ink">{util}% of limit</span>
          </>
        ) : share !== null ? (
          <>
            <Bar fraction={share} className={swatch} />
            <span className="w-[46px] text-right font-semibold text-ink">{percent(share)}</span>
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </span>
      <span className="text-right text-[15px] font-bold whitespace-nowrap text-ink">
        {b.balance === null ? (
          <>
            <span className="text-ink-3">—</span>
            <small className="block text-[11px] font-medium text-ink-3 italic">Unknown</small>
          </>
        ) : (
          <>
            <Amt value={shown?.value ?? owed} currency={b.currency} />
            {small && <small className="figures block text-[11px] font-medium text-ink-3">{small}</small>}
          </>
        )}
      </span>
    </button>
  )
}

function Bar({ fraction, className }: { fraction: number; className: string }) {
  return (
    <span className="relative block h-1.5 flex-1 overflow-hidden rounded-[3px] border border-line bg-surface-2">
      <i className={`absolute inset-y-0 left-0 ${className}`} style={{ width: `${fraction * 100}%` }} />
    </span>
  )
}
