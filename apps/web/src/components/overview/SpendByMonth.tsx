import type { UseQueryResult } from '@tanstack/react-query'
import { SpendByMonthCard, type Fresh } from '@repo/ui/overview'
import type { CashFlow, ReviewItem } from '@repo/ui/types'
import { Pending } from './Pending'

export function SpendByMonth({
  flow,
  review,
  fresh,
}: {
  flow: UseQueryResult<CashFlow>
  review: UseQueryResult<ReviewItem[]>
  fresh: Fresh | null
}) {
  const data = flow.isError ? undefined : flow.data
  return (
    <SpendByMonthCard
      flow={data}
      items={review.data ?? []}
      fresh={fresh}
      dimmed={flow.isFetching && data !== undefined}
      pending={<Pending resource={flow} what="spending" ready={data !== undefined} />}
    />
  )
}
