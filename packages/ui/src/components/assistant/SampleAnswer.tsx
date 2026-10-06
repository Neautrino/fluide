import { useId } from 'react'
import { formatMoney } from '../../lib/format'
import { useWidth } from '../cashflow/shared'
import { Money } from '../ui/Typography'
import { Fresh, ProvisionalPill } from './AnswerChips'
import { Spark } from './Spark'

const SHOPPING = 548.2
const REVIEWED = 284.73
const WAITING = 263.47
const TYPICAL = 397
const AXIS_MAX = 600
const CHART_H = 80
const PILL_W = 58

const usd = (v: number) => formatMoney(v, 'USD')

/** Shopping so far against typical, drawn at true pixel size so its labels never scale with the card. */
function ShoppingBar() {
  const [ref, w] = useWidth<HTMLDivElement>()
  const hatch = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const span = Math.round((w * 420) / 440)
  const x = (v: number) => (v / AXIS_MAX) * span
  const pillX = x(SHOPPING) - 2.7 - PILL_W
  const typicalLabelX = Math.max(Math.min(x(TYPICAL), pillX - 46), 40)
  /** The label inside the black bar sheds words as the bar narrows, so it never runs onto the hatch. */
  const reviewedLabel =
    x(REVIEWED) >= 158 ? `reviewed ${usd(REVIEWED)} · 8 rows` : x(REVIEWED) >= 112 ? `${usd(REVIEWED)} · 8 rows` : usd(REVIEWED)
  return (
    <div ref={ref} style={{ height: CHART_H }}>
      {w > 0 && (
        <svg
          width={w}
          height={CHART_H}
          viewBox={`0 0 ${w} ${CHART_H}`}
          role="img"
          aria-label="Shopping, 1 to 29 September: 284 dollars 73 cents reviewed plus 263 dollars 47 cents waiting for review, total 548 dollars 20 cents, against a typical of 397 dollars — 38 percent above. Typical is the median of June to August."
          className="block"
        >
          <defs>
            <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--surface)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--hatch-stripe)" strokeWidth="2.2" />
            </pattern>
          </defs>
          <line x1={x(200)} y1="22" x2={x(200)} y2="58" stroke="var(--chart-grid)" />
          <line x1={x(400)} y1="22" x2={x(400)} y2="58" stroke="var(--chart-grid)" />
          <rect x="0" y="28" width={span} height="24" rx="7" fill="var(--chart-grid)" />
          <rect x="0" y="28" width={x(REVIEWED) + 7} height="24" rx="7" fill="var(--chart-1)" />
          <path
            d={`M${x(REVIEWED)} 28H${x(SHOPPING) - 7}a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H${x(REVIEWED)}z`}
            fill={`url(#${hatch})`}
            stroke="var(--chart-1)"
            strokeWidth="1.2"
          />
          <line
            x1={x(TYPICAL)}
            y1="14"
            x2={x(TYPICAL)}
            y2="64"
            stroke="var(--ink)"
            strokeWidth="1.6"
            strokeDasharray="1.5 2.5"
            strokeLinecap="round"
          />
          <text x={typicalLabelX} y="10" textAnchor="middle" fill="var(--ink-3)" className="amt text-[10.5px]">
            typical {usd(TYPICAL)}
          </text>
          <rect x={pillX} y="0" width={PILL_W} height="20" rx="10" fill="var(--surface-inverse)" />
          <text x={pillX + PILL_W / 2} y="14" textAnchor="middle" fill="var(--ink-inverse)" className="text-[10.5px] font-bold">
            +38%
          </text>
          <line x1={pillX + PILL_W / 2} y1="20" x2={pillX + PILL_W / 2} y2="28" stroke="var(--surface-inverse)" strokeWidth="1.2" />
          <text x="10" y="44" fill="var(--ink-inverse)" className="amt text-[11px] font-semibold">
            {reviewedLabel}
          </text>
          <text x="0" y="76" fill="var(--ink-3)" className="amt text-[10.5px]">
            $0
          </text>
          <text x={x(200)} y="76" textAnchor="middle" fill="var(--ink-3)" className="text-[10.5px]">
            200
          </text>
          <text x={x(400)} y="76" textAnchor="middle" fill="var(--ink-3)" className="text-[10.5px]">
            400
          </text>
          <text x={span} y="76" textAnchor="end" fill="var(--ink-3)" className="text-[10.5px]">
            600
          </text>
        </svg>
      )}
    </div>
  )
}

