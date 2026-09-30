import { useState } from 'react'
import type { CashFlow, CashFlowCompare } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { Button } from '../ui/Button'
import { Empty } from '../ui/States'
import { CategoryBar } from './CategoryBar'
import { baselineNoun, compareShort, formatWhole, pct } from './figures'
import { Amt, Card, DrillButton, Figure, type Drill } from './primitives'
import { topRiser } from './movers'
import { TextLink } from './TextLink'

const CATEGORY_ROWS = 9

const BASELINE_HEADER: Record<CashFlowCompare, string> = { average: 'Average', previous: 'Previous', last_year: 'Last year' }

const TH = 'px-1.5 pb-2 min-[1360px]:px-2 text-right text-[10.5px] font-bold tracking-[0.07em] whitespace-nowrap text-ink-3 uppercase'
const TH_FIRST = 'pr-1.5 pb-2 pl-0.5 text-left text-[10.5px] font-bold tracking-[0.07em] whitespace-nowrap text-ink-3 uppercase'
const CELL = 'border-t border-line px-1.5 text-right whitespace-nowrap min-[1360px]:px-2'
const TD = `${CELL} py-2`
const TD_TOTAL = `${CELL} pt-2.5 pb-2`
const TD_FIRST = 'border-t border-line pr-1.5 text-left'
const WIDE = 'hidden @[540px]:table-cell'

