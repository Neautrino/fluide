import { NeedsYouView } from '@repo/ui/accounts'
import type { ConnectionSummary } from '../../lib/api'
import { blocksReconnect, HTTPS_REASON, HTTPS_REASON_ID } from '../../lib/https'
import { ConnectionAction } from './ConnectionAction'

export function NeedsYou({
  connections,
  error,
  now,
  onSettings,
}: {
  connections: ConnectionSummary[] | undefined
  error: string | null
  now: number
  onSettings: () => void
}) {
  return (
    <NeedsYouView
      connections={connections}
      error={error}
      now={now}
      onSettings={onSettings}
      renderAction={(c, health) => <ConnectionAction connection={c} health={health} onSettings={onSettings} />}
      renderNote={(attention) =>
        attention.some(({ connection: c, health }) => health.state !== 'error' && health.actions.reconnect && blocksReconnect(c)) && (
          <p id={HTTPS_REASON_ID} className="basis-full text-[12px] text-ink-3">
            {HTTPS_REASON}
          </p>
        )
      }
    />
  )
}
