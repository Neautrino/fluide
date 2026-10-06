import type { CashFlow, CashFlowParams, NotCountedKind } from '../../lib/api'
import { PossibleTransfers } from '../PossibleTransfers'
import { Amt, Card, DrillButton, Figure } from '@repo/ui/cashflow'

const LABEL: Record<NotCountedKind, string> = {
  between_accounts: 'Moved between your own accounts',
  card_payoffs: 'Card payments',
  invested: 'Moved to investments',
  savings: 'Moved to savings',
}

const NOTE: Record<NotCountedKind, string> = {
  between_accounts: 'Both sides are your own accounts, so it isn’t money in or out.',
  card_payoffs: 'The card’s purchases are counted by category instead.',
  invested: 'Not spending: it counts as kept, not as money out.',
  savings: 'Not spending: it counts as kept, not as money out.',
}

const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-line py-[9px] text-[12.5px]'

export function NotCounted({ data, params }: { data: CashFlow; params: CashFlowParams }) {
  const { currency, possibleTransfers } = data
  const entries = data.notCounted.filter((n) => n.count > 0)
  const nothing = entries.length === 0

  return (
    <div id="not-counted" tabIndex={-1} className="min-w-0 rounded-lg">
      <Card title="Not counted" sub="kept out of Money in and Money out on purpose" className="h-full">
        {possibleTransfers.count > 0 && (
          <PossibleTransfers
            currency={currency}
            count={possibleTransfers.count}
            total={possibleTransfers.total}
            params={{ ...params, currency }}
          />
        )}
        {nothing ? (
          possibleTransfers.count === 0 && <p className="text-[12.5px] text-ink-3">Nothing was left out of these totals.</p>
        ) : (
          <ul className={possibleTransfers.count > 0 ? 'mt-3' : undefined}>
            {entries.map((n) => (
              <li key={n.kind} className={ROW}>
                <div>
                  <b className="font-bold">{LABEL[n.kind]}</b>
                  <small className="mt-px block text-[11.5px] leading-[1.45] text-ink-3">{NOTE[n.kind]}</small>
                </div>
                <DrillButton
                  drill={{ token: `notcounted:${n.kind}`, label: LABEL[n.kind], amount: n.total }}
                  className="font-display text-[13.5px] font-bold whitespace-nowrap text-ink"
                >
                  <Amt>
                    <Figure value={n.total} currency={currency} />
                  </Amt>{' '}
                  ({n.count})
                </DrillButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
