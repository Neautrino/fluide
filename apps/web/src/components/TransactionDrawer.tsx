import type { ReactNode } from 'react'
import { getJson, type AuditAction, type AuditEntry, type LedgerRow } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories } from '../lib/categories'
import { bandFor, formatLedgerDate, formatTimestamp, sourceLabel, toNumber } from '../lib/format'
import { useResource } from '../lib/useResource'
import { RecategorizeControl } from './RecategorizeControl'
import { Drawer } from './ui/Drawer'
import { Empty, ErrorState, Loading } from './ui/States'
import { Confidence, Money } from './ui/Typography'

export type DrawerRow = LedgerRow & { accountName: string; merchant: string }

const ACTION_LABEL: Record<AuditAction, string> = {
  auto_applied: 'Category applied automatically',
  queued_for_review: 'Sent to review',
  approved: 'Suggestion approved',
  rejected: 'Suggestion rejected',
  recategorized: 'Recategorized',
}

export function TransactionDrawer({ row, onClose }: { row: DrawerRow; onClose: () => void }) {
  const { version } = useApp()
  const categories = useCategories()
  const postingId = row.posting.id
  const audit = useResource(
    (signal) =>
      postingId
        ? getJson<{ entries: AuditEntry[] }>(`/api/ledger/audit-log/${postingId}`, signal).then((r) => r.entries)
        : Promise.reject(new Error('This row has no posting id, so its history cannot be looked up.')),
    `${postingId}:${version}`,
  )

  const categoryLabel = row.category?.label ?? null
  const facts: [string, ReactNode][] = [
    ['Date', formatLedgerDate(row.date, true)],
    ['Account', row.accountName],
    ['Status', row.status === 'pending' ? 'Pending' : 'Cleared'],
    ['Category', categoryLabel ?? <span key="none" className="text-ink-3 italic">Uncategorized</span>],
  ]
  if (row.description && row.description !== row.merchant) facts.push(['Bank description', row.description])
  facts.push(['Currency', row.posting.currency])

  return (
    <Drawer title="Transaction" onClose={onClose}>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-[28px] leading-tight text-ink">{row.merchant}</h2>
          <p className="mt-2 font-display text-[40px] leading-none">
            <Money amount={row.posting.amount} currency={row.posting.currency} tone="flow" />
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            {toNumber(row.posting.amount) < 0 ? 'Money out' : 'Money in'} · {formatLedgerDate(row.date, true)}
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t border-rule text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="col-span-2 grid grid-cols-subgrid border-b border-rule py-2.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
          <div className="col-span-2 grid grid-cols-subgrid border-b border-rule py-2.5">
            <dt className="text-ink-3">Posting</dt>
            <dd className="truncate text-right font-mono text-[12px] text-ink-3" title={postingId}>
              {postingId ?? '—'}
            </dd>
          </div>
        </dl>

        <section>
          <h3 className="mb-1 text-[20px] text-ink">Recategorize</h3>
          <p className="mb-3 text-[13px] text-ink-3">
            Your choice is recorded in the history below and may propose a rule for similar transactions.
          </p>
          {postingId ? (
            <RecategorizeControl
              key={postingId}
              postingId={postingId}
              currentCategoryId={row.posting.categoryId}
              submitLabel="Save category"
            />
          ) : (
            <p className="text-[13px] text-ink-3">Unavailable — the server didn't return a posting id for this row.</p>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-[20px] text-ink">History</h3>
          {audit.error ? (
            <ErrorState title="Couldn't load the history" message={audit.error} onRetry={postingId ? audit.reload : undefined} />
          ) : !audit.data ? (
            <Loading label="Loading history" rows={2} />
          ) : audit.data.length === 0 ? (
            <Empty title="No category decisions yet">
              Nothing has categorized this posting. Run categorization or choose a category above.
            </Empty>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l border-rule-strong pl-5">
              {audit.data.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute top-[7px] -left-[25.5px] size-2.5 rounded-full ring-4 ring-paper-raised ${
                      e.actor === 'human' ? 'bg-ink' : 'bg-green'
                    }`}
                  />
                  <p className="text-[14px] font-medium text-ink">
                    {ACTION_LABEL[e.action] ?? e.action}
                    {e.categoryId && (
                      <span className="font-normal text-ink-2"> → {categories.data?.byId[e.categoryId]?.label ?? 'Unknown category'}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {e.actor === 'human' ? 'By you' : 'By Fluide'}
                    {e.source && e.actor !== 'human' ? ` · ${sourceLabel(e.source)}` : ''} · {formatTimestamp(e.createdAt)}
                  </p>
                  {e.confidence !== null && (
                    <p className="mt-1">
                      <Confidence band={bandFor(toNumber(e.confidence))} value={e.confidence} />
                    </p>
                  )}
                  {e.reason && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{e.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  )
}
