import type { CashFlow } from '../../lib/api'
import { Amt, Card, DrillButton, Figure, formatWhole } from '@repo/ui/cashflow'

type Kind = CashFlow['transfers'][number]['kind']

const TRANSFER_LABEL: Record<Kind, string> = {
  invested: 'Invested',
  savings: 'Moved to savings',
  card_payoffs: 'Card payoffs',
  between_accounts: 'Between your accounts',
  debt_payments: 'Debt payments',
}

const TRANSFER_SWATCH: Record<Kind, string> = {
  invested: 'bg-positive',
  savings: 'bg-positive-wash shadow-[inset_0_0_0_1.5px_var(--positive)]',
  card_payoffs: 'border-[1.5px] border-dashed border-line-strong',
  between_accounts: 'border-[1.5px] border-dashed border-line-strong bg-surface-2',
  debt_payments: 'bg-chart-1',
}

export function Transfers({ data }: { data: CashFlow }) {
  const { currency } = data
  const rows = data.transfers.filter((t) => t.count > 0)
  const total = rows.reduce((s, t) => s + t.total, 0)
  const count = rows.reduce((s, t) => s + t.count, 0)
  return (
    <Card
      className="flex flex-col"
      title="Transfers & savings"
      sub={
        rows.length === 0 ? (
          'Nothing moved between your own accounts this month.'
        ) : (
          <>
            <b>
              <Amt>{formatWhole(total, currency)}</Amt>
            </b>{' '}
            moved to your own accounts in {count} {count === 1 ? 'transfer' : 'transfers'}
          </>
        )
      }
    >
      {rows.length > 0 && (
        <>
          <div aria-hidden className="mb-2 flex h-3 gap-1">
            {rows.map((t) => (
              <i key={t.kind} className={`block min-w-1 rounded-[2px] ${TRANSFER_SWATCH[t.kind]}`} style={{ flexGrow: t.total }} />
            ))}
          </div>
          <ul>
            {rows.map((t) => (
              <li
                key={t.kind}
                className="-mx-2 grid min-h-14 grid-cols-[12px_1fr_auto] items-center gap-3 rounded-md border-b border-line p-2 last:border-b-0 hover:bg-surface-2"
              >
                <span aria-hidden className={`size-2.5 rounded-[2px] ${TRANSFER_SWATCH[t.kind]}`} />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-ink">{TRANSFER_LABEL[t.kind]}</p>
                  {t.accounts.length > 0 && <p className="truncate text-[11.5px] text-ink-3">→ {t.accounts.join(', ')}</p>}
                </div>
                <div className="text-right">
                  <DrillButton
                    drill={{ token: t.kind === 'debt_payments' ? 'debt' : `notcounted:${t.kind}`, label: TRANSFER_LABEL[t.kind], amount: t.total }}
                    className="font-display text-[14px] font-bold text-ink"
                  >
                    <Amt>
                      <Figure value={t.total} currency={currency} />
                    </Amt>
                  </DrillButton>
                  <small className="block text-[11.5px] text-ink-3">
                    {t.count} {t.kind === 'debt_payments' ? (t.count === 1 ? 'payment' : 'payments') : t.count === 1 ? 'transfer' : 'transfers'}
                    {t.kind === 'debt_payments' && ' · counted'}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-[11.5px] text-ink-3">
        <span aria-hidden className="size-3 shrink-0 rounded-[2px] border-[1.5px] border-dashed border-line-strong" />
        {rows.some((t) => t.kind === 'debt_payments')
          ? 'These moved between your own accounts, so they’re not spending. Debt payments still count in Money out.'
          : 'These moved between your own accounts, so they’re not spending.'}
      </p>
    </Card>
  )
}
