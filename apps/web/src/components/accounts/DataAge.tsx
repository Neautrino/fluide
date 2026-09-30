import type { ConnectionSummary } from '../../lib/api'
import { connectionHealth, shortName } from '../../lib/connection-health'
import { CARD, CARD_TITLE } from './model'
import { StatusDot } from './shared'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const SCALE_DAYS = 30

function ageText(ms: number): string {
  if (ms < HOUR_MS) return 'just now'
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`
  const days = Math.round(ms / DAY_MS)
  return `${days} day${days === 1 ? '' : 's'}`
}

export function DataAge({ connections, stamp, now }: { connections: ConnectionSummary[]; stamp: string | null; now: number }) {
  const rows = connections
    .map((c) => ({
      c,
      bad: connectionHealth(c, now).severity === 'broken',
      age: c.lastSyncedAt ? Math.max(0, now - new Date(c.lastSyncedAt).getTime()) : null,
    }))
    .sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity))
  const legend = 'inline-flex items-center gap-1.5'
  const cols = 'grid grid-cols-[92px_minmax(0,1fr)_56px] items-center gap-x-2.5 min-[1360px]:grid-cols-[104px_minmax(0,1fr)_62px]'

  return (
    <section aria-label="Data age by source" className={`${CARD} flex min-w-0 flex-col px-[18px] pt-4 pb-3.5`}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-2.5">
        <h2 className={CARD_TITLE}>Data age</h2>
        {stamp && <span className="text-[11.5px] whitespace-nowrap text-ink-3">{stamp}</span>}
      </div>
      <ul className="flex flex-col gap-[9px]">
        {rows.map(({ c, bad, age }) => (
          <li key={c.id} className={`${cols} text-[12px]`}>
            <span className={`flex items-center gap-[7px] overflow-hidden font-semibold whitespace-nowrap ${bad ? 'text-broken' : ''}`}>
              <StatusDot bad={bad} />
              <span className="truncate" title={c.institutionName ?? undefined}>{shortName(c.institutionName ?? 'Bank')}</span>
            </span>
            <span className="relative h-2.5 border-l border-line-strong">
              {age !== null && (
                <i
                  className={`absolute inset-y-0 left-0 rounded-r-[4px] ${bad ? 'rounded-l-none border border-l-0 border-dashed border-broken' : 'bg-chart-muted'}`}
                  style={{ width: `${Math.max(1, Math.min(age / (SCALE_DAYS * DAY_MS), 1) * 100)}%` }}
                />
              )}
            </span>
            <span className={`figures text-right font-semibold whitespace-nowrap ${bad ? 'text-broken' : 'text-ink-2'}`}>
              {age === null ? (
                <>
                  never<span className="sr-only"> synced</span>
                </>
              ) : (
                ageText(age)
              )}
            </span>
          </li>
        ))}
      </ul>
      <div aria-hidden className={`${cols} mt-0.5 text-[10.5px] text-ink-3`}>
        <span />
        <div className="flex justify-between">
          <span>0</span>
          <span>15</span>
          <span>30 days</span>
        </div>
        <span />
      </div>
      <div className="mt-auto flex items-center gap-3.5 pt-2 text-[11.5px] text-ink-3">
        <span className={legend}>
          <StatusDot /> connected
        </span>
        <span className={legend}>
          <StatusDot bad /> broken
        </span>
      </div>
    </section>
  )
}
