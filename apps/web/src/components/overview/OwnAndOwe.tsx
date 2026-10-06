import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { accountHealth, creditUsage, isLive, totalsByCurrency } from '@repo/ui/accounts'
import { shortName } from '@repo/ui/connection-health'
import { countedIn, oldestOf, OwnAndOweCard } from '@repo/ui/overview'
import type { AccountBalance, ConnectionSummary } from '@repo/ui/types'
import { Pending } from './Pending'

export function OwnAndOwe({
  accounts,
  connections,
  currency,
  currencyKnown,
  now,
}: {
  accounts: UseQueryResult<AccountBalance[]>
  connections: UseQueryResult<ConnectionSummary[]>
  currency: string | null
  /** False while the cash-flow response that names the currency is still pending. */
  currencyKnown: boolean
  now: number
}) {
  const navigate = useNavigate()
  const balances = accounts.isError ? undefined : accounts.data
  const list = balances ?? []
  const all = totalsByCurrency(list.filter(isLive))
  const totals = all.find((t) => t.currency === currency)
  const counted = currency ? countedIn(list, currency) : []
  const count = (kind: AccountBalance['kind']) => counted.filter((b) => b.kind === kind).length
  const counts = { cash: count('cash'), investment: count('investment'), credit: count('credit'), loan: count('loan'), other: 0 }
  counts.other = counted.length - counts.cash - counts.investment - counts.credit - counts.loan
  const held = all
    .filter((t) => t.currency !== currency)
    .map((t) => {
      const inCurrency = countedIn(list, t.currency)
      return {
        currency: t.currency,
        net: t.net,
        banks: [...new Set(inCurrency.map((b) => shortName(b.institutionName ?? 'Bank')))].join(', '),
        stale: inCurrency.some((b) => accountHealth(b, connections.data ?? [], now).severity === 'broken'),
      }
    })

  return (
    <OwnAndOweCard
      currency={currency}
      totals={totals}
      counts={counts}
      usage={creditUsage(counted)}
      oldestInput={oldestOf(counted.map((b) => b.bankBalanceAt ?? b.lastSyncedAt))}
      held={held}
      ready={balances !== undefined && currencyKnown}
      pending={<Pending resource={accounts} what="balances" ready={balances !== undefined && currencyKnown} />}
      onOpenAccounts={() => void navigate({ to: '/accounts' })}
    />
  )
}
