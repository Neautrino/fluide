import { useId } from 'react'
import { getJson, type GateSettings } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { toNumber } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { CARD, CardHead } from './shared'

const STEPS = [
  { title: 'Rules first', text: 'An active rule that matches always wins. Rules you wrote come before learned ones.' },
  { title: 'Model', text: 'No rule? The model reads the merchant text and returns a category with a confidence.' },
  { title: 'Confidence gate', text: 'The confidence decides what happens:' },
]

export function HowItDecides({ className = '' }: { className?: string }) {
  const { version } = useApp()
  const gate = useResource((signal) => getJson<{ settings: GateSettings }>('/api/assistant/gate', signal).then((r) => r.settings), version)

  return (
    <section className={`${CARD} ${className}`} aria-label="How categorization decides">
      <CardHead title="How categorization decides" />
      <ol className="mb-2.5 flex flex-col">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={`relative grid grid-cols-[28px_1fr] items-start gap-2.5 pb-[11px] ${
              i < STEPS.length - 1 ? 'before:absolute before:top-7 before:bottom-0 before:left-[13.5px] before:border-l before:border-dashed before:border-line-strong' : ''
            }`}
          >
            <span className="grid size-7 place-items-center rounded-full border border-line-strong bg-surface font-display text-[12px] font-bold">{i + 1}</span>
            <div>
              <b className="block text-[13px] font-bold">{s.title}</b>
              <p className="mt-px text-[12px] leading-[1.4] text-ink-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {gate.data && <GateStrip settings={gate.data} />}
      <p className="mt-2.5 text-[11.5px] leading-[1.45] text-ink-3">
        Approving a suggestion, or categorizing a transaction yourself, saves a rule and files that merchant’s other uncategorized transactions too.
      </p>
    </section>
  )
}

const X0 = 8
const W = 300

function GateStrip({ settings }: { settings: GateSettings }) {
  const { reviewCount } = useApp()
  const hatch = useId()
  const low = Math.min(1, Math.max(0, toNumber(settings.lowConfidence)))
  const high = Math.min(1, Math.max(low, toNumber(settings.highConfidence)))
  const xl = X0 + W * low
  const xh = X0 + W * high

  return (
    <>
      <svg
        viewBox="0 0 316 92"
        role="img"
        aria-label={`Confidence gate: below ${low.toFixed(2)} no suggestion, stays uncategorized and is flagged for Review; ${low.toFixed(2)} to ${high.toFixed(2)} goes to Review; ${high.toFixed(2)} and above may auto-apply.`}
        className="block h-auto w-full overflow-visible"
      >
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" className="fill-surface" />
            <line x1="0" y1="0" x2="0" y2="5" strokeWidth="1.6" style={{ stroke: 'var(--hatch-stripe)' }} />
          </pattern>
        </defs>
        <rect x={X0} y="4" width={xl - X0} height="26" className="fill-chart-muted" />
        <rect x={xl} y="4" width={xh - xl} height="26" fill={`url(#${hatch})`} />
        <rect x={xh} y="4" width={X0 + W - xh} height="26" className="fill-chart-1" />
        <rect x={X0} y="4" width={W} height="26" rx="2" className="fill-none stroke-line-strong" />
        <path d={`M${xl} 4v32M${xh} 4v32`} className="stroke-line-strong" />
        <g className="figures font-sans text-[10.5px]">
          <text x={X0} y="46" className="fill-ink-3">0</text>
          <text x={xl} y="47" textAnchor="middle" className="fill-ink text-[11px] font-bold">{low.toFixed(2)}</text>
          <text x={xh} y="47" textAnchor="middle" className="fill-ink text-[11px] font-bold">{high.toFixed(2)}</text>
          <text x={X0 + W} y="46" textAnchor="end" className="fill-ink-3">1</text>
        </g>
        <g textAnchor="middle" className="font-sans">
          <text x={(X0 + xl) / 2} y="64" className="fill-ink text-[11px] font-bold">No suggestion</text>
          <text x={(X0 + xl) / 2} y="77" className="fill-ink-3 text-[10px]">stays uncategorized,</text>
          <text x={(X0 + xl) / 2} y="89" className="fill-ink-3 text-[10px]">flagged for Review</text>
          <text x={(xl + xh) / 2} y="64" className="fill-ink text-[11px] font-bold">Review</text>
          <text x={(xh + X0 + W) / 2} y="64" className="fill-ink text-[11px] font-bold">May auto-apply</text>
        </g>
      </svg>
      <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-[5px]">
          <i aria-hidden className="inline-block h-2.5 w-3 rounded-[2px] border border-line-strong bg-chart-muted" />
          not suggested
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <i
            aria-hidden
            className="inline-block h-2.5 w-3 rounded-[2px] border border-line-strong bg-surface bg-[repeating-linear-gradient(45deg,var(--hatch-stripe)_0_1.2px,transparent_1.2px_4.5px)]"
          />
          not final, waiting
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <i aria-hidden className="inline-block h-2.5 w-3 rounded-[2px] border border-line-strong bg-chart-1" />
          may auto-apply
        </span>
      </div>
      <p className="mt-2 text-[11.5px] leading-[1.45] text-ink-3">
        Auto-apply also needs a usual amount once the merchant has earlier transactions in that category.
        {reviewCount !== null && ` Review holds everything below the top zone, plus high-confidence items that fail that check: ${reviewCount} waiting now.`}
      </p>
    </>
  )
}
