import type { KeyboardEvent } from 'react'
import { formatMoneyParts, toNumber } from '../../lib/format'
import type { LedgerRow } from '../../types'

const TILES = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']

/** A ledger row with the display fields the list needs resolved. */
export type LedgerListRow = LedgerRow & { accountName: string; merchant: string; key: string }

type Props = {
  row: LedgerListRow
  onClick: () => void
  selected?: boolean
  mainCurrency?: string
}

export function TransactionRow({ row, onClick, selected, mainCurrency }: Props) {
  const amount = toNumber(row.posting.amount)
  const { whole, fraction } = formatMoneyParts(amount, row.posting.currency, 'never')

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  let hash = 0
  for (let i = 0; i < row.merchant.length; i++) hash = row.merchant.charCodeAt(i) + ((hash << 5) - hash)
  const tile = TILES[Math.abs(hash) % TILES.length]
  const uncounted = !row.countsTowardTotals
  const initial = (row.merchant.match(/\p{L}/u)?.[0] ?? row.merchant.slice(0, 1)).toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      data-row-key={row.key}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[8px] gap-y-[6px] border-t border-line p-[10px_14px] hover:bg-surface-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1.3fr)_108px] min-[1360px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_124px] min-[1360px]:gap-x-[12px] ${
        selected ? 'bg-surface-2 outline outline-1 -outline-offset-1 outline-line-strong' : ''
      } ${uncounted ? 'opacity-60' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-[11px]">
        <span className={`grid size-[32px] flex-none place-items-center rounded-full border border-line-strong ${tile} font-display text-[12px] font-bold text-tile-ink`}>
          {initial}
        </span>
        <div className="min-w-0">
          <b className="flex items-center gap-[6px] text-[13.5px] font-bold leading-[1.35] text-ink">
            <span className="truncate">{row.merchant}</span>
            {row.status === 'pending' && (
              <span className="flex-none rounded-full border border-line-strong px-[7px] py-[1px] text-[10.5px] font-semibold text-ink-2">pending</span>
            )}
          </b>
          <small className="block truncate whitespace-nowrap text-[11.5px] leading-[1.35] text-ink-3">
            {row.accountName}
            {uncounted && ' · not counted · replaced login'}
          </small>
        </div>
      </div>
      <div className="order-last col-span-2 min-w-0 pl-[43px] text-[12.5px] text-ink sm:order-none sm:col-span-1 sm:pl-0">
        {row.category?.label ? (
          <b className="font-semibold">{row.category.label}</b>
        ) : (
          <span className="font-semibold text-ink-3">Uncategorized</span>
        )}
      </div>
      <div className="whitespace-nowrap text-right font-display text-[15px] font-bold text-ink">
        {amount < 0 && <span>{'\u2212'}</span>}
        {amount > 0 && <span>+</span>}
        <span className="amt">
          {whole}
          {fraction && <small className="font-bold">{fraction}</small>}
        </span>
        {mainCurrency && row.posting.currency !== mainCurrency && (
          <div className="mt-[2px] block font-sans text-[10.5px] font-medium text-ink-3">
            {row.posting.currency} · not converted
          </div>
        )}
      </div>
    </div>
  )
}