export function Categories({ data }: { data: CashFlow }) {
  const { navigate } = useApp()
  const [all, setAll] = useState(false)
  const { compare, currency, totals } = data
  const noun = baselineNoun(compare, data.month)
  const cats = data.categories

  if (cats.length === 0) {
    return (
      <Card title="Spending by category">
        <Empty title="No spending this month" />
      </Card>
    )
  }

  const rows = all ? cats : cats.slice(0, CATEGORY_ROWS)
  const max = Math.max(...cats.map((c) => Math.max(c.amount, c.baseline ?? 0)), 1)
  const top = cats[0]
  const above = topRiser(cats)
  const fromBank = cats.some((c) => c.fromBank)
  const debt: Drill = { token: 'debt', label: 'Debt payments', amount: totals.debtPayments }
  const out: Drill = { token: 'out', label: 'Money out', amount: totals.moneyOut }

  return (
    <Card
      title="Spending by category"
      sub={
        <>
          {top.label} is <b>{pct(top.shareOfSpending)}</b> of spending.
          {above && (
            <>
              {' '}
              {above.label} is{' '}
              <b>
                <Amt>{formatWhole(above.diff, currency)}</Amt>
              </b>{' '}
              above {noun}.
            </>
          )}
        </>
      }
      aside={
        <>
          {fromBank && (
            <span
              tabIndex={0}
              title="Categories from your bank: until Fluide has a category for a transaction, it shows the one your bank assigned."
              className="inline-flex h-6 shrink-0 cursor-help items-center gap-1 rounded-sm border border-line px-2 text-[12px] font-medium whitespace-nowrap text-ink-3"
            >
              <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                <path d="M2 6.5 8 3l6 3.5M3.5 7v5M6.5 7v5M9.5 7v5M12.5 7v5M2 13.5h12" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              from bank
            </span>
          )}
          <TextLink onClick={() => navigate('rules')}>Rules</TextLink>
        </>
      }
    >
      <div className="@container">
        <table className="w-full table-fixed border-collapse text-[13px] leading-[1.3]">
          <thead>
            <tr>
              <th className={`${TH_FIRST}`}>Category</th>
              <th className={`${TH} ${WIDE} w-[72px]`}>
                <span className="sr-only">Spent against {noun}</span>
              </th>
              <th className={`${TH} w-[84px]`}>Spent</th>
              <th className={`${TH} w-[78px]`} title={`Compared with ${noun}`}>
                {BASELINE_HEADER[compare]}
              </th>
              <th className={`${TH} ${WIDE} w-[52px]`}>% spend</th>
              <th className={`${TH} ${WIDE} w-14`}>% in</th>
              <th className={`${TH} w-[86px]`} title={`Change vs ${noun}`}>
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const drill: Drill = { token: `category:${c.label}`, label: c.label, amount: c.amount }
              const hl = c.label === above?.label
              return (
                <tr key={c.label} className={`hover:bg-surface-2 ${hl ? 'bg-surface-2' : ''}`}>
                  <td className={`${TD_FIRST} py-2 ${hl ? 'pl-2.5 shadow-[inset_3px_0_0_var(--chart-1)]' : 'pl-0.5'}`}>
                    <DrillButton drill={drill} plain className="max-w-full text-left font-bold break-words text-ink">
                      {c.label}
                      {c.fromBank && <span className="sr-only"> (category from your bank)</span>}
                    </DrillButton>
                    <div className="pr-1 @[540px]:hidden">
                      <CategoryBar amount={c.amount} baseline={c.baseline} max={max} highlight={hl} />
                    </div>
                  </td>
                  <td className={`${TD} ${WIDE}`}>
                    <CategoryBar amount={c.amount} baseline={c.baseline} max={max} highlight={hl} />
                  </td>
                  <td className={TD}>
                    <DrillButton drill={drill} className="font-display text-[13.5px] font-bold text-ink">
                      <Amt>
                        <Figure value={c.amount} currency={currency} />
                      </Amt>
                    </DrillButton>
                  </td>
                  <td className={`${TD} text-ink-3`}>
                    {c.baseline === null ? (
                      '—'
                    ) : (
                      <Amt>
                        <Figure value={c.baseline} currency={currency} />
                      </Amt>
                    )}
                  </td>
                  <td className={`${TD} ${WIDE} figures text-[12.5px] text-ink-3`}>{pct(c.shareOfSpending)}</td>
                  <td className={`${TD} ${WIDE} figures text-[12.5px] text-ink-3`}>
                    {c.shareOfIncome === null ? '—' : pct(c.shareOfIncome)}
                  </td>
                  <td className={TD}>
                    <DeltaChip amount={c.amount} baseline={c.baseline} currency={currency} compare={compare} />
                  </td>
                </tr>
              )
            })}
            {totals.debtPayments > 0 && (
              <tr className="hover:bg-surface-2">
                <td className={`${TD_FIRST} py-2 pl-0.5`}>
                  <DrillButton drill={debt} plain className="max-w-full text-left font-bold break-words text-ink">
                    Debt payments
                  </DrillButton>
                </td>
                <td className={`${TD} ${WIDE}`} />
                <td className={TD}>
                  <DrillButton drill={debt} className="font-display text-[13.5px] font-bold text-ink">
                    <Amt>
                      <Figure value={totals.debtPayments} currency={currency} />
                    </Amt>
                  </DrillButton>
                </td>
                <td className={`${TD} text-ink-3`}>—</td>
                <td className={`${TD} ${WIDE} text-[12.5px] text-ink-3`}>—</td>
                <td className={`${TD} ${WIDE} figures text-[12.5px] text-ink-3`}>
                  {totals.moneyIn > 0 ? pct(totals.debtPayments / totals.moneyIn) : '—'}
                </td>
                <td className={TD} />
              </tr>
            )}
            <tr>
              <td className={`${TD_FIRST} pt-2.5 pb-2 pl-0.5`}>
                <DrillButton drill={out} plain className="text-left font-extrabold text-ink">
                  Total out
                </DrillButton>
                {totals.debtPayments > 0 && (
                  <small className="block text-[11px] leading-[1.3] font-normal whitespace-normal text-ink-3">Spending + debt payments</small>
                )}
              </td>
              <td className={`${TD_TOTAL} ${WIDE}`} />
              <td className={TD_TOTAL}>
                <DrillButton drill={out} className="font-display text-[14.5px] font-extrabold text-ink">
                  <Amt>
                    <Figure value={totals.moneyOut} currency={currency} />
                  </Amt>
                </DrillButton>
              </td>
              <td className={`${TD_TOTAL} text-ink-3`}>
                {totals.vs.moneyOut.baseline === null ? (
                  '—'
                ) : (
                  <Amt>
                    <Figure value={totals.vs.moneyOut.baseline} currency={currency} />
                  </Amt>
                )}
              </td>
              <td className={`${TD_TOTAL} ${WIDE} text-[12.5px] text-ink-3`}>—</td>
              <td className={`${TD_TOTAL} ${WIDE} figures text-[12.5px] text-ink-3`}>
                {totals.moneyIn > 0 ? pct(totals.moneyOut / totals.moneyIn) : '—'}
              </td>
              <td className={TD_TOTAL}>
                <DeltaChip amount={totals.moneyOut} baseline={totals.vs.moneyOut.baseline} currency={currency} compare={compare} quiet />
              </td>
            </tr>
          </tbody>
        </table>
        {cats.length > CATEGORY_ROWS && (
          <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setAll((a) => !a)}>
            {all ? 'Show fewer' : `Show all ${cats.length} categories`}
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">
        {compare === 'average' ? `Average = your last 12 complete months, same day. Dotted tick = ${noun}.` : `Dotted tick = ${noun}.`}
      </p>
    </Card>
  )
}

function DeltaChip({
  amount,
  baseline,
  currency,
  compare,
  quiet = false,
}: {
  amount: number
  baseline: number | null
  currency: string
  compare: CashFlowCompare
  /** No baseline to compare with: say nothing instead of "new". */
  quiet?: boolean
}) {
  const base = 'inline-flex h-[18px] min-w-14 items-center justify-center rounded-sm px-1.5 text-[11.5px] font-medium whitespace-nowrap'
  if (baseline === null) return quiet ? null : <span className={`${base} text-ink-3`}>new</span>
  const diff = amount - baseline
  if (Math.abs(diff) < 1) {
    return <span className={`${base} text-ink-3 shadow-[inset_0_0_0_1px_var(--line)]`}>= {compareShort(compare)}</span>
  }
  return (
    <span className={`${base} ${diff > 0 ? 'bg-surface-2 text-ink-2' : 'bg-positive-wash text-positive'}`}>
      {diff > 0 ? '▲' : '▼'}&nbsp;<Amt>{formatWhole(diff, currency)}</Amt>
    </span>
  )
}
