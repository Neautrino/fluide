import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AddRuleCard } from '../components/rules/AddRuleCard'
import { Hero } from '../components/rules/Hero'
import { HowItDecides } from '../components/rules/HowItDecides'
import { MatchesCard } from '../components/rules/MatchesCard'
import { COLUMNS, matchStats, sortRules, type Decide } from '@repo/ui/rules'
import { RulesCard } from '../components/rules/RulesCard'
import { TrustStrip } from '../components/rules/TrustStrip'
import { Notice } from '@repo/ui/primitives'
import { errorMessage, sendJson } from '../lib/api'
import { rulesOptions, useCategories } from '../lib/queries'

const route = getRouteApi('/rules')

export function Rules() {
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const categories = useCategories()
  const rules = useQuery(rulesOptions())
  const [acting, setActing] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const refocus = useRef<number | null>(null)
  const posting = useRef(new Set<string>())

  const list = rules.isError ? undefined : rules.data
  const active = list ? sortRules(list, 'active') : []
  const stats = matchStats(active)

  useEffect(() => {
    const index = refocus.current
    if (index === null || !list) return
    refocus.current = null
    if (document.activeElement && document.activeElement !== document.body) return
    const rows = document.querySelectorAll<HTMLElement>('#rules-panel tbody tr')
    const next = rows[Math.min(index, rows.length - 1)]
    ;(next?.querySelector<HTMLElement>('button') ?? document.getElementById('rules-panel'))?.focus()
  }, [list])

  const settled = !rules.isFetching
  useEffect(() => {
    if (settled) setActing((s) => new Set([...s].filter((id) => posting.current.has(id))))
  }, [settled])
  const decide: Decide = async (rule, decision, from) => {
    if (acting.has(rule.id)) return
    const row = from.closest('tr')
    if (row?.parentElement) refocus.current = Array.from(row.parentElement.children).indexOf(row)
    posting.current.add(rule.id)
    setActing((s) => new Set(s).add(rule.id))
    setActionError(null)
    try {
      await sendJson('POST', `/api/assistant/rules/${rule.id}/${decision}`)
    } catch (e) {
      setActionError(`“${rule.pattern}”: ${errorMessage(e)}`)
    } finally {
      posting.current.delete(rule.id)
      void queryClient.invalidateQueries()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TrustStrip />
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <div className={COLUMNS}>
        <div className="flex min-w-0 flex-col gap-[18px]">{stats.matched > 0 && <Hero stats={stats} />}</div>
        <AddRuleCard rules={list} catalogue={categories.data} onCreated={() => void queryClient.invalidateQueries()} />
      </div>

      <RulesCard
        rules={rules}
        catalogue={categories.data}
        tab={tab}
        onTab={(next) => void navigate({ to: '/rules', search: { tab: next }, resetScroll: false })}
        acting={acting}
        onDecide={decide}
      />

      {list && list.length > 0 && (
        <div className={COLUMNS}>
          <MatchesCard active={active} stats={stats} />
          <HowItDecides className="min-[1100px]:col-start-2" />
        </div>
      )}
    </div>
  )
}
