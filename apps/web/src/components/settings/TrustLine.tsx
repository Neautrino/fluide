import type { ConnectionSummary } from '../../lib/api'
import { allOkText, chipText, othersConnectedText, summarizeConnections } from '@repo/ui/connection-health'
import { scrollToSection } from './scroll'
import { plural } from './time'
import { Stamp } from './ui'

export function TrustLine({ connections, now }: { connections: ConnectionSummary[]; now: number }) {
  const { live, attention, ok, syncStamp } = summarizeConnections(connections, now)
  if (live.length === 0) return null
  const need = attention.length

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px]"
    >
      <span className="flex items-center gap-2 font-bold">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${need ? 'bg-warning shadow-[0_0_0_3px_var(--warning-wash)]' : 'bg-positive shadow-[0_0_0_3px_var(--positive-wash)]'}`}
        />
        {need > 0
          ? `${plural(need, 'connection')} ${need === 1 ? 'needs' : 'need'} you`
          : allOkText(live.length)}
      </span>
      {need > 0 && (
        <>
          <span aria-hidden className="h-[18px] w-px bg-line" />
          <ul className="flex flex-wrap gap-1.5">
            {attention.map(({ connection: c, health }) => (
              <li
                key={c.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] whitespace-nowrap ${
                  health.severity === 'broken' ? 'border-broken bg-broken-wash text-broken' : 'border-warning bg-surface text-warning'
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 ${health.severity === 'broken' ? 'rotate-45 rounded-[1px] bg-broken' : 'rounded-full bg-warning'}`}
                />
                {chipText(c, health)}
              </li>
            ))}
          </ul>
        </>
      )}
      {need > 0 && ok > 0 && (
        <a
          href="#connections"
          onClick={(e) => {
            e.preventDefault()
            scrollToSection('connections')
          }}
          className="text-[12px] whitespace-nowrap text-ink-3 hover:text-ink"
        >
          {othersConnectedText(ok)} ›
        </a>
      )}
      {syncStamp && (
        <span className="ml-auto">
          <Stamp>{syncStamp}</Stamp>
        </span>
      )}
    </div>
  )
}
