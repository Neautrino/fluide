import { useEffect, useId, useRef, useState } from 'react'
import type { ReviewItem } from '../../lib/api'
import type { CategoryCatalogue } from '../../lib/categories'
import { sourceLabel } from '../../lib/format'
import { CategorySelect } from '../CategorySelect'
import { Button } from '../ui/Button'
import { ConfidenceMeter } from './ConfidenceMeter'
import { dateParts, itemAmount, itemName, ledgerWeekday } from './helpers'
import { Amt, Reason } from './shared'

type Props = {
  item: ReviewItem
  catalogue: CategoryCatalogue | undefined
  catalogueFailed: boolean
  threshold: number | null
  account: string | undefined
  /** Waiting items with this counterparty, case-insensitive, this one included. */
  sameVendor: number
  /** A write is in flight somewhere on the page: every action is off. */
  disabled: boolean
  pendingKind: 'approve' | 'reject' | 'file' | null
  onApprove: () => void
  onReject: () => void
  onFile: (categoryId: string) => void
}

export function QueueCard({ item, catalogue, catalogueFailed, threshold, account, sameVendor, disabled, pendingKind, onApprove, onReject, onFile }: Props) {
  const selectId = useId()
  const hasSuggestion = !!item.suggestedCategoryId
  const [picking, setPicking] = useState(!hasSuggestion)
  const [choice, setChoice] = useState('')
  const opened = useRef(false)

  useEffect(() => {
    if (picking && opened.current) document.getElementById(selectId)?.focus()
  }, [picking, selectId])

  const name = itemName(item)
  const raw = item.posting?.description
  const amount = itemAmount(item)
  const suggested = item.suggestedCategoryId ? catalogue?.byId[item.suggestedCategoryId]?.label : undefined
  const parts = item.posting ? dateParts(item.posting.date) : null
  const counterparty = item.posting?.counterpartyRaw

  let aff: string | null = null
  if (hasSuggestion && counterparty) {
    const where = `under ${suggested ?? 'this category'} and saves a rule`
    aff = sameVendor > 1 ? `Approving files all ${sameVendor} from ${counterparty} ${where}` : `Approving files it ${where}`
  }

  return (
    <article data-review-id={item.id} className="rounded-lg border border-line bg-surface px-[18px] pt-4 pb-3.5 shadow-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {parts && (
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-surface-2 leading-none">
              <b className="figures text-[16px] font-extrabold text-ink">{parts.day}</b>
              <span className="mt-0.5 text-[9.5px] font-semibold tracking-[.06em] text-ink-3 uppercase">{parts.month}</span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-display text-[16px] font-bold tracking-[-.01em] text-ink">{name}</h3>
            {item.posting && (
              <p className="truncate text-[12px] text-ink-3">
                {ledgerWeekday(item.posting.date)}
                {account && ` · ${account}`}
              </p>
            )}
            {raw && raw !== name && (
              <span className="mt-1.5 inline-block max-w-full truncate rounded-sm border border-line bg-surface-2 px-2 py-1 font-mono text-[11.5px] font-medium text-ink-2">
                <span className="text-ink-3">bank text</span>{' '}
                {raw}
              </span>
            )}
          </div>
        </div>
        {item.posting && (
          <div className="shrink-0 text-right">
            <Amt
              value={amount}
              currency={item.posting.currency}
              sign="always"
              className={`block font-display text-[20px] leading-tight font-extrabold ${amount > 0 ? 'text-positive' : 'text-ink'}`}
            />
            <span className="text-[11px] text-ink-3">{amount < 0 ? 'out' : 'in'}</span>
          </div>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
        <span className="text-[11px] font-semibold tracking-[.07em] text-ink-3 uppercase">Suggests</span>
        {hasSuggestion ? (
          <span className="inline-flex h-7 items-center rounded-full border border-dashed border-line-strong bg-warning-wash px-3 text-[13px] font-bold text-ink">
            {suggested ?? (catalogue || catalogueFailed ? 'Unknown category' : '…')}
          </span>
        ) : (
          <>
            <span className="inline-flex h-7 items-center rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-3">
              No suggestion
            </span>
            <span className="text-[12.5px] text-ink-2">Choose the category yourself</span>
          </>
        )}
        <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{sourceLabel(item.source)}</span>
        <ConfidenceMeter value={Number(item.confidence)} threshold={threshold} />
      </div>

      {item.reason && (
        <p className="mt-1 text-[12.5px] leading-normal text-ink-2">
          <b className="font-semibold text-ink">Why:</b> <Reason text={item.reason} />
        </p>
      )}

      {picking && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (choice) onFile(choice)
          }}
        >
          <label htmlFor={selectId} className="sr-only">
            Category
          </label>
          <CategorySelect
            id={selectId}
            className="min-w-48 flex-1 sm:max-w-72"
            catalogue={catalogue}
            value={choice}
            disabled={disabled}
            onChange={(e) => setChoice(e.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" disabled={!choice || disabled} busy={pendingKind === 'file'}>
            {hasSuggestion ? 'File under this category' : 'Apply category'}
          </Button>
          {hasSuggestion && (
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setPicking(false)}>
              Cancel
            </Button>
          )}
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasSuggestion ? (
          <>
            <Button variant="primary" size="sm" disabled={disabled} busy={pendingKind === 'approve'} onClick={onApprove}>
              Approve
            </Button>
            <Button size="sm" disabled={disabled} aria-expanded={picking} onClick={() => {
                opened.current = true
                setPicking((v) => !v)
              }}>
              Change category
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled} busy={pendingKind === 'reject'} onClick={onReject}>
              Reject
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" disabled={disabled} busy={pendingKind === 'reject'} onClick={onReject}>
            Dismiss without a category
          </Button>
        )}
        {aff && <span className="ml-auto text-[11.5px] text-ink-3">{aff}</span>}
      </div>
    </article>
  )
}
