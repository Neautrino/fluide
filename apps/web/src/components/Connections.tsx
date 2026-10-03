import { useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import type { ConnectionSummary } from '../lib/api'
import { connectionHealth, isLiveConnection, summarizeConnections } from '../lib/connection-health'
import { queryError } from '../lib/queries'
import { ConnectionRow } from './settings/ConnectionRow'
import { plural } from './settings/time'
import { CardHeader, Stamp } from './settings/ui'
import { Empty, ErrorState, Loading } from './ui/States'

/** Accounts a replaced login had that its successor does not carry: from the
 * cut-over date nothing counts their history. */
function missingAccounts(successor: ConnectionSummary, all: ConnectionSummary[]): number {
  const shortfalls = all
    .filter((p) => p.replacedByConnectorId === successor.id)
    .map((p) => p.accounts.length - successor.accounts.length)
  return shortfalls.length === 0 ? 0 : Math.max(0, ...shortfalls)
}

export function Connections({ connections, now }: { connections: UseQueryResult<ConnectionSummary[]>; now: number }) {
  const queryClient = useQueryClient()
  const all = connections.isError ? undefined : connections.data
  const live = all?.filter(isLiveConnection) ?? []
  const disconnected = all?.filter((c) => !isLiveConnection(c)) ?? []
  const { accounts, syncStamp } = summarizeConnections(live, now)
  const heading = useRef<HTMLHeadingElement>(null)
  const handoff = useRef<{ next: string | null } | null>(null)

  useEffect(() => {
    const pending = handoff.current
    if (!pending || !all) return
    handoff.current = null
    const next = pending.next
      ? document.querySelector<HTMLElement>(`[data-conn="${pending.next}"] [data-conn-actions] button:not(:disabled)`)
      : null
    ;(next ?? heading.current)?.focus()
  }, [all])

  const removed = (id: string) => {
    handoff.current = { next: live[live.findIndex((c) => c.id === id) + 1]?.id ?? null }
  }

  return (
    <section id="connections" className="scroll-mt-6">
      <CardHeader
        level={2}
        headingRef={heading}
        title="Connections"
        meta={
          live.length > 0
            ? `${plural(live.length, 'login')} · ${plural(accounts, 'account')} · Fluide only reads, it never moves money`
            : 'Fluide only reads, it never moves money'
        }
        aside={syncStamp ? <Stamp>{syncStamp}</Stamp> : undefined}
      />
      <div className="mt-3 rounded-lg border border-line bg-surface px-3 pt-3.5 pb-2 shadow-1">
        {connections.isError ? (
          <ErrorState
            title="Couldn't load bank connections"
            message={queryError(connections)}
            onRetry={() => void connections.refetch()}
          />
        ) : !all ? (
          <Loading label="Loading bank connections" rows={2} />
        ) : all.length === 0 ? (
          <Empty title="No bank connected yet">Add one below.</Empty>
        ) : (
          <>
            {live.length > 0 && (
              <Group title="Live sync" note="read-only bank access" first>
                <RowList
                  connections={live}
                  all={all}
                  now={now}
                  onChanged={() => void queryClient.invalidateQueries()}
                  onRemoved={removed}
                />
              </Group>
            )}
            {disconnected.length > 0 && (
              <Group title="Disconnected" note="history stays in the ledger" first={live.length === 0}>
                <RowList
                  connections={disconnected}
                  all={all}
                  now={now}
                  onChanged={() => void queryClient.invalidateQueries()}
                  onRemoved={removed}
                />
              </Group>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Group({ title, note, first, children }: { title: string; note: string; first: boolean; children: ReactNode }) {
  return (
    <>
      <h3 className={`flex gap-1.5 px-1 pb-1.5 font-sans text-[12.5px] font-bold tracking-normal text-ink-2 ${first ? '' : 'pt-3.5'}`}>
        {title} <span className="font-medium text-ink-3">· {note}</span>
      </h3>
      {children}
    </>
  )
}

function RowList({
  connections,
  all,
  now,
  onChanged,
  onRemoved,
}: {
  connections: ConnectionSummary[]
  all: ConnectionSummary[]
  now: number
  onChanged: () => void
  onRemoved: (id: string) => void
}) {
  return (
    <ul className="@container flex flex-col">
      {connections.map((c, i) => {
        const previous = connections[i - 1]
        const brokenHere = connectionHealth(c, now).severity === 'broken'
        const brokenBefore = previous ? connectionHealth(previous, now).severity === 'broken' : false
        return (
          <ConnectionRow
            key={c.id}
            connection={c}
            index={i}
            divider={i > 0 && !brokenHere && !brokenBefore}
            missing={missingAccounts(c, all)}
            now={now}
            onChanged={onChanged}
            onRemoved={() => onRemoved(c.id)}
          />
        )
      })}
    </ul>
  )
}
