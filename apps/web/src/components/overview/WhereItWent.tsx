import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { WhereItWentCard, type Fresh } from '@repo/ui/overview'
import type { CashFlow, ReviewItem } from '@repo/ui/types'
import { Pending } from './Pending'

export function WhereItWent({
  flow,
  review,
  fresh,
}: {
  flow: UseQueryResult<CashFlow>
  review: UseQueryResult<ReviewItem[]>
  fresh: Fresh | null
}) {
  const navigate = useNavigate()
  const data = flow.isError ? undefined : flow.data
  return (
    <WhereItWentCard
      flow={data}
      items={review.data ?? []}
      fresh={fresh}
      dimmed={flow.isFetching && data !== undefined}
      pending={<Pending resource={flow} what="spending" ready={data !== undefined} />}
      onDetails={() => void navigate({ to: '/cashflow' })}
      onReview={() => void navigate({ to: '/review' })}
    />
  )
}
