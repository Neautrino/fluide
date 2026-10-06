import type { ReactNode, Ref } from 'react'

/** The Review page: hero, trust line, the queue column and the at-stake/transfers aside. */
export function ReviewView({
  hero,
  trustLine,
  aside,
  wrapRef,
  children,
}: {
  hero?: ReactNode
  trustLine?: ReactNode
  aside?: ReactNode
  /** Focus parks here while a write is in flight. */
  wrapRef?: Ref<HTMLDivElement>
  children?: ReactNode
}) {
  return (
    <div ref={wrapRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
      {hero}
      {trustLine}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-x-[26px]">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="flex min-w-0 flex-col gap-4">{aside}</aside>
      </div>
    </div>
  )
}
