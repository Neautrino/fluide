import { useMemo } from 'react'
import { getJson, type ConnectionSummary } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { chipText, othersConnectedText, summarizeConnections, type Severity } from '../../lib/connection-health'
import { useResource } from '../../lib/useResource'

const CHIP: Record<Severity, string> = {
  ok: '',
  warning: 'border-warning text-warning',
  broken: 'border-broken bg-broken-wash text-broken',
}

const DOT: Record<Severity, string> = { ok: '', warning: 'bg-warning', broken: 'bg-broken' }

/** Shown only while something limits what answers can see; silent when all is well or the check fails. */
export function TrustLine() {
  const { navigate, reviewCount, version } = useApp()
  const { data } = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever connections are (re)loaded
  const now = useMemo(() => Date.now(), [data])
  const { live, attention, syncStamp } = summarizeConnections(data ?? [], now)
  const flags = attention.map(({ connection: c, health }) => ({ id: c.id, text: chipText(c, health), severity: health.severity }))
  const waiting = reviewCount ?? 0
  if (flags.length === 0 && waiting === 0) return null
  const others = live.length - flags.length

  return (
    <div
      aria-label="What answers can see"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface py-[9px] pr-3 pl-3.5 text-[13px] shadow-1"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 font-bold whitespace-nowrap">
          <span aria-hidden className="size-2.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
          Needs you
        </span>
        <span aria-hidden className="h-[18px] w-px bg-line" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {flags.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => navigate('settings')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] whitespace-nowrap ${CHIP[f.severity]}`}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${DOT[f.severity]}`} />
            {f.text}
          </button>
        ))}
        {flags.length > 0 && others > 0 && (
          <button type="button" onClick={() => navigate('settings')} className="text-[12px] whitespace-nowrap text-ink-3 hover:text-ink">
            {othersConnectedText(others)} ›
          </button>
        )}
      </div>
      {syncStamp && <span className="ml-auto text-[12px] whitespace-nowrap text-ink-3">{syncStamp}</span>}
      {waiting > 0 && (
        <button
          type="button"
          onClick={() => navigate('review')}
          aria-label={`${waiting} waiting for review`}
          className={`${syncStamp ? '' : 'ml-auto '}inline-flex h-6 items-center rounded-[12px] border border-line-strong bg-surface bg-[repeating-linear-gradient(45deg,var(--hatch-stripe)_0_1px,transparent_1px_5px)] px-2.5 text-[12px] font-semibold whitespace-nowrap`}
        >
          <span className="rounded-[3px] bg-surface px-[3px]">{waiting} waiting</span>
        </button>
      )}
    </div>
  )
}
