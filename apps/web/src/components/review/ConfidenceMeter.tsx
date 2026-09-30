import { pct } from './helpers'

const HATCH = 'repeating-linear-gradient(45deg, var(--hatch-stripe) 0 1.3px, var(--surface) 1.3px 5px)'

/** Neutral by design: a low score is not an error, so no red. `threshold` is the auto-apply line. */
export function ConfidenceMeter({ value, threshold }: { value: number; threshold: number | null }) {
  const width = Math.min(Math.max(value, 0), 1) * 100
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div
        role="meter"
        aria-label="Model confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="relative mt-1 mb-5 h-3 min-w-24 flex-1 rounded-full border border-line-strong bg-surface-2"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full border border-ink"
          style={{ width: `${width}%`, backgroundImage: HATCH }}
        />
        {threshold !== null && (
          <div className="absolute -top-1 -bottom-1 w-px bg-ink" style={{ left: `${threshold * 100}%` }}>
            <span className="figures absolute top-full left-1/2 mt-0.5 -translate-x-1/2 text-[10.5px] whitespace-nowrap text-ink-3">
              auto-apply {pct(threshold)}
            </span>
          </div>
        )}
      </div>
      <span className="figures min-w-11 font-display text-[16px] leading-5 font-extrabold text-ink">{pct(value)}</span>
    </div>
  )
}