/** The one sample answer the ask card shows: Shopping against its typical month. */
export function SampleAnswer() {
  return (
    <>
      <div className="max-w-[80%] self-end rounded-[16px_16px_4px_16px] border border-line bg-surface px-[15px] py-2.5 text-[13.5px] leading-[17px] font-semibold text-ink">
        Why is Shopping up 38% this month?
        <small className="mt-0.5 block text-right text-[10.5px] leading-[13px] font-medium text-ink-3">you · 10:42</small>
      </div>
      <div className="flex items-start gap-3">
        <span className="grid size-[30px] flex-none place-items-center rounded-full border border-line-strong bg-surface text-ink">
          <Spark className="size-3.5" />
        </span>
        <div className="@container flex min-w-0 flex-1 flex-col gap-3.5">
          <p className="text-[14.5px] leading-[1.55] text-ink">
            Shopping is <Money amount={SHOPPING} className="font-bold" /> so far in September,{' '}
            <Money amount={SHOPPING - TYPICAL} className="font-bold" /> above your typical <Money amount={TYPICAL} className="font-bold" />.
            Most of the gap is one Amazon charge of <Money amount={WAITING} className="font-bold" /> on 27 Sep that is{' '}
            <b className="font-bold">still waiting for review</b> (62% sure it’s Shopping). Without it, reviewed Shopping is{' '}
            <Money amount={REVIEWED} className="font-bold" />, under typical.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <ProvisionalPill>Provisional · 1 item waiting</ProvisionalPill>
            <Fresh>as of Tartan 29 Sep · Meridian 28 Sep</Fresh>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-1">
            <div className="flex flex-wrap items-end gap-x-7 gap-y-2 border-b border-line pb-2.5">
              <div>
                <small className="block text-[11.5px] leading-normal text-ink-3">Sep so far</small>
                <Money amount={SHOPPING} className="block font-display text-[21px] leading-[1.1] font-extrabold tracking-[-0.02em] text-ink" />
              </div>
              <div>
                <small className="block text-[11.5px] leading-normal text-ink-3">typical</small>
                <Money amount={TYPICAL} className="block font-display text-[16px] leading-[1.1] font-extrabold tracking-[-0.02em] text-ink-2" />
              </div>
            </div>
            <div>
              <ShoppingBar />
              <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11.5px] leading-normal text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="inline-block h-2.5 w-3 flex-none rounded-[2px] border border-ink bg-chart-1" />
                  Reviewed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden
                    className="inline-block h-2.5 w-3 flex-none rounded-[2px] border border-ink bg-[repeating-linear-gradient(135deg,var(--surface)_0_2px,var(--hatch-stripe)_2px_3.5px)]"
                  />
                  <span>
                    Amazon <Money amount={WAITING} /> · waiting for review
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="inline-block h-3 w-0.5 flex-none border-l-[1.6px] border-dotted border-ink" />
                  Typical (median Jun–Aug)
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-dashed border-line pt-3 font-mono text-[11.5px] leading-[1.5] font-medium text-ink-3">
            <span className="min-w-0">
              from ledger query: spending by category, Sep vs typical; 9 transactions
            </span>
            <span className="ml-auto border-b border-line-strong font-sans text-[12.5px] font-semibold whitespace-nowrap text-ink">
              Open the 9 rows →
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
