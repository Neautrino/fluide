import { useState } from 'react'
import { decideTransfer, errorMessage, type PossibleTransfer, type TransferDecision } from '../lib/api'
import { useApp } from '../lib/app-context'
import { formatLedgerDate, formatMoney } from '../lib/format'
import { useResource } from '../lib/useResource'
import { Button } from './ui/Button'
import { ErrorState, Loading } from './ui/States'
import { Money } from './ui/Typography'

type Props = {
  currency: string
  count: number
  total: number
  /** Lists the rows behind `count`; refetched when `loadKey` or the app version changes. */
  load: (signal: AbortSignal) => Promise<PossibleTransfer[]>
  loadKey: string
}

/**
 * Bank-tagged transfers with no matching leg. The tag also covers payments to other people
 * (Zelle, Venmo, ATM cash), so they stay counted until the user says which they are.
 */
export function PossibleTransfers({ currency, count, total, load, loadKey }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pt-2">
      <div className="figures flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <p>
          Possible transfers: <span className="amt">{formatMoney(total, currency)}</span> ({count}) — counted until you check them
        </p>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={open ? 'possible-transfers' : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide' : 'Check'}
        </Button>
      </div>
      {open && <PossibleTransferList id="possible-transfers" load={load} loadKey={loadKey} />}
    </div>
  )
}

function PossibleTransferList({ id, load, loadKey }: { id: string; load: Props['load']; loadKey: string }) {
  const { version, invalidate } = useApp()
  const list = useResource(load, `${loadKey}:${version}`)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  // Decided rows hide at once instead of lingering until the refetch lands.
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const decide = async (row: PossibleTransfer, decision: TransferDecision) => {
    const txId = row.transactionId
    setPending((s) => new Set(s).add(txId))
    setError(null)
    try {
      await decideTransfer(txId, decision)
      setDecided((s) => new Set(s).add(txId))
      invalidate()
    } catch (e) {
      setError(`“${row.description}”: ${errorMessage(e)}`)
    } finally {
      setPending((s) => {
        const next = new Set(s)
        next.delete(txId)
        return next
      })
    }
  }

  const rows = list.data?.filter((r) => !decided.has(r.transactionId))

  return (
    <div id={id} className="mt-3 max-w-3xl">
      {error && (
        <p role="alert" className="pb-2 text-[13px] text-broken">
          {error}
        </p>
      )}
      {rows ? (
        rows.length === 0 ? (
          <p className="py-3 text-[13px] text-ink-3">Nothing left to check for this period.</p>
        ) : (
          <ul className="border-t border-line">
            {rows.map((r) => {
              const busy = pending.has(r.transactionId)
              return (
                <li key={r.transactionId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">{r.description}</p>
                    <p className="figures mt-0.5 text-[12px] text-ink-3">
                      {formatLedgerDate(r.date)} · {r.accountName}
                    </p>
                  </div>
                  <Money amount={r.amount} currency={r.currency} tone="flow" className="text-[14px]" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => decide(r, 'mine')}>
                      It’s my account
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => decide(r, 'payment')}>
                      It’s a payment
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : list.error ? (
        <ErrorState title="Couldn't load possible transfers" message={list.error} onRetry={list.reload} />
      ) : (
        <Loading label="Loading possible transfers" rows={2} />
      )}
    </div>
  )
}
