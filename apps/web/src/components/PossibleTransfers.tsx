import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { decideTransfer, errorMessage, type CashFlowParams, type DrillRow, type PossibleTransfer, type TransferDecision } from '../lib/api'
import { formatLedgerDate, formatMoney } from '../lib/format'
import { cashFlowTransactionsOptions, queryError } from '../lib/queries'
import { Button } from './ui/Button'
import { ErrorState, Loading } from './ui/States'
import { Money } from './ui/Typography'

type Props = {
  currency: string
  count: number
  total: number
  /** The cash-flow request the rows behind `count` come from. */
  params: CashFlowParams & { currency: string }
}

/**
 * Bank-tagged transfers with no matching leg. The tag also covers payments to other people
 * (Zelle, Venmo, ATM cash), so they stay counted until the user says which they are.
 */
export function PossibleTransfers({ currency, count, total, params }: Props) {
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
      {open && <PossibleTransferList id="possible-transfers" params={params} />}
    </div>
  )
}

const drillRows = (r: { rows: DrillRow[] }) => r.rows

function PossibleTransferList({ id, params }: { id: string; params: Props['params'] }) {
  const queryClient = useQueryClient()
  const list = useQuery({ ...cashFlowTransactionsOptions(params, 'possible'), select: drillRows, placeholderData: keepPreviousData })
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
      void queryClient.invalidateQueries()
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

  const rows = list.isError ? undefined : list.data?.filter((r) => !decided.has(r.transactionId))

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
      ) : list.isError ? (
        <ErrorState title="Couldn't load possible transfers" message={queryError(list)} onRetry={() => void list.refetch()} />
      ) : (
        <Loading label="Loading possible transfers" rows={2} />
      )}
    </div>
  )
}
