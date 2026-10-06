import { createContext, useContext, type ReactNode } from 'react'
import type { CashFlowFilter } from '../../types'
import { formatMoneyParts } from '../../lib/format'

/** Drill-down: `token` is a `/cashflow/transactions` filter whose total equals `amount`. */
export type Drill = { token: CashFlowFilter; label: string; amount: number }

export const DrillContext = createContext<(drill: Drill) => void>(() => {})

export function useDrill(): (drill: Drill) => void {
  return useContext(DrillContext)
}

export const LINK =
  'cursor-pointer rounded-[2px] underline decoration-ink-3 decoration-dotted decoration-[1.5px] underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink'

/** Blurred by the header's hide switch (`html.amounts-hidden .amt`); never masks text itself. */
export function Amt({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`amt ${className}`}>{children}</span>
}

export function DrillButton({
  drill,
  children,
  plain = false,
  className = '',
}: {
  drill: Drill
  children: ReactNode
  /** Row labels open the same drill-down as their figure but aren't underlined. */
  plain?: boolean
  className?: string
}) {
  const open = useDrill()
  return (
    <button
      type="button"
      onClick={() => open(drill)}
      className={`${plain ? 'cursor-pointer hover:underline hover:underline-offset-[3px]' : LINK} ${className}`}
    >
      {children}
    </button>
  )
}

/** Whole units at the surrounding size, cents smaller. Wrap in `Amt` so the hide switch blurs it. */
export function Figure({ value, currency, signed = false }: { value: number; currency: string; signed?: boolean }) {
  const { whole, fraction } = formatMoneyParts(value, currency, signed ? 'always' : 'auto')
  return (
    <span className="figures whitespace-nowrap">
      {whole}
      <small>{fraction}</small>
    </span>
  )
}

export function Card({
  title,
  sub,
  aside,
  className = '',
  children,
}: {
  title: string
  sub?: ReactNode
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface px-5 py-[18px] shadow-1 ${className}`}>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[17px] leading-[1.2] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {sub && <p className="text-[12px] text-ink-3 [&_b]:font-semibold [&_b]:text-ink">{sub}</p>}
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function Chevron() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 shrink-0 text-ink-2" aria-hidden>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
