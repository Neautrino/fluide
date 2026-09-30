import { useApp } from '../../lib/app-context'
import { Button } from '../ui/Button'
import { plural } from './model'

export function TrustStrip({ proposed }: { proposed: number }) {
  const { navigate, reviewCount } = useApp()
  const waiting = reviewCount ?? 0
  if (proposed === 0 && waiting === 0) return null

  const parts = [
    proposed > 0 && `${proposed} ${plural(proposed, 'rule')} proposed`,
    waiting > 0 && `${waiting} waiting in Review`,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-line bg-surface py-2.5 pr-3 pl-3.5 text-[13px] shadow-1 max-[1360px]:text-[12.5px]">
      <span className="flex items-center gap-2 font-bold whitespace-nowrap">
        <span aria-hidden className="size-2.5 rounded-full bg-warning shadow-[0_0_0_3px_var(--warning-wash)]" />
        {parts.join(' · ')}
      </span>
      {waiting > 0 && (
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => navigate('review')}>
          Review {waiting}
        </Button>
      )}
    </div>
  )
}
