import type { CashFlow } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { Amt, baselineNoun, biggestMovers, money, TextLink, useDrill } from '@repo/ui/cashflow'

const TILE_BG = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']
const MAX_TILES = 4

export function MoveTiles({ data }: { data: CashFlow }) {
  const { ask } = useApp()
  const open = useDrill()
  const tiles = biggestMovers(data.categories).slice(0, MAX_TILES)
  if (tiles.length === 0) return null
  const { currency } = data
  const noun = baselineNoun(data.compare, data.month)
  const lead = tiles[0]
  const leadPct = lead.change === null ? '' : ` ${Math.round(Math.abs(lead.change) * 100)}%`

  return (
    <section aria-label="What moved it">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[17px] leading-[1.2] font-bold tracking-[-0.01em] text-ink">What moved it</h2>
        <p className="text-[12px] text-ink-3">
          Biggest changes vs {noun}
          {data.partial ? `, by day ${data.daysElapsed}` : ''} · signs in words, not color
        </p>
        <div className="ml-auto">
          <TextLink onClick={() => ask(`Why is ${lead.label} ${lead.diff > 0 ? 'up' : 'down'}${leadPct}?`)}>Ask why</TextLink>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => {
          const up = t.diff > 0
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => open({ token: `category:${t.label}`, label: t.label, amount: t.amount })}
              className={`flex min-h-[132px] min-w-0 flex-col rounded-md border border-line-strong p-3.5 text-left text-tile-ink [html[data-theme=dark]_&]:shadow-[inset_0_0_0_2px_var(--tile-ring-gap)] ${TILE_BG[i]}`}
            >
              <span className="flex items-start justify-between gap-2 text-[11.5px] font-bold tracking-[0.04em] uppercase">
                <span className="min-w-0 truncate">{t.label}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-tile-ink">
                  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                    <path d={up ? 'M3 12 7 8l2.5 2.5L13 5M9.5 5H13v3.5' : 'M3 4.5 7 8.5 9.5 6 13 10.5M9.5 10.5H13V7'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
              <Amt className="mt-auto font-display text-[22px] font-extrabold tracking-[-0.02em]">
                {money(t.diff, currency, { sign: 'always', whole: true })}
              </Amt>
              <span className="mt-0.5 text-[12px]">
                {up ? 'up' : 'down'}
                {t.change === null ? '' : ` ${(Math.abs(t.change) * 100).toFixed(1).replace(/\.0$/, '')}%`} ·{' '}
                <Amt>{money(t.amount, currency, { whole: true })}</Amt> vs <Amt>{money(t.baseline, currency, { whole: true })}</Amt>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
