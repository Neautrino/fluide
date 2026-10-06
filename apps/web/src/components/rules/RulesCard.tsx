import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { Empty, ErrorState, Loading } from '@repo/ui/primitives'
import { categoryLabel, CARD, CardHead, lastMatchAt, RuleRow, RulesTableHead, sortRules, type Decide, type RuleTab } from '@repo/ui/rules'
import type { CategoryCatalogue } from '@repo/ui/categories'
import { formatLocalDate } from '@repo/ui/format'
import type { Rule } from '@repo/ui/types'
import { queryError } from '../../lib/queries'
import { PANEL_ID, RuleTabs } from './RuleTabs'

const EMPTY: Record<RuleTab, string> = {
  active: 'No active rules yet. Approving a suggestion saves one, or add your own.',
  off: 'No rules turned off.',
}

const NOTE: Record<RuleTab, string> = {
  active: 'Rules run first. Yours win over learned ones; among equals, the rule that has matched more wins.',
  off: 'Rules that are off never run. Turning one on applies it to transactions categorized from now on; it does not change past ones.',
}

type Props = {
  rules: UseQueryResult<Rule[]>
  catalogue: CategoryCatalogue | undefined
  tab: RuleTab
  onTab: (tab: RuleTab) => void
  acting: ReadonlySet<string>
  onDecide: Decide
}

export function RulesCard({ rules, catalogue, tab, onTab, acting, onDecide }: Props) {
  const [query, setQuery] = useState('')
  const all = rules.isError ? undefined : rules.data
  const active = all ? sortRules(all, 'active') : []
  const inTab = all ? sortRules(all, tab) : []
  const counts = all ? { active: active.length, off: sortRules(all, 'off').length } : null
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
        {rules.isError ? (
          <ErrorState title="Couldn’t load rules" message={queryError(rules)} onRetry={() => void rules.refetch()} />
        ) : !all ? (
          <Loading rows={4} label="Loading rules…" />
        ) : shown.length === 0 ? (
          <Empty title={q ? `No rules match “${query.trim()}”.` : EMPTY[tab]} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <RulesTableHead />
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
            {NOTE[tab]}
          </p>
        )}
      </div>
    </section>
  )
}
