import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { isLive, totalsByCurrency } from '@repo/ui/accounts'
import { CashOnHandCard, countedIn, type Fresh } from '@repo/ui/overview'
import type { AccountBalance } from '@repo/ui/types'
import { Pending } from './Pending'

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
    <CashOnHandCard
      cash={cash}
      currency={currency}
      count={count}
      fresh={fresh}
      ready={balances !== undefined && currencyKnown}
      pending={<Pending resource={accounts} what="balances" ready={balances !== undefined && currencyKnown} />}
      onOpenAccounts={() => void navigate({ to: '/accounts' })}
    />
  )
}
