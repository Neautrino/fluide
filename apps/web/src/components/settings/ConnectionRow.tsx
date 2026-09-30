import { useEffect, useRef, useState } from 'react'
import { errorMessage, sendJson, type ConnectionSummary, type SyncOutcome } from '../../lib/api'
import { connectionHealth, HTTPS_REASON, isHttps, timeAgo, type Health } from '../../lib/connection-health'
import { bankRedirectUrl } from '../../lib/enable-banking'
import { formatLocalDate, formatTimestamp } from '../../lib/format'
import { ConnectBank } from '../ConnectBank'
import { SyncNotice } from '../SyncNotice'
import { Notice } from '../ui/States'
import { ConsentStrip } from './ConsentStrip'
import { chipParts, plural } from './time'
import { ActionButton, PillButton, type Look } from './ui'

const TAG: Record<ConnectionSummary['provider'], string> = { plaid: 'Plaid', 'enable-banking': 'Enable Banking · EU' }
const LOGIN: Record<ConnectionSummary['provider'], string> = { plaid: 'Plaid login', 'enable-banking': 'Enable Banking login' }
const TILE = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']
const SYNC_TIMEOUT_MS = 120_000

type Busy = 'sync' | 'disconnect' | 'reconnect'
type Dot = 'ok' | 'warn' | 'broken' | 'off'

const DOT: Record<Dot, string> = {
  ok: 'bg-positive',
  warn: 'bg-warning',
  broken: 'bg-broken',
  off: 'border-[1.4px] border-ink-3',
}

function initials(name: string): string {
  const words = name
    .replace(/\s*\([^)]*\)/g, '')
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => Array.from(w)[0]) : Array.from(words[0] ?? '').slice(0, 2)
  return letters.join('').toUpperCase()
}

function statusView(c: ConnectionSummary, h: Health, now: number): { label: string; detail: string | null; dot: Dot } {
  const reason = c.statusReason ? ` · ${c.statusReason}` : ''
  const lastGood = c.lastSyncedAt ? `Last good ${timeAgo(c.lastSyncedAt, now)}` : 'Never synced successfully'
  const synced = c.lastSyncedAt ? `Synced ${timeAgo(c.lastSyncedAt, now)}` : 'Never synced'
  const stamp = c.lastSyncedAt ? formatTimestamp(c.lastSyncedAt) : null
  const until = c.validUntil && c.provider === 'enable-banking' ? `access until ${formatLocalDate(c.validUntil)}` : null
  switch (h.state) {
    case 'ok':
      return { label: synced, detail: [stamp, until].filter(Boolean).join(' · ') || null, dot: 'ok' }
    case 'warn':
      return { label: `${synced} · access ends soon`, detail: null, dot: 'warn' }
    case 'reauth':
      return { label: `Needs reconnect${reason}`, detail: lastGood, dot: 'broken' }
    case 'expired':
      return { label: `Access expired ${formatLocalDate(c.validUntil ?? '')}`, detail: lastGood, dot: 'broken' }
    case 'error':
      return { label: `Sync failed${reason}`, detail: lastGood, dot: 'broken' }
    case 'disconnected':
      return {
        label: `Disconnected${reason}`,
        detail: c.countedUntil ? `History counted up to ${formatLocalDate(c.countedUntil)}` : null,
        dot: 'off',
      }
  }
}

function DateChip({ c, h }: { c: ConnectionSummary; h: Health }) {
  const warn = h.state === 'warn'
  const broken = h.severity === 'broken'
  const iso = warn ? c.validUntil : c.lastSyncedAt
  const parts = iso ? chipParts(iso) : null
  const title = warn ? 'Access ends' : broken ? 'Last good sync' : 'Last sync'
  const frame = warn
    ? 'border-dashed border-line-strong bg-surface'
    : broken
      ? 'border-broken bg-surface'
      : 'border-line bg-surface-2'
  return (
    <span aria-hidden title={title} className={`flex h-11 w-10 flex-col items-center justify-center rounded-md border leading-none ${frame}`}>
      <b className={`figures font-display text-[15px] font-extrabold text-ink ${broken ? 'line-through decoration-1' : ''}`}>
        {parts?.day ?? '–'}
      </b>
      {parts && <span className="mt-[3px] text-[9px] font-bold tracking-[0.08em] text-ink-3 uppercase">{parts.month}</span>}
    </span>
  )
}

