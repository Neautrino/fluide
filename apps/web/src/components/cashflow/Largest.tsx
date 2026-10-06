import type { CashFlow } from '../../lib/api'
import { formatLedgerDate } from '@repo/ui/format'
import { Button, Empty } from '@repo/ui/primitives'
import { Amt, Card, Figure, monthOnly, monthStart, useDrill } from '@repo/ui/cashflow'

export function Largest({ data, className = '' }: { data: CashFlow; className?: string }) {
  const open = useDrill()
  const rows = data.largest
  const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0)
  return (
    <Card
      className={className}
      title="Largest transactions"
      sub={`Money out, ${data.partial ? 'this month so far' : monthOnly.format(monthStart(data.month))}`}
      aside={
        rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => open({ token: 'largest', label: 'Largest transactions', amount: total })}>
            Open list
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <Empty title="No money out this month" />
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.transactionId}
              className="-mx-2 grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border-b border-line p-2 last:border-b-0 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-ink">
                  {r.description}
                  {r.pending && <span className="ml-2 text-[12px] font-normal text-warning">Pending</span>}
                </p>
                <p className="truncate text-[11.5px] text-ink-3">
                  {r.category}
                  {r.fromBank && ' · from bank'}
                </p>
              </div>
              <div className="text-right">
                <Amt className="font-display text-[14px] font-bold text-ink">
                  <Figure value={r.amount} currency={r.currency} />
                </Amt>
                <small className="mt-0.5 block font-mono text-[11px] text-ink-3">
                  {formatLedgerDate(r.date)} · {r.accountName}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
