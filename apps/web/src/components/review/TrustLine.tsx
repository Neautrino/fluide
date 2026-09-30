import { useMemo } from 'react'
import type { ConnectionSummary } from '../../lib/api'
import { chipText, summarizeConnections, type Severity } from '../../lib/connection-health'
import type { TransferGroup } from './data'
import { Amt, StakeAmounts } from './shared'
import type { AtStake } from './helpers'

const PILL: Record<Severity, string> = {
  ok: '',
  broken: 'border-broken bg-broken-wash text-broken',
  warning: 'border-warning bg-warning-wash text-ink',
}

type Props = { count: number; stake: AtStake[]; transfers: TransferGroup[]; connections: ConnectionSummary[] | undefined }

export function TrustLine({ count, stake, transfers, connections }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever connections are (re)loaded
  const now = useMemo(() => Date.now(), [connections])
  const { attention, syncStamp } = summarizeConnections(connections ?? [], now)
  return (
    <div className="figures flex flex-wrap items-center gap-x-3.5 gap-y-2 min-h-[45px] rounded-lg border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px] text-ink-2 shadow-1">
      <span className="flex items-center gap-2 font-bold text-ink">
        <i aria-hidden className="size-2.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
        {count} waiting
        {stake.length > 0 && (
          <>
            {' '}
            · <StakeAmounts stake={stake} /> at stake
          </>
        )}
      </span>
      {transfers.map((g) => (
        <span key={g.currency} className="text-ink-3">
          + {g.rows.length} possible {g.rows.length === 1 ? 'transfer' : 'transfers'}{' '}
          <Amt value={g.rows.reduce((s, r) => s + Math.abs(r.amount), 0)} currency={g.currency} sign="never" /> — counted until you
          decide
        </span>
      ))}
      {attention.map(({ connection: c, health }) => (
        <span key={c.id} className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] font-medium ${PILL[health.severity]}`}>
          {chipText(c, health)}
        </span>
      ))}
      {syncStamp && <span className="ml-auto text-[12px] text-ink-3">{syncStamp}</span>}
    </div>
  )
}
