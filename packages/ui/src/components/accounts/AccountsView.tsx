import type { ReactNode } from 'react'

/** The Accounts page: connection strip, net worth, the owed/freshness pair, the balance sheet. */
export function AccountsView({
  needsYou,
  notice,
  netWorth,
  owe,
  dataAge,
  balanceSheet,
  disconnected,
}: {
  needsYou?: ReactNode
  /** "No net worth to show…" and the like. */
  notice?: ReactNode
  netWorth?: ReactNode
  owe?: ReactNode
  dataAge?: ReactNode
  balanceSheet?: ReactNode
  disconnected?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      {needsYou}
      {notice}
      {netWorth}
      {(owe || dataAge) && (
        <div className={`grid gap-4 ${owe && dataAge ? 'lg:grid-cols-2' : ''}`}>
          {owe}
          {dataAge}
        </div>
      )}
      {balanceSheet}
      {disconnected}
    </div>
  )
}
