import type { CashFlow } from '../../lib/api'
import { pct } from './figures'
import { Amt, Card, DrillButton, Figure } from './primitives'

export function Sources({ data }: { data: CashFlow }) {
  const { currency } = data
  const rows = data.sources
  const regular = rows.filter((s) => s.regularity === 'monthly').reduce((sum, s) => sum + s.share, 0)
  const irregular = rows.filter((s) => s.regularity === 'irregular').reduce((sum, s) => sum + s.share, 0)
  const other = Math.max(0, 1 - regular - irregular)
  const top = rows[0]
  return (
    <Card
      title="Money in by source"
      sub={
        top ? (
          <>
            <b>{pct(top.share, 0)}</b> came from {top.name}.
          </>
        ) : (
          'Nothing came in this month.'
        )
      }
    >
      {rows.length > 0 && (
        <>
          <div aria-hidden className="flex h-3 gap-1">
            {regular > 0 && <i className="block min-w-1 rounded-[2px] bg-positive" style={{ flexGrow: regular }} />}
            {irregular > 0 && (
              <i
                className="block min-w-1 rounded-[2px] bg-positive-wash shadow-[inset_0_0_0_1.5px_var(--positive)]"
                style={{ flexGrow: irregular }}
              />
            )}
            {other > 0.0005 && <i className="block min-w-1 rounded-[2px] bg-chart-muted" style={{ flexGrow: other }} />}
          </div>
          <p className="figures flex justify-between gap-2 border-b border-line pt-2 pb-3 text-[12px] text-ink-3 [&_b]:font-semibold [&_b]:text-ink">
            <span>
              <b>{pct(regular, 0)}</b> regular
            </span>
            <span>
              <b>{pct(irregular, 0)}</b> irregular
            </span>
            <span>
              <b>{pct(other, 0)}</b> other
            </span>
          </p>
          <ul>
            {rows.map((s) => (
              <li key={`${s.kind}:${s.name}`} className="border-b border-line py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-bold text-ink">{s.name}</span>
                  <DrillButton
                    drill={{ token: s.kind === 'refunds' ? 'refunds' : `source:${s.name}`, label: s.name, amount: s.amount }}
                    className="shrink-0 font-display font-bold text-ink"
                  >
                    <Amt>
                      <Figure value={s.amount} currency={currency} signed />
                    </Amt>
                  </DrillButton>
                </div>
                <p className="mt-2 flex items-center text-[12px] text-ink-3">
                  {s.regularity && (
                    <span className="mr-2 inline-flex h-[18px] items-center rounded-sm border border-line px-1.5 text-[11px] font-medium">
                      {s.regularity}
                    </span>
                  )}
                  {pct(s.share)} of money in
                </p>
                <div aria-hidden className="mt-2 h-1 rounded-[2px] bg-surface-2">
                  <i className="block h-full rounded-[2px] bg-positive" style={{ width: `${Math.min(100, s.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
