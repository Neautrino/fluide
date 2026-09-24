import type { ReactNode } from 'react'
import type { ConfidenceBand } from '../../lib/api'
import { BAND_LABEL, formatConfidence, formatMoney, toNumber } from '../../lib/format'

/** SOURCE OF TRUTH: page headings, money figures and confidence tiers.
 * WHAT: <PageHeader> (eyebrow + serif title + lede + actions),
 * <SectionTitle>, <Money> (tabular, true minus, inflows green) and
 * <Confidence> (High/Medium/Low label with the precise value secondary).
 * WHERE: presentation only.
 */

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string
  title: string
  lede?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[40px] leading-[1.05] text-ink md:text-[48px]">{title}</h1>
        {lede && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <h2 className="text-[22px] leading-tight text-ink">{children}</h2>
      {aside && <div className="text-[13px] text-ink-3">{aside}</div>}
    </div>
  )
}

type MoneyProps = {
  amount: number | string
  currency?: string
  /** 'flow' colours inflows green and prefixes +; 'plain' is ink with a minus only. */
  tone?: 'flow' | 'plain'
  className?: string
}

export function Money({ amount, currency = 'USD', tone = 'plain', className = '' }: MoneyProps) {
  const n = toNumber(amount)
  const color = tone === 'flow' && n > 0 ? 'text-green' : ''
  return (
    <span className={`figures whitespace-nowrap ${color} ${className}`}>
      {formatMoney(n, currency, tone === 'flow' ? 'always' : 'auto')}
    </span>
  )
}

const BAND_STYLE: Record<ConfidenceBand, { dot: string; text: string }> = {
  high: { dot: 'bg-green', text: 'text-green' },
  medium: { dot: 'bg-amber', text: 'text-amber' },
  low: { dot: 'bg-red', text: 'text-red' },
}

export function Confidence({ band, value }: { band: ConfidenceBand; value: string | number | null }) {
  const style = BAND_STYLE[band]
  const precise = formatConfidence(value)
  return (
    <span className="inline-flex items-baseline gap-1.5 text-[13px]">
      <span aria-hidden className={`inline-block size-1.5 translate-y-[-1px] rounded-full ${style.dot}`} />
      <span className={`font-medium ${style.text}`}>{BAND_LABEL[band]} confidence</span>
      {precise && <span className="figures text-ink-3">{precise}</span>}
    </span>
  )
}
