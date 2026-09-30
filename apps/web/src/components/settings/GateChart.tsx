const X0 = 20
const WIDTH = 820
const TOP = 34
const BAND_H = 54

const xOf = (c: number) => X0 + Math.min(1, Math.max(0, c)) * WIDTH

/** The three confidence bands as the gate applies them; `markers` are the confidences of items waiting in Review. */
export function GateChart({ low, high, markers = [] }: { low: number; high: number; markers?: number[] }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && low >= 0 && low < high && high <= 1
  if (!ok) {
    return (
      <div className="flex aspect-[860/132] items-center justify-center rounded-sm bg-surface-2 text-[13px] text-ink-3">
        Fix the thresholds to preview the bands.
      </div>
    )
  }

  const lx = xOf(low)
  const hx = xOf(high)
  const lo = low.toFixed(2)
  const hi = high.toFixed(2)
  const close = hx - lx < 64
  const label = 'font-sans text-[11.5px] font-bold'
  const sub = 'font-sans text-[10.5px] font-medium'
  const tick = 'fill-ink-3 figures font-sans text-[10.5px] font-medium'

  return (
    <svg
      viewBox="0 0 860 132"
      role="img"
      aria-label={`Confidence scale from 0 to 1. Below ${lo} no guess; ${lo} to ${hi} suggested and waiting for review; ${hi} and above may be applied automatically after the vendor checks.`}
      className="block h-auto w-full overflow-visible"
    >
      <defs>
        <pattern id="gate-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" className="fill-surface" />
          <line x1="0" y1="0" x2="0" y2="5" strokeWidth="1.2" className="stroke-(--hatch-stripe)" />
        </pattern>
      </defs>

      <rect x={X0} y={TOP} width={lx - X0} height={BAND_H} rx="3" className="fill-surface-2 stroke-line-strong" />
      <rect x={lx} y={TOP} width={hx - lx} height={BAND_H} fill="url(#gate-hatch)" className="stroke-line-strong" />
      <rect x={hx} y={TOP} width={X0 + WIDTH - hx} height={BAND_H} rx="3" className="fill-tile-3 stroke-line-strong" />

      {lx - X0 >= 206 && (
        <>
          <rect x={X0 + 10} y="44" width="190" height="34" rx="3" className="fill-surface" />
          <text x={X0 + 18} y="58" className={`${label} fill-ink`}>
            Below {lo} · no guess
          </text>
          <text x={X0 + 18} y="72" className={`${sub} fill-ink-3`}>
            Left uncategorized; you pick
          </text>
        </>
      )}
      {hx - lx >= 166 && (
        <>
          <rect x={lx + 8} y="44" width="150" height="34" rx="3" className="fill-surface" />
          <text x={lx + 16} y="58" className={`${label} fill-ink`}>
            {lo}–{hi} · suggest
          </text>
          <text x={lx + 16} y="72" className={`${sub} fill-ink-3`}>
            Waits in Review, not final
          </text>
        </>
      )}
      {X0 + WIDTH - hx >= 170 && (
        <>
          <text x={hx + 10} y="58" className={`${label} fill-tile-ink`}>
            {hi}+ · may apply
          </text>
          <text x={hx + 10} y="72" className={`${sub} fill-tile-ink`}>
            Needs the vendor checks below
          </text>
        </>
      )}

      <line x1={lx} y1="26" x2={lx} y2="96" strokeWidth="1.6" className="stroke-ink" />
      <line x1={hx} y1="26" x2={hx} y2="96" strokeWidth="1.6" className="stroke-ink" />
      <text x={lx} y="20" textAnchor={close ? 'end' : 'middle'} className={`${label} fill-ink`}>
        low {lo}
      </text>
      <text x={hx} y="20" textAnchor={close ? 'start' : 'middle'} className={`${label} fill-ink`}>
        high {hi}
      </text>

      <line x1={X0} y1="104" x2={X0 + WIDTH} y2="104" className="stroke-line-strong" />
      {[
        [0, '0'],
        [0.25, '0.25'],
        [1, '1.00'],
      ].map(([c, text]) => (
        <g key={text}>
          <line x1={xOf(Number(c))} y1="104" x2={xOf(Number(c))} y2="108" className="stroke-line-strong" />
          <text x={xOf(Number(c))} y="122" textAnchor="middle" className={tick}>
            {text}
          </text>
        </g>
      ))}

      {markers.map((c, i) => (
        <circle key={i} cx={xOf(c)} cy="104" r="5" className="fill-chart-muted stroke-line-strong" />
      ))}
    </svg>
  )
}
