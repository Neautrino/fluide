import type { ReactNode } from 'react'

const HATCH_PILL = 'repeating-linear-gradient(45deg,var(--hatch-stripe) 0 1px,transparent 1px 5px)'

/** Hatched pill: the answer counts figures that are not final yet. */
export function ProvisionalPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex min-h-6 max-w-full items-center rounded-[12px] border border-line-strong bg-surface px-2.5 py-[3px] text-[12px] leading-4 font-semibold whitespace-nowrap text-ink @max-[22rem]:whitespace-normal"
      style={{ backgroundImage: HATCH_PILL }}
    >
      <span className="rounded-[3px] bg-surface px-[3px]">{children}</span>
    </span>
  )
}

/** How fresh the banks behind an answer are; amber when one of them is not reporting. */
export function Fresh({ warn = false, children }: { warn?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-[5px] text-[11.5px] text-ink-3">
      <span aria-hidden className={`size-1.5 flex-none rounded-full ${warn ? 'bg-warning' : 'bg-positive'}`} />
      <span className="truncate">{children}</span>
    </span>
  )
}
