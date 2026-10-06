import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CashFlowParams } from '../../lib/api'
import { formatLedgerDate } from '@repo/ui/format'
import { cashFlowTransactionsOptions, queryError } from '../../lib/queries'
import { Drawer, Empty, ErrorState, Loading, Money } from '@repo/ui/primitives'
import { Amt, Figure, type Drill } from '@repo/ui/cashflow'

export function DrillDrawer({
  drill,
  params,
  title,
  onClose,
}: {
  drill: Drill
  params: CashFlowParams & { currency: string }
  title: string
  onClose: () => void
}) {
  const res = useQuery({ ...cashFlowTransactionsOptions(params, drill.token), placeholderData: keepPreviousData })
  const data = res.isError ? undefined : res.data
  return (
    <Drawer title={title} onClose={onClose}>
      {data ? (
        <>
          <div className="border-b border-ink pb-4">
            <p className="eyebrow">Total</p>
            <Amt className="mt-1 block font-display text-[36px] leading-none text-ink">
              <Figure value={data.total} currency={params.currency} />
            </Amt>
            <p className="figures mt-2 text-[13px] text-ink-3">
              {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
          {data.rows.length === 0 ? (
            <Empty title="No transactions" />
          ) : (
            <ul>
              {data.rows.map((r, i) => (
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
      ) : res.isError ? (
        <ErrorState title="Couldn't load these transactions" message={queryError(res)} onRetry={() => void res.refetch()} />
      ) : (
        <Loading label="Loading transactions" rows={5} />
      )}
    </Drawer>
  )
}
