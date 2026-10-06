import { Fragment, type ReactNode } from 'react'
import { allOkText, chipText, othersConnectedText, type Attention } from '../../lib/connection-health'
import { formatMoney } from '../../lib/format'
import { plural } from './model'

function Amounts({ totals }: { totals: { currency: string; total: number }[] }) {
  return (
    <>
      {totals.map((t, i) => (
        <Fragment key={t.currency}>
          <span className="whitespace-nowrap">
            <span className="amt">{formatMoney(t.total, t.currency)}</span>
            {i < totals.length - 1 && ' ·'}
          </span>{' '}
        </Fragment>
      ))}
    </>
  )
}

/** What the connections add up to; null when that check itself failed. */
export type ConnectionsSummary = { live: number; attention: Attention[]; syncStamp: string | null }

export function NeedsYouStripView({
  summary,
  suggestions,
  atStake = [],
  transferCount,
  transferTotals = [],
  failed = [],
  onSettings,
  onReview,
}: {
  summary: ConnectionsSummary | null
  /** Review-queue items waiting. */
  suggestions: number
  atStake?: { currency: string; total: number }[]
  transferCount: number
  transferTotals?: { currency: string; total: number }[]
  /** Names of the sources that could not be checked ("connections", "review queue", …). */
  failed?: string[]
  onSettings?: () => void
  onReview?: () => void
}) {
  const attention = summary?.attention ?? []
  const toSettings = () => onSettings?.()
  const others = summary ? summary.live - attention.length : 0

  if (suggestions === 0 && transferCount === 0 && attention.length === 0) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-md border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px]">
        {failed.length > 0 ? (
          <span className="text-ink-2">Couldn&apos;t check: {failed.join(', ')}</span>
        ) : (
          <span className="flex items-center gap-2 font-bold whitespace-nowrap">
            <span aria-hidden className="size-2.5 rounded-full bg-positive" />
            {summary && summary.live > 0 ? allOkText(summary.live) : 'No bank connections'}
          </span>
        )}
        {summary && (
          <span className="ml-auto flex items-center gap-3.5 text-ink-3">
            {summary.syncStamp && failed.length === 0 && <span className="text-[12px] whitespace-nowrap">{summary.syncStamp}</span>}
            <button type="button" onClick={toSettings} className="text-[12.5px] whitespace-nowrap hover:text-ink">
              Manage in Settings ›
            </button>
          </span>
        )}
      </div>
    )
  }

  const lead: ReactNode[] = []
  if (suggestions > 0) {
    lead.push(<b className="font-display font-bold">{plural(suggestions, 'suggestion')}</b>)
    if (atStake.length > 0) {
      lead.push(
        <>
          <Amounts totals={atStake} />
          <span className="whitespace-nowrap">at stake</span>
        </>,
      )
    }
  }
  if (transferCount > 0) {
    lead.push(
      <>
        <span className="whitespace-nowrap">{plural(transferCount, 'possible transfer')}</span>{' '}
        <Amounts totals={transferTotals} />
        <span className="whitespace-nowrap opacity-60">counted until you decide</span>
      </>,
    )
  }
  if (lead.length === 0) {
    lead.push(<b className="font-display font-bold">{plural(attention.length, 'connection')} need{attention.length === 1 ? 's' : ''} you</b>)
  }
  if (failed.length > 0) lead.push(<span className="opacity-60">Couldn&apos;t check: {failed.join(', ')}</span>)

  return (
    <section
      aria-label="Needs you"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-2.5 rounded-lg bg-surface-inverse py-3.5 pr-4 pl-5 text-[13px] text-ink-inverse max-[1300px]:gap-x-2 max-[1300px]:gap-y-2 max-[1300px]:pr-3 max-[1300px]:pl-3.5 max-[1300px]:text-[12.5px]"
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
      <div className="min-w-60 flex-1 basis-72 leading-[1.45]">
        {lead.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <>
                <span aria-hidden className="mx-1.5 inline-block whitespace-nowrap opacity-50 max-[1300px]:hidden [html[data-theme=dark]_&]:opacity-75">
                  {'\u00a0·'}
                </span>{' '}
              </>
            )}
            <span className="mr-1 max-[1300px]:mr-2">{part}</span>{' '}
          </Fragment>
        ))}
      </div>
      {attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {attention.map(({ connection, health }) => (
            <button
              key={connection.id}
              type="button"
              onClick={toSettings}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap max-[1300px]:px-2 max-[1300px]:text-[11.5px] ${
                health.severity === 'broken' ? 'bg-broken-wash text-broken' : 'bg-warning-wash text-warning'
              }`}
            >
              {health.severity === 'broken' && (
                <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 3 2 21h20z" />
                  <path d="M12 10v5M12 18v.5" />
                </svg>
              )}
              {chipText(connection, health)}
            </button>
          ))}
        </div>
      )}
      {summary && (attention.length === 0 || others > 0) && (
        <button type="button" onClick={toSettings} className="text-[12.5px] whitespace-nowrap opacity-60 hover:opacity-100 max-[1300px]:text-[12px]">
          {summary.live === 0 ? 'No bank connections' : attention.length > 0 ? othersConnectedText(others) : `${summary.live} connected`} ›
        </button>
      )}
      {(suggestions > 0 || transferCount > 0) && (
        <button
          type="button"
          onClick={() => onReview?.()}
          className="rounded-full border border-surface bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-ink"
        >
          Review
        </button>
      )}
    </section>
  )
}
