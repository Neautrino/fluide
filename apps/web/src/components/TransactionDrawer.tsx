import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import type { AuditAction, LedgerRow } from '../lib/api'
import { bandFor, formatLedgerDate, formatTimestamp, sourceLabel, toNumber } from '../lib/format'
import { auditLogOptions, queryError, useCategories } from '../lib/queries'
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

function TransactionDetail({ row, onClose, docked }: { row: DrawerRow; onClose: () => void; docked: boolean }) {
  const categories = useCategories()
  const postingId = row.posting.id
  const audit = useQuery(auditLogOptions(postingId))
  const auditError = postingId ? queryError(audit) : 'This row has no posting id, so its history cannot be looked up.'
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (docked) headingRef.current?.focus()
  }, [docked])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!docked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const target = e.target as HTMLElement
      if (target.closest('select, input, textarea')) return
      if (target === document.body || target.closest('aside[aria-label="Transaction"], [data-tx-list]')) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [docked])

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
    <div className="flex flex-col gap-[16px]">
      {docked && (
        <div className="flex items-start gap-[10px]">
          <div>
            <div className="text-[12px] font-medium text-ink-3">Transaction</div>
            <h3 ref={headingRef} tabIndex={-1} className="mt-[3px] font-display text-[17px] font-bold tracking-[-0.01em] outline-none">{row.merchant}</h3>
          </div>
          <button
            type="button"
            className="ml-auto inline-grid size-[34px] flex-none place-items-center rounded-full border border-line-strong text-ink hover:bg-surface-2"
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[15px]">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}

      <div>
        {!docked && <h2 className="font-display text-[20px] font-bold leading-tight text-ink">{row.merchant}</h2>}
        <div className="mt-2 font-display text-[34px] font-[800] leading-none tracking-[-0.03em] text-ink md:text-[36px]">
          <Money amount={row.posting.amount} currency={row.posting.currency} tone="flow" />
        </div>
        <div className="mt-[10px] flex flex-wrap items-center gap-x-[10px] gap-y-[6px] text-[12.5px] text-ink-2">
          <span>
            {toNumber(row.posting.amount) < 0 ? 'Out' : 'In'} · {formatLedgerDate(row.date, true)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-[12px] gap-y-[9px] border-y border-line py-[14px] text-[12.5px]">
        {facts.map(([k, v]) => (
          <div key={k} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-ink-3">{k}</dt>
            <dd className="min-w-0 text-ink">{v}</dd>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-ink-3">Posting</dt>
          <dd className="min-w-0 font-mono text-[11.5px] font-medium text-ink-2" title={postingId ?? undefined}>
            <code
              className={`block break-all rounded-sm border border-line bg-surface-2 px-[6px] py-[4px] ${
                docked ? "[html[data-theme='dark']_&]:bg-surface" : ''
              }`}
            >
              {postingId ?? '—'}
            </code>
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-bold text-ink">Recategorize</h3>
        <p className="text-[12.5px] text-ink-3">
          Your choice is recorded in the history below, saves a rule for {row.merchant}, and files its other uncategorized
          transactions too.
        </p>
        {postingId ? (
          <RecategorizeControl
            key={postingId}
            postingId={postingId}
            vendor={row.merchant}
            currentCategoryId={row.posting.categoryId}
            submitLabel="Save category"
          />
        ) : (
          <p className="text-[12.5px] text-ink-3">Unavailable — the server didn't return a posting id for this row.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2.5 font-display text-[15px] font-bold text-ink">History</h3>
        {auditError ? (
          <ErrorState
            title="Couldn't load the history"
            message={auditError}
            onRetry={postingId ? () => void audit.refetch() : undefined}
          />
        ) : !audit.data ? (
          <Loading label="Loading history" rows={2} />
        ) : audit.data.length === 0 ? (
          <Empty title="No category decisions yet">
            Nothing has categorized this posting. Run categorization or choose a category above.
          </Empty>
        ) : (
          <ol className="relative flex flex-col gap-[11px] before:absolute before:bottom-1.5 before:left-[4px] before:top-1.5 before:border-l before:border-line">
            {audit.data.map((e, i) => (
              <li key={e.id} className="grid grid-cols-[9px_1fr] gap-2.5 text-[12px] leading-[1.4] text-ink-2">
                <div
                  aria-hidden
                  className={`relative mt-[3px] size-[9px] rounded-full border bg-surface ${
                    i === 0 ? 'border-warning bg-warning' : 'border-line-strong'
                  }`}
                />
                <div>
                  <div className="font-medium text-ink">
                    <span className="font-mono text-[11.5px] font-semibold text-ink">{ACTION_LABEL[e.action] ?? e.action}</span>
                    {e.categoryId && (
                      <span className="font-normal text-ink-2"> → {categories.data?.byId[e.categoryId]?.label ?? 'Unknown category'}</span>
                    )}
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
        )}
      </section>
    </div>
  )
}

export function TransactionDrawer({ row, onClose, docked }: { row: DrawerRow; onClose: () => void; docked: boolean }) {
  if (docked) {
    return (
      <aside
        aria-label="Transaction"
        className="border-l border-line bg-surface [html[data-theme='dark']_&]:bg-surface-2"
      >
        <div className="sticky top-0 max-h-svh overflow-y-auto p-[18px_20px_24px]">
          <TransactionDetail row={row} onClose={onClose} docked />
        </div>
      </aside>
    )
  }
  return (
    <Drawer title="Transaction" onClose={onClose}>
      <TransactionDetail row={row} onClose={onClose} docked={false} />
    </Drawer>
  )
}
