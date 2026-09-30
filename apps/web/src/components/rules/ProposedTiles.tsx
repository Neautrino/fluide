import type { Rule } from '../../lib/api'
import type { CategoryCatalogue } from '../../lib/categories'
import { formatConfidence, toNumber } from '../../lib/format'
import { Spinner } from '../ui/Button'
import { categoryLabel, dayMonth, plural, tileClass } from './model'
import { ArrowIcon, CardHead, type Decide } from './shared'

type Props = {
  proposed: Rule[]
  catalogue: CategoryCatalogue | undefined
  acting: ReadonlySet<string>
  onDecide: Decide
}

const ACTION = 'inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[15px] border border-tile-ink px-[13px] text-[12px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-50'

export function ProposedTiles({ proposed, catalogue, acting, onDecide }: Props) {
  return (
    <section aria-labelledby="rules-proposed-title">
      <CardHead
        id="rules-proposed-title"
        title="Proposed from your approvals"
        meta={
          proposed.length > 0
            ? `${proposed.length} ${plural(proposed.length, 'rule')} · nothing changes until you activate`
            : 'None left. Fluide proposes one when you approve a suggestion or categorize a transaction yourself.'
        }
      />
      {proposed.length > 0 && (
        <div id="rules-tiles" className="grid gap-3 min-[1200px]:grid-cols-2">
          {proposed.map((r) => {
            const label = categoryLabel(catalogue, r.categoryId)
            const conf = formatConfidence(r.confidenceLearned)
            const busy = acting.has(r.id)
            return (
              <article
                key={r.id}
                className={`flex min-w-0 flex-col gap-2.5 rounded-md border border-line-strong p-3.5 text-tile-ink [html[data-theme=dark]_&]:shadow-[inset_0_0_0_2px_var(--tile-ring-gap)] ${tileClass(catalogue, r.categoryId)}`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[.05em] uppercase">
                  <span>Learned {dayMonth(r.createdAt)}</span>
                  <span className="rounded-full border border-dashed border-tile-ink px-2 py-0.5 text-[10.5px] tracking-[.02em] normal-case">not active</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1.5">
                  <code className="min-w-0 rounded-sm border border-tile-ink bg-[color-mix(in_srgb,var(--tile-ink)_6%,transparent)] px-2 py-[3px] font-mono text-[14px] font-semibold break-all">
                    {r.pattern}
                  </code>
                  <ArrowIcon />
                  <span className="font-display text-[19px] font-extrabold tracking-[-0.02em]">{label}</span>
                </div>
                <p className="text-[12px] leading-normal opacity-[.86]">
                  Learned from your categorizing “{r.pattern}” as {label}. It does nothing until you activate it.
                </p>
                {conf && (
                  <div className="flex items-center gap-2.5" role="img" aria-label={`Learned confidence ${conf}`}>
                    <div className="relative h-2.5 flex-1 rounded-full border border-tile-ink bg-[color-mix(in_srgb,var(--tile-ink)_6%,transparent)]">
                      <div
                        className="absolute inset-y-[-1px] left-0 rounded-full bg-tile-ink"
                        style={{ width: `${Math.min(100, Math.max(0, toNumber(r.confidenceLearned ?? 0) * 100))}%` }}
                      />
                    </div>
                    <span className="figures text-[10.5px] font-bold whitespace-nowrap">{conf} learned</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onClick={(e) => onDecide(r, 'activate', e.currentTarget)}
                    className={`${ACTION} bg-tile-ink text-tile-3`}
                  >
                    {busy && <Spinner />}
                    Activate
                  </button>
                  <button type="button" disabled={busy} onClick={(e) => onDecide(r, 'reject', e.currentTarget)} className={`${ACTION} bg-transparent text-tile-ink`}>
                    Reject
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
