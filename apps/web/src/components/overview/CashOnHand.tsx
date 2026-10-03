import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { AccountBalance } from '../../lib/api'
import { isLive, totalsByCurrency } from '../accounts/model'
import { Amt } from '../accounts/shared'
import { countedIn, plural, type Fresh } from './model'
import { CardLink, Freshness, OverviewCard, Pending } from './shared'

export function CashOnHand({
  accounts,
  currency,
  currencyKnown,
  fresh,
}: {
  accounts: UseQueryResult<AccountBalance[]>
  currency: string | null
  /** False while the cash-flow response that names the currency is still pending. */
  currencyKnown: boolean
  fresh: Fresh | null
}) {
  const navigate = useNavigate()
  const balances = accounts.isError ? undefined : accounts.data
  const list = balances ?? []
  const count = currency ? countedIn(list, currency).filter((b) => b.kind === 'cash').length : 0
  const cash = currency ? (totalsByCurrency(list.filter(isLive)).find((t) => t.currency === currency)?.cash ?? 0) : 0

  return (
    <OverviewCard
      title="Cash on hand"
      unit={currency ?? undefined}
      aside={
        <>
          <Freshness fresh={fresh} />
          <CardLink onClick={() => void navigate({ to: '/accounts' })}>{count > 0 ? `${plural(count, 'account')} ›` : 'Accounts ›'}</CardLink>
        </>
      }
    >
      <Pending resource={accounts} what="balances" ready={balances !== undefined && currencyKnown} />
      {balances &&
        currencyKnown &&
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
