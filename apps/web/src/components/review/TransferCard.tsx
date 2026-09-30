import { useState } from 'react'
import type { PossibleTransfer, TransferDecision } from '../../lib/api'
import { Button } from '../ui/Button'
import { Notice } from '../ui/States'
import type { TransferGroup } from './data'
import { dateParts, ledgerWeekday } from './helpers'
import { Amt } from './shared'

const HATCH = 'repeating-linear-gradient(135deg, var(--surface) 0 7px, var(--accent-wash) 7px 8px)'
const TOP = 3

type Props = {
  groups: TransferGroup[]
  /** Any write in flight anywhere on the page; `pendingKey` names the one this card started. */
  disabled: boolean
  pendingKey: string | null
  error: string | null
  onDecide: (row: PossibleTransfer, decision: TransferDecision) => void
}

export function TransferCard({ groups, disabled, pendingKey, error, onDecide }: Props) {
  const [all, setAll] = useState(false)
  const rows = groups.flatMap((g) => g.rows)
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, TOP)
  return (
    <section aria-label="Possible transfers" className="rounded-lg border border-line bg-surface p-4 shadow-1" style={{ backgroundImage: HATCH }}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 tabIndex={-1} data-review-heading="transfers" className="font-display text-[17px] leading-tight font-bold text-ink outline-none">
          Possible {rows.length === 1 ? 'transfer' : 'transfers'}
        </h3>
        <span className="rounded-full border border-dashed border-line-strong bg-surface px-2 py-0.5 text-[10.5px] whitespace-nowrap font-bold text-ink-2">
          Counted until you decide
        </span>
      </div>
      <p className="mt-1.5 rounded-sm bg-surface px-2 py-1.5 text-[12.5px] leading-normal text-ink-2">
        The bank tagged these as transfers but no matching leg exists. They could be money moved between your own accounts or a
        payment to someone else.
      </p>
      <ul className={`mt-3 flex flex-col gap-2.5 ${all ? 'max-h-[480px] overflow-y-auto pr-1' : ''}`}>
        {shown.map((r) => {
          const { day, month } = dateParts(r.date)
          return (
            <li key={r.transactionId} data-review-id={r.transactionId} className="rounded-md border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-surface-2 leading-none">
                    <b className="figures text-[16px] font-extrabold text-ink">{day}</b>
                    <span className="mt-0.5 text-[9.5px] font-semibold tracking-[.06em] text-ink-3 uppercase">{month}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13.5px] leading-snug font-semibold break-words text-ink">{r.description}</p>
                    <p className="truncate text-[12px] text-ink-3">
                      {ledgerWeekday(r.date)} · {r.accountName}
                    </p>
                  </div>
                </div>
                <Amt value={r.amount} currency={r.currency} className="shrink-0 font-display text-[18px] font-extrabold text-ink" />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={disabled}
                  busy={pendingKey === `transfer:${r.transactionId}:mine`}
                  onClick={() => onDecide(r, 'mine')}
                >
                  It's my account
                </Button>
                <Button
                  size="sm"
                  disabled={disabled}
                  busy={pendingKey === `transfer:${r.transactionId}:payment`}
                  onClick={() => onDecide(r, 'payment')}
                >
                  It's a payment
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {rows.length > TOP && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="mt-3 text-[13px] font-medium text-ink underline underline-offset-2"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <p className="mt-3 rounded-sm bg-surface px-2 py-1.5 text-[12px] leading-normal text-ink-3">
        "It's my account" leaves it out of Out and In. "It's a payment" keeps it counted.
      </p>
    </section>
  )
}
