import { useNavigate } from '@tanstack/react-router'
import { CashFlowTrustLine } from '@repo/ui/cashflow'
import type { Attention } from '@repo/ui/connection-health'
import type { CashFlow } from '../../lib/api'
import { useReviewCount } from '../../lib/queries'

type Props = { data: CashFlow; attention: Attention[]; connected: number; syncStamp: string | null }

export function TrustLine({ data, attention, connected, syncStamp }: Props) {
  const navigate = useNavigate()
  const reviewCount = useReviewCount()

  return (
    <CashFlowTrustLine
      data={data}
      attention={attention}
      connected={connected}
      syncStamp={syncStamp}
      reviewCount={reviewCount}
      onSettings={() => void navigate({ to: '/settings' })}
      onReview={() => void navigate({ to: '/review' })}
    />
  )
}
