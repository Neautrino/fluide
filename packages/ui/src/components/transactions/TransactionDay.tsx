import type { ReactNode } from 'react'
import type { DayGroup } from './groupByDay'

/** Date chip, weekday label and an optional row count; `children` sits at the right end. */
export function DayHeading({
  group,
  count,
  children,
}: {
  group: Pick<DayGroup<unknown>, 'label' | 'isToday' | 'dayNum' | 'monthShort'>
  count?: number
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-[10px] p-[12px_14px_6px]">
      <div className={`flex size-[40px] shrink-0 flex-col items-center justify-center rounded-md border leading-none ${group.isToday ? 'border-surface-inverse bg-surface-inverse text-ink-inverse' : 'border-line bg-surface-2'}`}>
        <b className="font-display text-[15px] font-[800]">{group.dayNum}</b>
        <span className={`mt-[3px] text-[9px] font-bold uppercase tracking-[0.08em] ${group.isToday ? 'text-ink-inverse opacity-70' : 'text-ink-3'}`}>{group.monthShort}</span>
      </div>
      <div className="text-[12px] font-bold text-ink-2">
        {group.label}
        {count !== undefined && <> <span className="font-medium text-ink-3">· {count} row{count !== 1 ? 's' : ''}</span></>}
      </div>
      {children}
    </div>
  )
}
