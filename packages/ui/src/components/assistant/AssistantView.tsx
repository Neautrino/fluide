import type { ReactNode } from 'react'
import { othersConnectedText, type Severity } from '../../lib/connection-health'

/** The Assistant page: the trust line, the ask card, then the conversation panel. */
export function AssistantView({ trustLine, askCard, conversation }: { trustLine?: ReactNode; askCard?: ReactNode; conversation?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {trustLine}
      {askCard}
      {conversation}
    </div>
  )
}

const CHIP: Record<Severity, string> = {
  ok: '',
  warning: 'border-warning text-warning',
  broken: 'border-broken bg-broken-wash text-broken',
}

const DOT: Record<Severity, string> = { ok: '', warning: 'bg-warning', broken: 'bg-broken' }

export type TrustFlag = { id: string; text: string; severity: Severity }

/** What limits the answers: connections that need the user, and the queue still waiting. */
export function AssistantTrustLine({
  flags,
  others,
  syncStamp,
  waiting,
  onSettings,
  onReview,
}: {
  flags: TrustFlag[]
  /** Live connections that are fine; shown as "n others connected ›". */
  others: number
  syncStamp: string | null
  waiting: number
  onSettings?: () => void
  onReview?: () => void
}) {
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
            onClick={() => onSettings?.()}
            className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] whitespace-nowrap ${CHIP[f.severity]}`}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${DOT[f.severity]}`} />
            {f.text}
          </button>
        ))}
        {flags.length > 0 && others > 0 && (
          <button type="button" onClick={() => onSettings?.()} className="text-[12px] whitespace-nowrap text-ink-3 hover:text-ink">
            {othersConnectedText(others)} ›
          </button>
        )}
      </div>
      {syncStamp && <span className="ml-auto text-[12px] whitespace-nowrap text-ink-3">{syncStamp}</span>}
      {waiting > 0 && (
        <button
          type="button"
          onClick={() => onReview?.()}
          aria-label={`${waiting} waiting for review`}
          className={`${syncStamp ? '' : 'ml-auto '}inline-flex h-6 items-center rounded-[12px] border border-line-strong bg-surface bg-[repeating-linear-gradient(45deg,var(--hatch-stripe)_0_1px,transparent_1px_5px)] px-2.5 text-[12px] font-semibold whitespace-nowrap`}
        >
          <span className="rounded-[3px] bg-surface px-[3px]">{waiting} waiting</span>
        </button>
      )}
    </div>
  )
}
