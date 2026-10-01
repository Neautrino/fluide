import { useState, type ComponentProps, type ReactNode } from 'react'
import { HTTPS_REASON, isHttps } from '../../lib/connection-health'
import { ENABLE_BANKING_AVAILABLE } from '../../lib/enable-banking'
import { ConnectBank } from '../ConnectBank'
import { ConnectEuropeanBank } from '../ConnectEuropeanBank'
import { CardHeader } from './ui'

function Tile({
  tone,
  glyph,
  region,
  title,
  children,
  describedBy,
  ...rest
}: {
  tone: string
  glyph: string
  region: string
  title: string
  children: ReactNode
  describedBy: string
} & Omit<ComponentProps<'button'>, 'children' | 'title'>) {
  return (
    <button
      type="button"
      {...rest}
      aria-describedby={describedBy}
      className={`group flex min-h-[120px] flex-col gap-1.5 rounded-sm border border-line-strong px-3.5 py-[13px] text-left text-tile-ink shadow-[inset_0_0_0_2px_var(--tile-ring-gap,transparent)] disabled:cursor-not-allowed ${tone}`}
    >
      <span className="flex items-start justify-between group-disabled:opacity-60">
        <span aria-hidden className="font-display text-[20px] leading-none font-extrabold">
          {glyph}
        </span>
        <span className="rounded-[8px] border border-tile-ink px-[7px] py-px text-[10.5px] leading-none font-bold tracking-[0.05em] uppercase">
          {region}
        </span>
      </span>
      <b className="mt-auto text-[13.5px] font-bold group-disabled:opacity-60">{title}</b>
      <small id={describedBy} className="text-[11.5px] leading-[1.35] opacity-80 [html[data-theme=dark]_&]:opacity-100 group-disabled:opacity-100">
        {children}
      </small>
    </button>
  )
}

export function AddConnection({ onConnected }: { onConnected: () => void }) {
  const [below, setBelow] = useState<HTMLElement | null>(null)
  const httpsMissing = !isHttps()

  return (
    <section id="add-connection" aria-label="Add a connection" className="scroll-mt-6 rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      <CardHeader title="Add a connection" meta="Every connection is read-only. Nothing here can pay, send or move money." />
      <div className="mt-3 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
        <ConnectEuropeanBank
          panelIn={below}
          renderTrigger={({ onClick, triggerRef }) => (
            <Tile
              ref={triggerRef}
              tone="bg-tile-2"
              glyph="€"
              region="EU"
              title="Connect EU bank"
              describedBy="add-eu-sub"
              disabled={!ENABLE_BANKING_AVAILABLE || httpsMissing}
              onClick={onClick}
            >
              {!ENABLE_BANKING_AVAILABLE
                ? 'Not available yet'
                : httpsMissing
                  ? HTTPS_REASON
                  : "Through Enable Banking (PSD2). Read-only access that has to be renewed when the bank's consent period ends."}
            </Tile>
          )}
        />
        <ConnectBank
          onConnected={onConnected}
          showSandboxHint={false}
          extrasIn={below}
          renderTrigger={({ onClick, busy, label }) => (
            <Tile
              tone="bg-tile-3"
              glyph="$"
              region="US"
              title={busy ? label : 'Connect US bank'}
              describedBy="add-us-sub"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onClick}
            >
              Through Plaid. Balances and transactions only; sign-ins can expire and need a reconnect.
            </Tile>
          )}
        />
      </div>
      <div ref={setBelow} className="flex max-w-xl flex-col gap-2 empty:hidden [&:not(:empty)]:mt-3" />
    </section>
  )
}
