import type { CategoryCatalogue } from '../../lib/categories'
import { formatConfidence, formatLocalDate } from '../../lib/format'
import type { Rule } from '../../types'
import { Button } from '../ui/Button'
import { categoryLabel, lastMatchAt, tileClass } from './model'
import { DateChip, SparkIcon, UserIcon, type Decide } from './shared'

const TH = 'px-2 max-[1360px]:px-1.5 pb-2 align-bottom text-[11px] font-semibold tracking-[.07em] text-ink-3 uppercase border-b border-line'
const TAG = 'inline-flex items-center gap-[5px] rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap'

export function RulesTableHead() {
  return (
    <thead>
      <tr className="text-left">
        <th scope="col" className={`${TH} pl-0.5 text-left`}>
          Last match · pattern
        </th>
        <th scope="col" className={`${TH} text-left`}>
          Category
        </th>
        <th scope="col" className={`${TH} text-left`}>
          Origin
        </th>
        <th scope="col" className={`${TH} text-right`}>
          Times matched
        </th>
        <th scope="col" className={`${TH} text-right`}>
          Learned conf.
        </th>
        <th scope="col" className={`${TH} text-right`}>
          <span className="sr-only">Status and actions</span>
        </th>
      </tr>
    </thead>
  )
}

export function RuleRow({
  rule,
  catalogue,
  max,
  isBusiest,
  busy,
  onDecide,
}: {
  rule: Rule
  catalogue: CategoryCatalogue | undefined
  /** Times matched by the busiest active rule: the bars are shares of it. */
  max: number
  isBusiest: boolean
  busy: boolean
  onDecide: Decide
}) {
  const off = rule.status !== 'active'
  const cell = `border-b border-line px-2 py-[9px] align-middle max-[1360px]:px-1.5 ${off ? 'text-ink-3' : ''}`
  const conf = formatConfidence(rule.confidenceLearned)
  const originDate = off
    ? `turned off ${formatLocalDate(rule.updatedAt)}`
    : `${rule.isUserCustom ? 'created' : 'learned'} ${formatLocalDate(rule.createdAt)}`

  return (
    <tr className="[&:last-child>td]:border-b-0">
      <td className={`${cell} pl-0.5`}>
        <div className="flex min-w-0 items-center gap-[11px]">
          <DateChip iso={lastMatchAt(rule)} />
          <div className="min-w-0">
            <code
              title={rule.pattern}
              className={`inline-block max-w-[160px] truncate rounded-sm border border-line bg-surface-2 px-2 py-[3px] align-top font-mono text-[12.5px] font-medium ${
                off ? 'line-through decoration-1' : ''
              }`}
            >
              {rule.pattern}
            </code>
            <span className="mt-[3px] block text-[11px] text-ink-3">contains, in merchant text</span>
          </div>
        </div>
      </td>
      <td className={cell}>
        <span className="inline-flex items-center gap-1.5 rounded-[12px] border border-line-strong py-0.5 pr-2.5 pl-1 text-[12px] font-semibold">
          <i aria-hidden className={`size-4 shrink-0 rounded-full border border-tile-ink ${tileClass(catalogue, rule.categoryId)}`} />
          {categoryLabel(catalogue, rule.categoryId)}
        </span>
      </td>
      <td className={cell}>
        {rule.isUserCustom ? (
          <span className={`${TAG} border-line-strong text-ink`}>
            <UserIcon />
            You
          </span>
        ) : (
          <span className={`${TAG} border-dashed border-ink-3 text-ink-2`}>
            <SparkIcon />
            Learned
          </span>
        )}
        <small className="mt-[3px] block text-[11px] text-ink-3">{originDate}</small>
      </td>
      <td className={`${cell} text-right`}>
        {rule.status === 'active' ? (
          <div className="flex items-center justify-end gap-2">
            <svg aria-hidden viewBox="0 0 64 10" className="block h-2.5 w-[60px] max-[1360px]:w-10">
              <rect width="64" height="10" rx="2" className="fill-chart-grid" />
              <rect
                width={max > 0 ? (64 * rule.timesMatched) / max : 0}
                height="10"
                rx="2"
                className={isBusiest ? 'fill-chart-1' : 'fill-chart-muted'}
              />
            </svg>
            <span className="figures min-w-5 text-right font-semibold">{rule.timesMatched}</span>
          </div>
        ) : (
          <span className="text-ink-3">–</span>
        )}
      </td>
      <td className={`${cell} text-right`}>
        {conf ? (
          <span className="figures font-semibold">{conf}</span>
        ) : (
          <>
            <span className="text-ink-3">–</span>
            {rule.isUserCustom && <small className="block text-[11px] font-normal text-ink-3">you wrote it</small>}
          </>
        )}
      </td>
      <td className={`${cell} text-right`}>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {off ? (
            <>
              <span className="rounded-[8px] border border-line px-[7px] py-0.5 text-[10.5px] font-bold tracking-[.05em] whitespace-nowrap text-ink-3 uppercase">
                Off
              </span>
              <Button size="sm" busy={busy} onClick={(e) => onDecide(rule, 'activate', e.currentTarget)}>
                Turn on
              </Button>
            </>
          ) : (
            <>
              <span className="rounded-[8px] bg-positive-wash px-[7px] py-0.5 text-[10.5px] font-bold tracking-[.05em] whitespace-nowrap text-positive uppercase">
                Active
              </span>
              <Button size="sm" busy={busy} onClick={(e) => onDecide(rule, 'reject', e.currentTarget)}>
                Turn off
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
