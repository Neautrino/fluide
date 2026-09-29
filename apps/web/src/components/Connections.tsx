import { useState } from 'react'
import { errorMessage, getJson, sendJson, type ConnectionStatus, type ConnectionSummary, type SyncOutcome } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatLocalDate, formatTimestamp } from '../lib/format'
import { useResource } from '../lib/useResource'
import { ConnectBank } from './ConnectBank'
import { SyncNotice } from './SyncNotice'
import { Button } from './ui/Button'
import { Empty, ErrorState, Loading, Notice } from './ui/States'
import { SectionTitle } from './ui/Typography'

const STATUS: Record<ConnectionStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-green' },
  reauth_required: { label: 'Needs reconnect', className: 'text-amber' },
  error: { label: 'Sync failed', className: 'text-red' },
  disconnected: { label: 'Disconnected', className: 'text-ink-3' },
}

const PROVIDER_LABEL: Record<ConnectionSummary['provider'], string> = { plaid: 'Plaid', 'enable-banking': 'Enable Banking' }

export function Connections() {
  const { version, invalidate } = useApp()
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle aside="One row per bank login">Bank connections</SectionTitle>
      {connections.error ? (
        <ErrorState title="Couldn't load bank connections" message={connections.error} onRetry={connections.reload} />
      ) : !connections.data ? (
        <Loading label="Loading bank connections" rows={2} />
      ) : connections.data.length === 0 ? (
        <Empty title="No bank connected yet">Connect a bank from the Overview.</Empty>
      ) : (
        <ConnectionList connections={connections.data} onChanged={invalidate} />
      )}
    </div>
  )
}

/** Accounts a replaced login had that its successor does not carry: from the
 * cut-over date nothing counts their history. */
function missingAccounts(successor: ConnectionSummary, all: ConnectionSummary[]): number {
  const shortfalls = all
    .filter((p) => p.replacedByConnectorId === successor.id)
    .map((p) => p.accounts.length - successor.accounts.length)
  return shortfalls.length === 0 ? 0 : Math.max(0, ...shortfalls)
}

function ConnectionList({ connections, onChanged }: { connections: ConnectionSummary[]; onChanged: () => void }) {
  return (
    <ul className="flex flex-col">
      {connections.map((c) => (
        <ConnectionRow key={c.id} connection={c} missing={missingAccounts(c, connections)} onChanged={onChanged} />
      ))}
    </ul>
  )
}

function ConnectionRow({
  connection: c,
  missing,
  onChanged,
}: {
  connection: ConnectionSummary
  missing: number
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<'sync' | 'disconnect' | 'reconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null)
  const name = c.institutionName ?? `${PROVIDER_LABEL[c.provider]} login`
  const status = STATUS[c.status]
  const live = c.status !== 'disconnected'
  const plaid = c.provider === 'plaid'

  const act = async (which: 'sync' | 'disconnect' | 'reconnect') => {
    if (
      which === 'disconnect' &&
      !window.confirm(
        `Disconnect ${name}? Fluide stops syncing it${plaid ? ' and Plaid deletes the login (billing for it stops)' : ''}. Imported history stays in the ledger.`,
      )
    ) {
      return
    }
    setBusy(which)
    setError(null)
    setOutcome(null)
    try {
      if (which === 'sync') {
        const { sync } = await sendJson<{ sync: SyncOutcome }>('POST', `/api/providers/connections/${c.id}/sync`, undefined, 120_000)
        setOutcome(sync)
      } else if (which === 'reconnect') {
        // Enable Banking: a new authorization at the same bank; the bank sends the user back to the callback.
        const { redirectUrl } = await sendJson<{ redirectUrl: string }>('POST', `/api/providers/connections/${c.id}/reconnect`)
        window.location.assign(redirectUrl)
        return
      } else {
        await sendJson('POST', `/api/providers/connections/${c.id}/disconnect`)
      }
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="flex flex-col gap-3 border-b border-rule py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] text-ink">
            {name} <span className="text-[13px] text-ink-3">· {PROVIDER_LABEL[c.provider]}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-3">
            <span className={`font-medium ${status.className}`}>{status.label}</span>
            {c.statusReason && ` — ${c.statusReason}`}
            {' · '}
            {c.lastSyncedAt ? `last synced ${formatTimestamp(c.lastSyncedAt)}` : 'never synced'}
            {c.validUntil && live && ` · access until ${formatTimestamp(c.validUntil)}`}
            {c.countedUntil && ` · history counted up to ${formatLocalDate(c.countedUntil)}`}
          </p>
          {c.accounts.length > 0 && (
            <p className="mt-1 text-[13px] text-ink-2">
              {c.accounts.map((a) => (a.mask ? `${a.name} ••${a.mask}` : a.name)).join(' · ')}
            </p>
          )}
          {missing > 0 && (
            <p className="mt-1 text-[13px] text-amber">
              {missing} account{missing === 1 ? '' : 's'} from your old login {missing === 1 ? 'is' : 'are'} not in this one —{' '}
              {missing === 1 ? 'its' : 'their'} recent history isn't counted
            </p>
          )}
        </div>
        {live && (
          <div className="flex flex-wrap items-start gap-2">
            <Button size="sm" onClick={() => void act('sync')} busy={busy === 'sync'} disabled={busy !== null}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </Button>
            {plaid ? (
              <ConnectBank reconnectId={c.id} onConnected={onChanged} variant="secondary" size="sm" />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => void act('reconnect')} busy={busy === 'reconnect'} disabled={busy !== null}>
                {busy === 'reconnect' ? 'Opening bank…' : 'Reconnect'}
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => void act('disconnect')} busy={busy === 'disconnect'} disabled={busy !== null}>
              Disconnect
            </Button>
          </div>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {outcome && <SyncNotice outcomes={[outcome]} />}
    </li>
  )
}
