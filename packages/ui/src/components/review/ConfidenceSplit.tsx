import type { ConfidenceBand } from '../../types'
import { pct } from './helpers'

const SEGMENTS: { band: ConfidenceBand; swatch: string }[] = [
  { band: 'high', swatch: 'bg-chart-1' },
  { band: 'medium', swatch: 'bg-chart-muted' },
  { band: 'low', swatch: 'bg-surface-2' },
]

/** `bounds` is null until the gate settings have loaded; the legend then shows bare band names rather than assumed thresholds. */
type Props = { counts: Record<ConfidenceBand, number>; bounds: { high: number; low: number } | null }

export function ConfidenceSplit({ counts, bounds }: Props) {
  const total = counts.high + counts.medium + counts.low
  const legend: Record<ConfidenceBand, string> = bounds
    ? { high: `High ≥${pct(bounds.high)}`, medium: `Medium ${pct(bounds.low)}–<${pct(bounds.high)}`, low: `Low <${pct(bounds.low)}` }
    : { high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <section aria-label="Confidence split" className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-1">
      <h3 className="font-display text-[17px] leading-tight font-bold text-ink">How sure the model is</h3>
      <div
        role="img"
        aria-label={SEGMENTS.map((s) => `${counts[s.band]} ${s.band}`).join(', ')}
        className="mt-3 flex h-[18px] overflow-hidden rounded-md border border-ink"
      >
        {SEGMENTS.filter((s) => counts[s.band] > 0).map((s, i) => (
          <div
            key={s.band}
            className={`${s.swatch} ${i > 0 ? 'border-l border-ink' : ''}`}
            style={{ flexGrow: counts[s.band] / total, flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-[22px] gap-y-1 text-[12.5px] text-ink-2">
        {SEGMENTS.map((s) => (
          <li key={s.band} className="figures flex items-center gap-1.5">
            <i aria-hidden className={`size-2.5 rounded-sm border border-line-strong ${s.swatch}`} />
            {legend[s.band]} · <b className="font-bold text-ink">{counts[s.band]}</b>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-normal text-ink-3">
        High-confidence items still land here when the amount is unusual for what the vendor has charged before in that
        category.
      </p>
    </section>
  )
}
