import type { AccountBalance } from '../../types'
import { formatMoneyParts } from '../../lib/format'
import { balanceText } from './model'

export function MismatchNote({ account: b, sep = ' · ' }: { account: AccountBalance; sep?: string }) {
  return (
    <>
      Bank reports <span className="amt">{balanceText(b, b.bankBalance ?? 0)}</span>
      {sep}ledger shows <span className="amt">{balanceText(b, b.ledgerBalance)}</span>
    </>
  )
}

/** A money figure with the cents set smaller; the sign comes from the amount. */
export function Amt({ value, currency, sign = 'auto', className = '' }: { value: number; currency: string; sign?: 'auto' | 'always'; className?: string }) {
  const { whole, fraction } = formatMoneyParts(value, currency, sign)
  return (
    <span className={`figures amt ${className}`}>
      {whole}
      <small>{fraction}</small>
    </span>
  )
}

export function StatusDot({ bad = false, className = '' }: { bad?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${bad ? 'size-2 rotate-45 rounded-[2px] bg-broken' : 'size-[9px] rounded-full bg-positive'} ${className}`}
    />
  )
}
