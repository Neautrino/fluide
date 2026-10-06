import type { ReactNode } from 'react'
import type { Rule } from '../../types'
import { dayParts } from './model'

/** `from` is the clicked button, so the view can move focus on once its row or tile is gone. */
export type Decide = (rule: Rule, decision: 'activate' | 'reject', from: HTMLElement) => void

export const CARD = 'rounded-lg border border-line bg-surface p-4 pb-3.5 shadow-1'
export const COLUMNS = 'grid items-start gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_316px] min-[1361px]:grid-cols-[minmax(0,1fr)_352px]'

export function CardHead({ id, title, meta, children }: { id?: string; title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <h3 id={id} className="font-display text-[17px] leading-tight font-bold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      {meta && <span className="text-[12px] text-ink-3">{meta}</span>}
      {children}
    </div>
  )
}

export function DateChip({ iso }: { iso: string | null }) {
  const parts = iso ? dayParts(iso) : null
  return (
    <span
      className={`flex size-10 shrink-0 flex-col items-center justify-center rounded-md border leading-none ${
        parts ? 'border-line bg-surface-2' : 'border-dashed border-line bg-surface'
      }`}
    >
      <b className="font-display text-[15px] font-extrabold">{parts?.day ?? '–'}</b>
      <span className="mt-[3px] text-[9px] font-bold tracking-[.08em] text-ink-3 uppercase">{parts?.month ?? 'none'}</span>
    </span>
  )
}

export function UserIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-[11px]">
      <circle cx="8" cy="5.5" r="2.7" />
      <path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" />
    </svg>
  )
}

export function SparkIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="size-[11px]">
      <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z" />
    </svg>
  )
}
