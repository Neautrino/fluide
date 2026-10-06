import type { ReactNode } from 'react'
import './cashflow.css'

/** Equal-height row of cards; `cols` is the Tailwind template for the wide breakpoint. */
export const CF_ROW = 'grid grid-cols-1 items-start gap-[18px]'
export const CF_HALVES = `${CF_ROW} lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`

export function CashFlowRow({ cols = '', children }: { cols?: string; children: ReactNode }) {
  return <div className={cols ? `${CF_ROW} ${cols}` : CF_ROW}>{children}</div>
}

/** The Cash flow page frame: the `.cashflow` scope its charts and tooltips are styled in. */
export function CashFlowView({
  trustLine,
  controls,
  busy = false,
  children,
}: {
  trustLine?: ReactNode
  controls?: ReactNode
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <div className="cashflow flex flex-col gap-5 text-[14px] leading-[1.45]" aria-busy={busy || undefined}>
      {trustLine}
      {controls}
      {children}
    </div>
  )
}
