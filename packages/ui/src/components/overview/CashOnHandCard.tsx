import type { ReactNode } from 'react'
import { Amt } from '../accounts/shared'
import { plural, type Fresh } from './model'
import { CardLink, Freshness, OverviewCard } from './shared'

export function CashOnHandCard({
  cash,
  currency,
  count,
  fresh,
  ready = true,
  pending,
  onOpenAccounts,
}: {
  cash: number
  /** null = nothing counted in the display currency yet. */
  currency: string | null
  /** Counted cash accounts in `currency`. */
  count: number
  fresh: Fresh | null
  /** False while the sources behind the figure are still loading or failed; `pending` then stands in for the body. */
  ready?: boolean
  pending?: ReactNode
  onOpenAccounts?: () => void
}) {
  return (
    <OverviewCard
      title="Cash on hand"
      unit={currency ?? undefined}
      aside={
        <>
          <Freshness fresh={fresh} />
          <CardLink onClick={() => onOpenAccounts?.()}>{count > 0 ? `${plural(count, 'account')} ›` : 'Accounts ›'}</CardLink>
        </>
      }
    >
      {pending}
      {ready &&
        (!currency ? (
          <p className="mt-2 text-[13px] text-ink-3">No counted balances.</p>
        ) : count === 0 ? (
          <p className="mt-2 text-[13px] text-ink-3">No cash accounts in {currency}.</p>
        ) : (
          <div className="mt-1.5 font-display text-[44px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink">
            <Amt value={cash} currency={currency} />
          </div>
        ))}
    </OverviewCard>
  )
}
