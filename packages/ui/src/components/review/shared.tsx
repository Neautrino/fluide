import type { ReactNode } from 'react'
import { formatMoneyParts } from '../../lib/format'
import type { AtStake } from './helpers'

export function Amt({
  value,
  currency,
  sign = 'auto',
  className = '',
}: {
  value: number | string
  currency: string
  sign?: 'auto' | 'always' | 'never'
  className?: string
}) {
  const { whole, fraction } = formatMoneyParts(value, currency, sign)
  return (
    <span className={`figures amt ${className}`}>
      {whole}
      <small>{fraction}</small>
    </span>
  )
}

export function StakeAmounts({ stake, className = '' }: { stake: AtStake[]; className?: string }) {
  return (
    <>
      {stake.map((s, i) => (
        <span key={s.currency}>
          {i > 0 && ' · '}
          <Amt value={s.total} currency={s.currency} sign="never" className={className} />
        </span>
      ))}
    </>
  )
}

const RANGE_REASON = /^amount (\S+) is outside the historical range \[(\S+), (\S+)\](.*)$/s

/** Only the amount reason carries money; wrap it so "Hide amounts" blurs it. */
export function Reason({ text }: { text: string }): ReactNode {
  const m = RANGE_REASON.exec(text)
  if (!m) return text
  return (
    <>
      amount <span className="amt">{m[1]}</span> is outside the historical range [<span className="amt">{m[2]}</span>,{' '}
      <span className="amt">{m[3]}</span>]{m[4]}
    </>
  )
}
