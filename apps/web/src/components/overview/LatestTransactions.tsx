import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LatestTransactionsCard, type Fresh, type Latest } from '@repo/ui/overview'
import { Pending } from './Pending'

export function LatestTransactions({
  latest,
  currency,
  fresh,
}: {
  latest: UseQueryResult<Latest>
  currency: string | null
  fresh: Fresh | null
}) {
  const navigate = useNavigate()
  const data = latest.isError ? undefined : latest.data

  return (
    <LatestTransactionsCard
      data={data}
      currency={currency}
      fresh={fresh}
      pending={<Pending resource={latest} what="transactions" ready={data !== undefined} />}
      onOpen={() => void navigate({ to: '/transactions' })}
    />
  )
}
