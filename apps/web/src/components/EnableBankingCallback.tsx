import { useEffect, useState } from 'react'
import { useApp } from '../lib/app-context'
import { consumeEnableBankingCallback, type CallbackOutcome } from '../lib/enable-banking'
import { formatLocalDate } from '../lib/format'
import { Notice } from './ui/States'

/** Shows the result of a bank redirect back to Fluide (Enable Banking).
 * Renders nothing on a normal page load. */
export function EnableBankingCallback() {
  const { invalidate } = useApp()
  const [outcome, setOutcome] = useState<CallbackOutcome | 'working' | null>(() =>
    consumeEnableBankingCallback() ? 'working' : null,
  )

  useEffect(() => {
    const pending = consumeEnableBankingCallback()
    if (!pending) return
    let active = true
    pending.then((result) => {
      if (!active) return
      setOutcome(result)
      if (result.ok) invalidate()
    })
    return () => {
      active = false
    }
  }, [invalidate])

  if (!outcome) return null

  let notice
  if (outcome === 'working') {
    notice = <Notice>Finishing the bank connection and importing booked transactions…</Notice>
  } else if (!outcome.ok) {
    notice = <Notice tone="error">Bank connection failed: {outcome.message}</Notice>
  } else {
    const { institutionName, validUntil, ingest, bankFetch } = outcome.summary
    notice = (
      <Notice tone="success">
        Connected {institutionName}: {ingest.accountsSeen} account{ingest.accountsSeen === 1 ? '' : 's'},{' '}
        {ingest.transactionsInserted} booked transaction{ingest.transactionsInserted === 1 ? '' : 's'} imported
        {ingest.transactionsSkipped > 0 ? ` (${ingest.transactionsSkipped} already present)` : ''}. Access lasts
        until {formatLocalDate(validUntil)}.
        {bankFetch === 'background' && ' Fetched in the background: many banks allow this about 4 times a day.'}
      </Notice>
    )
  }
  return <div>{notice}</div>
}
