import type { CashFlow } from '../../lib/api'
import { Empty } from '../ui/States'
import { pct } from './figures'
import { Amt, Card, DrillButton, Figure, useDrill } from './primitives'
import { money } from './shared'
import { TextLink } from './TextLink'

export function Merchants({ data }: { data: CashFlow }) {
  const open = useDrill()
  const { currency, merchants: rows, totals } = data
  const shown = rows.reduce((sum, m) => sum + m.amount, 0)

  return (
    <Card
      title="Top merchants"
      sub="By amount out"
      aside={
        totals.moneyOut > 0 && (
          <TextLink onClick={() => open({ token: 'out', label: 'Money out', amount: totals.moneyOut })}>See all money out</TextLink>
        )
      }
    >
      {rows.length === 0 ? (
        <Empty title="No spending this month" />
      ) : (
        <>
          <ol>
            {rows.map((m) => (
              <li key={m.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
                    <span className="line-clamp-2 break-words" title={m.name}>
                      {m.name}
                    </span>
                    {m.isNew && (
                      <span className="inline-flex h-[18px] shrink-0 items-center rounded-sm bg-positive px-1.5 text-[10px] font-semibold tracking-[0.08em] text-surface">
                        NEW
                      </span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-ink-3">
                    {m.count === 1 ? (
                      '1 charge'
                    ) : (
                      <>
                        {m.count} charges · avg <Amt>{money(m.average, currency)}</Amt>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <DrillButton
                    drill={{ token: `merchant:${m.name}`, label: m.name, amount: m.amount }}
                    className="font-display text-[14px] font-bold text-ink"
                  >
                    <Amt>
                      <Figure value={m.amount} currency={currency} />
                    </Amt>
                  </DrillButton>
                  <small className="figures block text-[10.5px] font-medium text-ink-3">
                    {totals.moneyOut > 0 ? pct(m.amount / totals.moneyOut) : '—'} of out
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Top {rows.length} = <Amt>{money(shown, currency)}</Amt> of <Amt>{money(totals.moneyOut, currency)}</Amt>
          </p>
        </>
      )}
    </Card>
  )
}