function Accounts({ accounts }: { accounts: ConnectionSummary['accounts'] }) {
  const [expanded, setExpanded] = useState(false)
  if (accounts.length === 0) return null
  const labels = accounts.map((a) => (a.mask ? `${a.name} ••${a.mask}` : a.name))
  const extra = labels.length - 2
  return (
    <p className="mt-[3px] text-[11.5px] leading-[1.45] text-ink-3">
      {(expanded ? labels : labels.slice(0, 2)).join(' · ')}
      {extra > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="ml-1.5 font-semibold text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          {expanded ? 'show less' : `+${extra} more`}
        </button>
      )}
    </p>
  )
}

function DisconnectConfirm({
  name,
  plaid,
  busy,
  onConfirm,
  onKeep,
}: {
  name: string
  plaid: boolean
  busy: boolean
  onConfirm: () => void
  onKeep: () => void
}) {
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => keepRef.current?.focus(), [])
  return (
    <div
      role="group"
      aria-label={`Confirm disconnect ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) {
          e.stopPropagation()
          onKeep()
        }
      }}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]"
    >
      <p className="min-w-56 flex-1 leading-relaxed text-ink-2">
        <b className="font-semibold text-ink">Disconnect {name}?</b> Fluide stops syncing it
        {plaid ? ' and Plaid deletes the login (billing for it stops)' : ''}. Imported history stays in the ledger.
      </p>
      <div className="flex gap-2">
        <PillButton tone="danger" busy={busy} onClick={onConfirm}>
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </PillButton>
        <PillButton ref={keepRef} disabled={busy} onClick={onKeep}>
          Keep
        </PillButton>
      </div>
    </div>
  )
}

export function ConnectionRow({
  connection: c,
  index,
  divider,
  missing,
  now,
  onChanged,
  onRemoved,
}: {
  connection: ConnectionSummary
  index: number
  divider: boolean
  missing: number
  now: number
  onChanged: () => void
  /** Called once a disconnect succeeded, before the list reloads, so the parent can place focus. */
  onRemoved: () => void
}) {
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [linking, setLinking] = useState(false)
  const disconnectRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  const h = connectionHealth(c, now)
  const broken = h.severity === 'broken'
  const disconnected = h.state === 'disconnected'
  const locked = busy !== null || linking
  const plaid = c.provider === 'plaid'
  const name = c.institutionName ?? LOGIN[c.provider]
  const status = statusView(c, h, now)
  const blocked = !plaid && !isHttps()
  const reasonId = `conn-${c.id}-https`

  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false
      disconnectRef.current?.focus()
    }
  }, [confirming])

  const closeConfirm = () => {
    restoreFocus.current = true
    setConfirming(false)
  }

  const act = async (which: Busy) => {
    setBusy(which)
    setError(null)
    setOutcome(null)
    let removed = false
    try {
      if (which === 'sync') {
        const { sync } = await sendJson<{ sync: SyncOutcome }>('POST', `/api/providers/connections/${c.id}/sync`, undefined, SYNC_TIMEOUT_MS)
        setOutcome(sync)
      } else if (which === 'reconnect') {
        // Enable Banking: a new authorization at the same bank; the bank sends the user back to the callback.
        const { redirectUrl } = await sendJson<{ redirectUrl: string }>('POST', `/api/providers/connections/${c.id}/reconnect`)
        window.location.assign(bankRedirectUrl(redirectUrl))
        return
      } else {
        await sendJson('POST', `/api/providers/connections/${c.id}/disconnect`)
        removed = true
        onRemoved()
      }
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
      if (which === 'disconnect') closeConfirm()
    } finally {
      if (!removed) setBusy(null)
    }
  }

  const sync = (look: Look) => (
    <ActionButton look={look} busy={busy === 'sync'} disabled={locked} onClick={() => void act('sync')}>
      {busy === 'sync' ? 'Syncing…' : 'Sync now'}
      <span className="sr-only">, {name}</span>
    </ActionButton>
  )

  const reconnect = (look: Look, label: 'Reconnect' | 'Renew') =>
    plaid ? (
      <ConnectBank
        reconnectId={c.id}
        onConnected={onChanged}
        onBusyChange={setLinking}
        extrasIn={slot}
        renderTrigger={(t) => (
          <ActionButton look={look} busy={t.busy} disabled={busy !== null} onClick={t.onClick}>
            {t.label}
            <span className="sr-only">, {name}</span>
          </ActionButton>
        )}
      />
    ) : (
      <ActionButton
        look={look}
        busy={busy === 'reconnect'}
        disabled={locked || blocked}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={() => void act('reconnect')}
      >
        {busy === 'reconnect' ? 'Opening bank…' : label}
        <span className="sr-only">, {name}</span>
      </ActionButton>
    )

  const { sync: canSync, reconnect: reconnectLabel, primary } = h.actions
  const syncLook: Look = primary === 'sync' ? 'primary' : primary === 'reconnect' ? 'text' : 'secondary'
  const reconnectLook: Look = primary !== 'reconnect' ? 'text' : canSync ? 'primary' : 'broken'
  const syncAction = canSync && sync(syncLook)
  const reconnectAction = reconnectLabel && reconnect(reconnectLook, reconnectLabel)
  const actions = primary === 'reconnect' ? (
    <>
      {reconnectAction}
      {syncAction}
    </>
  ) : (
    <>
      {syncAction}
      {reconnectAction}
    </>
  )

  const flag = h.state === 'error' ? 'Sync failed' : broken ? 'Broken' : null
  const tone = [
    divider ? 'border-t border-line' : '',
    broken ? 'bg-broken-wash shadow-[inset_3px_0_0_var(--broken)] [html[data-theme=dark]_&]:[--ink-3:var(--ink-2)]' : '',
  ].join(' ')

  return (
    <li data-conn={c.id} className={`flex flex-col gap-2 rounded-sm px-2.5 py-[11px] ${tone}`}>
      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 @min-[560px]:grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] @min-[860px]:grid-cols-[36px_minmax(0,1fr)_minmax(0,1.35fr)_64px_252px]">
        <span
          aria-hidden
          className={`grid size-9 place-items-center rounded-full border border-ink font-display text-[12px] font-extrabold text-tile-ink ${TILE[index % TILE.length]} ${
            disconnected ? 'opacity-60' : ''
          }`}
        >
          {initials(name)}
        </span>

        <div className="min-w-0">
          <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold ${disconnected ? 'text-ink-2' : 'text-ink'}`}>
            {name}
            <span className="rounded-[9px] border border-line px-[7px] py-px text-[10.5px] leading-[1.3] font-semibold whitespace-nowrap text-ink-2">
              {TAG[c.provider]}
            </span>
            {flag && (
              <span className="rounded-[8px] bg-broken px-[7px] py-0.5 text-[10px] leading-none font-bold tracking-[0.05em] text-ink-inverse uppercase">
                {flag}
              </span>
            )}
          </p>
          <Accounts accounts={c.accounts} />
          {missing > 0 && (
            <p className="mt-1 text-[11.5px] text-warning">
              {plural(missing, 'account')} from your old login {missing === 1 ? 'is' : 'are'} not in this one —{' '}
              {missing === 1 ? 'its' : 'their'} recent history isn't counted
            </p>
          )}
        </div>

        <div className="col-start-2 grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-[11px] @min-[560px]:col-start-auto">
          <DateChip c={c} h={h} />
          <div className="min-w-0 text-[12.5px] leading-[1.4]">
            <p className={`flex items-baseline gap-[7px] font-semibold ${broken ? 'text-broken' : disconnected ? 'text-ink-3' : 'text-ink'}`}>
              <span aria-hidden className={`mt-[0.45em] size-[7px] flex-none self-start rounded-full ${DOT[status.dot]}`} />
              {status.label}
            </p>
            {status.detail && <p className="text-[11.5px] text-ink-3">{status.detail}</p>}
            {h.state === 'warn' && h.daysLeft !== null && c.validUntil && <ConsentStrip daysLeft={h.daysLeft} validUntil={c.validUntil} />}
          </div>
        </div>

        <div className="col-start-2 flex flex-wrap items-center justify-between gap-3 @min-[560px]:col-span-2 @min-[560px]:col-start-2 @min-[860px]:contents">
          <p className="text-right text-[12px] leading-tight text-ink-2">
            <b className="figures block font-display text-[17px] font-extrabold text-ink">{c.accounts.length}</b>
            {c.accounts.length === 1 ? 'account' : 'accounts'}
          </p>
          {!disconnected && !confirming && (
            <div data-conn-actions className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2">
              {actions}
              <ActionButton ref={disconnectRef} look="text" disabled={locked} onClick={() => setConfirming(true)}>
                Disconnect<span className="sr-only">, {name}</span>
              </ActionButton>
            </div>
          )}
        </div>
      </div>

      {blocked && !disconnected && (
        <p id={reasonId} className="text-[11.5px] text-ink-3">
          {HTTPS_REASON}
        </p>
      )}
      {confirming && (
        <DisconnectConfirm
          name={name}
          plaid={plaid}
          busy={busy === 'disconnect'}
          onConfirm={() => void act('disconnect')}
          onKeep={closeConfirm}
        />
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {outcome && <SyncNotice outcomes={[outcome]} />}
      <div ref={setSlot} className="flex flex-col gap-2 empty:hidden" />
    </li>
  )
}
