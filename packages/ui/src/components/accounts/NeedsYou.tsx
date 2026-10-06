import type { ReactNode } from 'react'
import { allOkText, chipText, othersConnectedText, summarizeConnections, type Attention, type Health, type Severity } from '../../lib/connection-health'
import type { ConnectionSummary } from '../../types'

const CHIP: Record<Severity, string> = {
  ok: 'border-line text-ink-2 bg-surface',
  warning: 'border-warning text-warning bg-surface',
  broken: 'border-broken text-broken bg-broken-wash',
}

const CHIP_DOT: Record<Severity, string> = {
  ok: 'size-1.5 rounded-full bg-positive',
  warning: 'size-1.5 rounded-full bg-warning',
  broken: 'size-1.5 rotate-45 rounded-[1px] bg-broken',
}

/**
 * The connection strip above the Accounts page. Reconnecting is the host's business: it passes the button
 * through `renderAction`, and the https caveat (which is about how that server is served) through `renderNote`.
 */
export function NeedsYouView({
  connections,
  error,
  now,
  onSettings,
  renderAction,
  renderNote,
}: {
  connections: ConnectionSummary[] | undefined
  error: string | null
  now: number
  onSettings: () => void
  renderAction?: (connection: ConnectionSummary, health: Health) => ReactNode
  /** A line below the chips, e.g. why Reconnect is disabled; gets the connections that need the user. */
  renderNote?: (attention: Attention[]) => ReactNode
}) {
  const shell = 'flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-md border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px]'
  if (error) {
    return (
      <div role="status" className={shell}>
        <span className="text-ink-2">Connection status is unavailable right now.</span>
      </div>
    )
  }
  if (!connections) return null

  const { live, attention, syncStamp } = summarizeConnections(connections, now)
  const others = live.length - attention.length
  const synced = syncStamp && <span className="text-[12px] whitespace-nowrap text-ink-3">{syncStamp}</span>
  const settings = (
    <button type="button" onClick={onSettings} className="text-[12.5px] whitespace-nowrap text-ink-3 hover:text-ink">
      {attention.length === 0 ? 'Manage in Settings ›' : `${othersConnectedText(others)} ›`}
    </button>
  )

  if (attention.length === 0) {
    return (
      <div role="status" className={shell}>
        <span className="flex items-center gap-2 font-bold whitespace-nowrap">
          <span aria-hidden className="size-2.5 rounded-full bg-positive" />
          {live.length === 0 ? 'No bank connections' : allOkText(live.length)}
        </span>
        <span className="ml-auto flex items-center gap-3.5">
          {synced}
          {settings}
        </span>
      </div>
    )
  }

  return (
    <div role="status" className={shell}>
      <span className="flex items-center gap-2 font-bold whitespace-nowrap">
        <span aria-hidden className="size-2.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
        {attention.length} connection{attention.length === 1 ? '' : 's'} need{attention.length === 1 ? 's' : ''} you
      </span>
      <span aria-hidden className="h-[18px] w-px bg-line" />
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {attention.map(({ connection: c, health }) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] whitespace-nowrap ${CHIP[health.severity]}`}>
              <span aria-hidden className={`inline-block ${CHIP_DOT[health.severity]}`} />
              {chipText(c, health)}
            </span>
            {renderAction?.(c, health)}
          </li>
        ))}
      </ul>
      {(others > 0 || synced) && (
        <span className="ml-auto flex items-center gap-3.5">
          {synced}
          {others > 0 && settings}
        </span>
      )}
      {renderNote?.(attention)}
    </div>
  )
}
