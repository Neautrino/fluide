import { useState } from 'react'
import type { CashFlow } from '../../lib/api'
import { Segmented } from '@repo/ui/primitives'
import { Amt, baselineNoun, Card, money, topRiser, useAmountsHidden, useDrill } from '@repo/ui/cashflow'
import { Sankey, SankeyTable } from './Sankey'

export function SankeyCard({ data }: { data: CashFlow }) {
  const [view, setView] = useState<'flow' | 'table'>('flow')
  const open = useDrill()
  const hidden = useAmountsHidden()
  const { totals, currency } = data
  const keptShare = totals.moneyIn > 0 ? Math.round((totals.kept / totals.moneyIn) * 100) : null
  const spentShare = totals.moneyIn > 0 ? Math.round((totals.moneyOut / totals.moneyIn) * 100) : null
  const riser = topRiser(data.categories)

  return (
    <Card
      title="Where your money went"
      sub={
        keptShare !== null && spentShare !== null ? (
          <>
            {keptShare >= 0 ? (
              <>
                You kept <b>{keptShare}%</b> of what came in and spent <b>{spentShare}%</b>.
              </>
            ) : (
              <>
                You spent <b>{spentShare}%</b> of what came in; the rest came from your balances.
              </>
            )}{' '}
            {view === 'flow' && 'Hover a flow to trace it; click to see its transactions.'}
          </>
        ) : (
          'Nothing came in this month, so everything that went out came from your balances.'
        )
      }
      aside={
        <>
          {riser && (
            <span className="rounded-full bg-surface-inverse px-2.5 py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-ink-inverse">
              {riser.label}{' '}
              {riser.change === null ? <Amt>{money(riser.diff, currency, { sign: 'always', whole: true })}</Amt> : `+${Math.round(riser.change * 100)}%`} vs{' '}
              {baselineNoun(data.compare, data.month)}
            </span>
          )}
          <Segmented
            label="View"
            value={view}
            options={[
              { value: 'flow', label: 'Flow' },
              { value: 'table', label: 'Table' },
            ]}
            onChange={setView}
          />
        </>
      }
    >
      {view === 'flow' ? (
        <Sankey
          sankey={data.sankey}
          currency={currency}
          hidden={hidden}
          mover={riser?.label}
          onSelect={(token, label, amount) => open({ token, label, amount })}
        />
      ) : (
        <SankeyTable sankey={data.sankey} currency={currency} />
      )}
      <p className="mt-2 text-[11.5px] text-ink-3">
        One currency at a time · card payments and moves between your own accounts are not in Spent · possible transfers count until you
        check them
      </p>
    </Card>
  )
}
