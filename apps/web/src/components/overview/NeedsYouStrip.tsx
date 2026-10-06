import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { summarizeConnections } from '@repo/ui/connection-health'
import { NeedsYouStripView } from '@repo/ui/overview'
import { atStakeByCurrency } from '@repo/ui/review'
import type { ConnectionSummary, ReviewItem, TransferGroup } from '@repo/ui/types'

const settled = (r: UseQueryResult<unknown>) => r.data !== undefined || r.isError

export function NeedsYouStrip({
  connections,
  review,
  transfers,
  now,
}: {
  connections: UseQueryResult<ConnectionSummary[]>
  review: UseQueryResult<ReviewItem[]>
  transfers: UseQueryResult<TransferGroup[]>
  now: number
}) {
  const navigate = useNavigate()
  if (![connections, review, transfers].every(settled)) return null

  const summary = !connections.isError && connections.data ? summarizeConnections(connections.data, now) : null
  const items = review.isError ? [] : (review.data ?? [])
  const groups = transfers.isError ? [] : (transfers.data ?? [])
  const failed = [
    connections.isError ? 'connections' : null,
    review.isError ? 'review queue' : null,
    transfers.isError ? 'possible transfers' : null,
  ].filter((name) => name !== null)

  return (
    <NeedsYouStripView
      summary={summary && { live: summary.live.length, attention: summary.attention, syncStamp: summary.syncStamp }}
      suggestions={items.length}
      atStake={atStakeByCurrency(items)}
      transferCount={groups.reduce((n, g) => n + g.rows.length, 0)}
      transferTotals={groups.map((g) => ({ currency: g.currency, total: g.rows.reduce((sum, r) => sum + Math.abs(r.amount), 0) }))}
      failed={failed}
      onSettings={() => void navigate({ to: '/settings' })}
      onReview={() => void navigate({ to: '/review' })}
    />
  )
}
