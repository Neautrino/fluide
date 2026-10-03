import { useNavigate } from '@tanstack/react-router'
import { useReviewCount } from '../../lib/queries'
import { Button } from '../ui/Button'

export function TrustStrip() {
  const navigate = useNavigate()
  const reviewCount = useReviewCount()
  const waiting = reviewCount ?? 0
  if (waiting === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px] shadow-1 max-[1360px]:text-[12.5px]">
      <span className="flex items-center gap-2 font-bold whitespace-nowrap">
        <span aria-hidden className="size-2.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
        {waiting} waiting in Review
      </span>
      <Button size="sm" variant="primary" className="ml-auto" onClick={() => void navigate({ to: '/review' })}>
        Review {waiting}
      </Button>
    </div>
  )
}
