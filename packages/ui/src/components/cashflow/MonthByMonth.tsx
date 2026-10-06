import type { CashFlow } from '../../types'
import { formatWhole, monthOnly, monthStart } from './figures'
import { Amt, Card } from './primitives'
import { MonthBars } from './MonthBars'

export function MonthByMonth({ data, onMonth }: { data: CashFlow; onMonth: (month: string) => void }) {
  const selected = data.months.find((m) => m.month === data.month)
  const active = data.months.filter((m) => m.moneyIn > 0 || m.moneyOut > 0)
  const best = selected && active.length > 1 && active.every((m) => m === selected || m.net < selected.net)
  const name = monthOnly.format(monthStart(data.month))
  return (
    <Card
      title="Month by month"
      sub={
        selected ? (
          <>
            {name}
            {data.partial ? ' so far' : ''}:{' '}
            {selected.net >= 0 ? (
              <>
                you kept <b><Amt>{formatWhole(selected.net, data.currency)}</Amt></b>
              </>
            ) : (
              <>
                you spent <b><Amt>{formatWhole(-selected.net, data.currency)}</Amt></b> more than came in
              </>
            )}
            {best ? `, your best month of the last ${data.months.length}.` : '.'}
          </>
        ) : (
          'The last 12 months, in and out.'
        )
      }
    >
      <MonthBars
        months={data.months}
        averages={data.averages}
        currency={data.currency}
        daysElapsed={data.daysElapsed}
        month={data.month}
        onMonth={onMonth}
      />
      <p className="mt-2 text-[11.5px] text-ink-3">dotted = chart average (complete months)</p>
    </Card>
  )
}
