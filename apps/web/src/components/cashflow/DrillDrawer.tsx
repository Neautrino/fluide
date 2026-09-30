import { getCashFlowTransactions, type CashFlowParams } from '../../lib/api'
import { formatLedgerDate } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { Drawer } from '../ui/Drawer'
import { Empty, ErrorState, Loading } from '../ui/States'
import { Money } from '../ui/Typography'
import { Amt, Figure, type Drill } from './primitives'

export function DrillDrawer({
  drill,
  params,
  paramsKey,
  version,
  title,
  onClose,
}: {
  drill: Drill
  params: CashFlowParams & { currency: string }
  paramsKey: string
  version: number
  title: string
  onClose: () => void
}) {
  const res = useResource((signal) => getCashFlowTransactions(params, drill.token, signal), `${drill.token}|${paramsKey}|${version}`)
  return (
    <Drawer title={title} onClose={onClose}>
      {res.data ? (
        <>
          <div className="border-b border-ink pb-4">
            <p className="eyebrow">Total</p>
            <Amt className="mt-1 block font-display text-[36px] leading-none text-ink">
              <Figure value={res.data.total} currency={params.currency} />
            </Amt>
            <p className="figures mt-2 text-[13px] text-ink-3">
              {res.data.count} {res.data.count === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
          {res.data.rows.length === 0 ? (
            <Empty title="No transactions" />
          ) : (
            <ul>
              {res.data.rows.map((r, i) => (
                <li key={`${r.transactionId}:${i}`} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {r.description}
                      {r.pending && <span className="ml-2 text-[12px] text-warning">Pending</span>}
                    </p>
                    <p className="figures mt-0.5 text-[12px] text-ink-3">
                      {formatLedgerDate(r.date)} · {r.accountName} · {r.category}
                      {r.fromBank && ' (from bank)'}
                    </p>
                  </div>
                  <Money amount={r.amount} currency={r.currency} tone="flow" className="text-[14px]" />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : res.error ? (
        <ErrorState title="Couldn't load these transactions" message={res.error} onRetry={res.reload} />
      ) : (
        <Loading label="Loading transactions" rows={5} />
      )}
    </Drawer>
  )
}
