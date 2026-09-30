import { useState } from 'react'
import type { Rule, RuleStatus } from '../../lib/api'
import type { CategoryCatalogue } from '../../lib/categories'
import { formatConfidence, formatLocalDate } from '../../lib/format'
import type { Resource } from '../../lib/useResource'
import { Button } from '../ui/Button'
import { Empty, ErrorState, Loading } from '../ui/States'
import { categoryLabel, lastMatchAt, sortRules, tileClass } from './model'
import { PANEL_ID, RuleTabs } from './RuleTabs'
import { CARD, CardHead, DateChip, SparkIcon, UserIcon, type Decide } from './shared'

const EMPTY: Record<RuleStatus, string> = {
  proposed: 'None left. Fluide proposes one when you approve a suggestion or categorize a transaction yourself.',
  active: 'No active rules yet. Activate a proposed one or add your own.',
  rejected: 'Nothing rejected.',
}

const NOTE: Record<RuleStatus, string> = {
  proposed:
    'Proposed rules do nothing until you activate them. Activating applies the category to transactions categorized from now on; it does not change past ones.',
  active: 'Rules run first. Yours win over learned ones; among equals, the rule that has matched more wins.',
  rejected: 'Rejected rules never run and won’t be proposed again.',
}

const HATCH_ROW = 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_srgb,var(--hatch)_var(--hatch-row),transparent)_6px_7px)]'
const TH = 'px-2 max-[1360px]:px-1.5 pb-2 align-bottom text-[11px] font-semibold tracking-[.07em] text-ink-3 uppercase border-b border-line'
const TAG = 'inline-flex items-center gap-[5px] rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap'

type Props = {
  rules: Resource<Rule[]>
  catalogue: CategoryCatalogue | undefined
  tab: RuleStatus
  onTab: (tab: RuleStatus) => void
  acting: ReadonlySet<string>
  onDecide: Decide
}

export function RulesCard({ rules, catalogue, tab, onTab, acting, onDecide }: Props) {
  const [query, setQuery] = useState('')
  const all = rules.data
  const active = all ? sortRules(all, 'active') : []
  const inTab = all ? sortRules(all, tab) : []
  const counts = all
    ? { proposed: sortRules(all, 'proposed').length, active: active.length, rejected: sortRules(all, 'rejected').length }
    : null
  const q = query.trim().toLowerCase()
  const shown = q
    ? inTab.filter((r) => r.pattern.toLowerCase().includes(q) || categoryLabel(catalogue, r.categoryId).toLowerCase().includes(q))
    : inTab
  const busiest = active[0] && active[0].timesMatched > 0 ? active[0] : null
  const newest = active.reduce<string | null>((best, r) => {
    const at = lastMatchAt(r)
    return at && (!best || new Date(at) > new Date(best)) ? at : best
  }, null)

  return (
    <section className={CARD} aria-label="Rules">
      <CardHead title="Rules">
        <RuleTabs value={tab} counts={counts} onChange={onTab} />
        {tab === 'active' && newest && <span className="text-[11.5px] whitespace-nowrap text-ink-3">last match {formatLocalDate(newest)}</span>}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter patterns…"
          aria-label="Filter patterns"
          className="ml-auto h-8 w-[130px] rounded-2xl border border-line bg-surface px-3 text-[12.5px] text-ink placeholder:text-ink-3 focus-visible:border-line-strong min-[1361px]:w-[170px]"
        />
      </CardHead>

      <div role="tabpanel" id={PANEL_ID} tabIndex={-1} aria-labelledby={`rules-tab-${tab}`}>
        {rules.error ? (
          <ErrorState title="Couldn’t load rules" message={rules.error} onRetry={rules.reload} />
        ) : !all ? (
          <Loading rows={4} label="Loading rules…" />
        ) : shown.length === 0 ? (
          <Empty title={q ? `No rules match “${query.trim()}”.` : EMPTY[tab]} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
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
              <tbody>
                {shown.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    catalogue={catalogue}
                    max={busiest?.timesMatched ?? 0}
                    isBusiest={busiest?.id === r.id}
                    busy={acting.has(r.id)}
                    onDecide={onDecide}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {all && (
          <p className="mt-2.5 text-[11.5px] leading-[1.45] text-ink-3">
            {tab === 'active' && busiest && (
              <>
                <b className="font-semibold text-ink-2">Bars</b> are shares of the busiest rule ({busiest.pattern}, {busiest.timesMatched}).{' '}
              </>
            )}
            {tab === 'proposed' && 'Hatched rows are proposed and not applied. '}
            {NOTE[tab]}
          </p>
        )}
      </div>
    </section>
  )
}

type RowProps = {
  rule: Rule
  catalogue: CategoryCatalogue | undefined
  max: number
  isBusiest: boolean
  busy: boolean
  onDecide: Props['onDecide']
}

function RuleRow({ rule, catalogue, max, isBusiest, busy, onDecide }: RowProps) {
  const proposed = rule.status === 'proposed'
  const rejected = rule.status === 'rejected'
  const cell = `border-b border-line px-2 py-[9px] align-middle max-[1360px]:px-1.5 ${proposed ? HATCH_ROW : ''} ${rejected ? 'text-ink-3' : ''}`
  const conf = formatConfidence(rule.confidenceLearned)
  const originDate = rejected
    ? `rejected by you ${formatLocalDate(rule.updatedAt)}`
    : `${rule.isUserCustom ? 'created' : 'proposed'} ${formatLocalDate(rule.createdAt)}`

  return (
    <tr className="[&:last-child>td]:border-b-0">
      <td className={`${cell} pl-0.5`}>
        <div className="flex min-w-0 items-center gap-[11px]">
          <DateChip iso={lastMatchAt(rule)} />
          <div className="min-w-0">
            <code
              title={rule.pattern}
              className={`inline-block max-w-[160px] truncate rounded-sm border px-2 py-[3px] align-top font-mono text-[12.5px] font-medium ${
                proposed ? 'border-dashed border-line-strong bg-surface' : 'border-line bg-surface-2'
              } ${rejected ? 'line-through decoration-1' : ''}`}
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
        {proposed ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button size="sm" variant="primary" busy={busy} onClick={(e) => onDecide(rule, 'activate', e.currentTarget)}>
              Activate
            </Button>
            <Button size="sm" disabled={busy} onClick={(e) => onDecide(rule, 'reject', e.currentTarget)}>
              Reject
            </Button>
          </div>
        ) : rejected ? (
          <span className="rounded-[8px] border border-line px-[7px] py-0.5 text-[10.5px] font-bold tracking-[.05em] whitespace-nowrap text-ink-3 uppercase">
            Rejected
          </span>
        ) : (
          <span className="rounded-[8px] bg-positive-wash px-[7px] py-0.5 text-[10.5px] font-bold tracking-[.05em] whitespace-nowrap text-positive uppercase">
            Active
          </span>
        )}
      </td>
    </tr>
  )
}
