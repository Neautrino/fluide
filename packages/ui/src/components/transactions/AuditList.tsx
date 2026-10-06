import type { CategoryCatalogue } from '../../lib/categories'
import { bandFor, formatTimestamp, sourceLabel, toNumber } from '../../lib/format'
import type { AuditAction, AuditEntry } from '../../types'
import { Confidence } from '../ui/Typography'

const ACTION_LABEL: Record<AuditAction, string> = {
  auto_applied: 'Category applied automatically',
  queued_for_review: 'Sent to review',
  approved: 'Suggestion approved',
  rejected: 'Suggestion rejected',
  recategorized: 'Recategorized',
}

/** What has been decided about a posting's category, newest first. */
export function AuditList({ entries, catalogue }: { entries: AuditEntry[]; catalogue: CategoryCatalogue | undefined }) {
  return (
    <ol className="relative flex flex-col gap-[11px] before:absolute before:bottom-1.5 before:left-[4px] before:top-1.5 before:border-l before:border-line">
      {entries.map((e, i) => (
        <li key={e.id} className="grid grid-cols-[9px_1fr] gap-2.5 text-[12px] leading-[1.4] text-ink-2">
          <div
            aria-hidden
            className={`relative mt-[3px] size-[9px] rounded-full border bg-surface ${i === 0 ? 'border-warning bg-warning' : 'border-line-strong'}`}
          />
          <div>
            <div className="font-medium text-ink">
              <span className="font-mono text-[11.5px] font-semibold text-ink">{ACTION_LABEL[e.action] ?? e.action}</span>
              {e.categoryId && <span className="font-normal text-ink-2"> → {catalogue?.byId[e.categoryId]?.label ?? 'Unknown category'}</span>}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-3">
              {e.actor === 'human' ? 'By you' : 'By Fluide'}
              {e.source && e.actor !== 'human' ? ` · ${sourceLabel(e.source)}` : ''} · {formatTimestamp(e.createdAt)}
            </div>
            {e.confidence !== null && (
              <div className="mt-1">
                <Confidence band={bandFor(toNumber(e.confidence))} value={e.confidence} />
              </div>
            )}
            {e.reason && <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{e.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
