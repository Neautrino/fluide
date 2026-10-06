import type { AccountBalance } from '../../types'
import { formatMoney } from '../../lib/format'
import { creditUsage, type CurrencyTotals } from './model'
import { Amt } from './shared'

function countOf(accounts: AccountBalance[], kind: AccountBalance['kind'], currency: string): number {
  return accounts.filter((b) => b.kind === kind && b.currency === currency && b.countsTowardTotals && b.balance !== null).length
}

export function OweCard({ totals: t, accounts }: { totals: CurrencyTotals; accounts: AccountBalance[] }) {
  const inCurrency = accounts.filter((b) => b.currency === t.currency)
  const usage = creditUsage(inCurrency)
  const cards = countOf(accounts, 'credit', t.currency)
  const loans = countOf(accounts, 'loan', t.currency)
  const rows = [
    {
      label: 'Credit cards',
      count: cards,
      value: t.cards,
      note: usage && (
        <>
          {usage.percent}% of <span className="amt">{formatMoney(usage.limit, t.currency)}</span> limit used
        </>
      ),
    },
    { label: 'Loans', count: loans, value: t.loans, note: null },
  ].filter((r) => r.count > 0)
  const kinds = [cards > 0 && 'cards', loans > 0 && 'loans'].filter(Boolean).join(' + ')

  return (
    <section aria-label="What you owe" className="flex min-w-0 flex-col gap-3 rounded-lg bg-surface-inverse px-[18px] pt-4 pb-3.5 text-ink-inverse shadow-1 [&_.amt_small]:text-ink-inverse/70">
      <h2 className="font-display text-[17px] leading-tight font-bold tracking-[-0.01em]">What you owe</h2>
      <p className="font-display text-[30px] leading-none font-extrabold tracking-[-0.02em]">
        <Amt value={t.owed} currency={t.currency} />
        <small className="ml-1.5 font-sans text-[12px] font-medium tracking-normal opacity-70">{kinds}</small>
      </p>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3 border-t border-ink-inverse/20 py-2.5">
            <div>
              <b className="block text-[13px] font-bold">
                {r.label} · {r.count}
              </b>
              {r.note && <small className="figures text-[11.5px] opacity-70">{r.note}</small>}
            </div>
            <Amt value={r.value} currency={t.currency} className="text-[14px] font-bold" />
          </li>
        ))}
      </ul>
    </section>
  )
}
