import type { ReactNode } from 'react'
import { CARD } from '../accounts/model'
import { StatusDot } from '../accounts/shared'
import type { Fresh } from './model'

export function OverviewCard({
  title,
  unit,
  aside,
  className = '',
  children,
}: {
  title: string
  unit?: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${CARD} min-w-0 px-5 py-[18px] max-[1300px]:px-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="font-display text-[17px] leading-[1.2] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {unit && <span className="text-[12px] font-medium text-ink-3">{unit}</span>}
        {aside && <div className="ml-auto flex items-center gap-3">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function Freshness({ fresh }: { fresh: Fresh | null }) {
  if (!fresh) return null
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] font-medium whitespace-nowrap text-ink-3">
      <StatusDot bad={fresh.broken} />
      {fresh.text}
    </span>
  )
}

export function CardLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[2px] text-[12.5px] font-semibold whitespace-nowrap text-ink hover:underline hover:underline-offset-[3px]">
      {children}
    </button>
  )
}
