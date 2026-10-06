import type { ConfidenceBand } from '../../types'
import { BAND_LABEL, formatConfidence, formatMoney, toNumber } from '../../lib/format'

type MoneyProps = {
  amount: number | string
  currency?: string
  /** 'flow' prefixes + on inflows (no colour; DS01); 'plain' is a minus only. */
  tone?: 'flow' | 'plain'
  className?: string
}

export function Money({ amount, currency = 'USD', tone = 'plain', className = '' }: MoneyProps) {
  const n = toNumber(amount)
  return (
    <span className={`figures amt whitespace-nowrap ${className}`}>
      {formatMoney(n, currency, tone === 'flow' ? 'always' : 'auto')}
    </span>
  )
}

const BAND_STYLE: Record<ConfidenceBand, { dot: string; text: string }> = {
  high: { dot: 'bg-positive', text: 'text-positive' },
  medium: { dot: 'bg-warning', text: 'text-warning' },
  low: { dot: 'bg-broken', text: 'text-broken' },
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
