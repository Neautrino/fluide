import { allOkText, chipText, othersConnectedText, type Attention } from '../../lib/connection-health'
import { formatMoney } from '../../lib/format'
import type { CashFlow } from '../../types'
import { Button } from '../ui/Button'
import { Amt } from './primitives'

const CHIP = {
  broken: { box: 'border-broken bg-broken-wash text-broken', dot: 'bg-broken' },
  warning: { box: 'border-warning bg-surface text-warning', dot: 'bg-warning' },
}

/** The Not counted card owns `#not-counted`; without it on the page this is a no-op. */
function showPossibleTransfers() {
  const el = document.getElementById('not-counted')
  if (!el) return
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

type Props = {
  data: CashFlow
  attention: Attention[]
  connected: number
  syncStamp: string | null
  /** Items waiting for review; null while unknown, and the button stays away. */
  reviewCount: number | null
  onSettings?: () => void
  onReview?: () => void
}

export function CashFlowTrustLine({ data, attention, connected, syncStamp, reviewCount, onSettings, onReview }: Props) {
  const others = connected - attention.length
  const { count, total } = data.possibleTransfers

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px] shadow-1">
      <span className="flex items-center gap-2 font-bold whitespace-nowrap text-ink">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${attention.length > 0 ? 'bg-warning shadow-[0_0_0_3px_var(--warning-wash)]' : 'bg-positive shadow-[0_0_0_3px_var(--positive-wash)]'}`}
        />
        {attention.length > 0 ? 'Needs you' : connected === 0 ? 'No bank connections' : allOkText(connected)}
      </span>
      <span aria-hidden className="h-[18px] w-px bg-line" />
      <span className="text-ink-2">{syncStamp ?? 'Not synced yet'}</span>
      {count > 0 && (
        <button type="button" onClick={showPossibleTransfers} className="text-left text-ink-2 hover:text-ink">
          {count} possible {count === 1 ? 'transfer' : 'transfers'} (<Amt>{formatMoney(total, data.currency)}</Amt>) count until you check them ›
        </button>
      )}
      {attention.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {attention.map(({ connection, health: h }) => {
            const tone = h.severity === 'broken' ? CHIP.broken : CHIP.warning
            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => onSettings?.()}
                className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-[11.5px] whitespace-nowrap ${tone.box}`}
              >
                <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
                {chipText(connection, h)}
              </button>
            )
          })}
        </span>
      )}
      {attention.length > 0 && others > 0 && (
        <button type="button" onClick={() => onSettings?.()} className="text-[12px] text-ink-3 hover:text-ink">
          {othersConnectedText(others)} ›
        </button>
      )}
      {reviewCount !== null && reviewCount > 0 && (
        <Button variant="primary" size="sm" onClick={() => onReview?.()} className="ml-auto">
          Review {reviewCount}
        </Button>
      )}
    </div>
  )
}
