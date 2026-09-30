import type { Rule } from '../../lib/api'
import { plural, type MatchStats } from './model'
import { CARD, CardHead } from './shared'

const TOP = 8
const SLOT = 84
const BAR = 44
const BASE = 140
const HEIGHT = 105

const clip = (s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s)

export function MatchesCard({ active, stats }: { active: Rule[]; stats: MatchStats }) {
  const top = active.filter((r) => r.timesMatched > 0).slice(0, TOP)
  const max = top[0]?.timesMatched ?? 0
  if (max === 0) return null

  const share = (n: number) => `${(n / stats.matched) * 100}%`
  const both = stats.userMatched > 0 && stats.learnedMatched > 0

  return (
    <section className={CARD} aria-label="Matches by rule">
      <CardHead title="Matches by rule" meta={`all time · ${stats.matched} matched by ${stats.active} active ${plural(stats.active, 'rule')}`} />
      <svg
        viewBox="0 0 700 164"
        role="img"
        aria-label={`Times matched: ${top.map((r) => `${r.pattern} ${r.timesMatched}`).join(', ')}`}
        className="block h-auto w-full overflow-visible"
      >
        <line x1="0" y1={BASE - HEIGHT} x2="700" y2={BASE - HEIGHT} className="stroke-chart-grid" />
        <line x1="0" y1={BASE - HEIGHT / 2} x2="700" y2={BASE - HEIGHT / 2} className="stroke-chart-grid" />
        {top.map((r, i) => {
          const h = (HEIGHT * r.timesMatched) / max
          const x = 20 + i * SLOT
          const lead = i === 0
          return (
            <g key={r.id}>
              <title>{`${r.pattern}: ${r.timesMatched}`}</title>
              <rect x={x} y={BASE - h} width={BAR} height={h} rx="2" className={lead ? 'fill-chart-1' : 'fill-chart-muted'} />
              <text x={x + BAR / 2} y={BASE - h - 5} textAnchor="middle" className="figures fill-ink font-sans text-[11px] font-semibold">
                {r.timesMatched}
              </text>
              <text x={x + BAR / 2} y="157" textAnchor="middle" className={`font-mono text-[10.5px] ${lead ? 'fill-ink font-semibold' : 'fill-ink-3'}`}>
                {clip(r.pattern)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-[5px]">
          <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-[2px] bg-chart-1" />
          busiest rule
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-[2px] bg-chart-muted" />
          active
        </span>
      </div>

      <div className="mt-[22px]">
        <CardHead title="Who wrote the rules" meta={`share of ${stats.matched} matches`} />
      </div>
      <div
        role="img"
        aria-label={`Rules you wrote: ${stats.userMatched} matches; learned rules: ${stats.learnedMatched} matches`}
        className="mt-1.5 flex h-3.5 overflow-hidden rounded-[7px] border border-line"
      >
        <i className="block h-full bg-tile-2" style={{ width: share(stats.userMatched) }} />
        <i className={`block h-full bg-tile-1 ${both ? 'border-l border-line' : ''}`} style={{ width: share(stats.learnedMatched) }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[12px] text-ink-2">
        <span>
          <b className="figures font-bold text-ink">{stats.userMatched}</b> by {stats.userRules} {plural(stats.userRules, 'rule')} you wrote
        </span>
        <span>
          <b className="figures font-bold text-ink">{stats.learnedMatched}</b> by {stats.learnedRules} learned
        </span>
      </div>
    </section>
  )
}
