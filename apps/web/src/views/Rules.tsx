import { useEffect, useRef, useState } from 'react'
import { AddRuleCard } from '../components/rules/AddRuleCard'
import { Hero } from '../components/rules/Hero'
import { HowItDecides } from '../components/rules/HowItDecides'
import { MatchesCard } from '../components/rules/MatchesCard'
import { matchStats, sortRules, type RuleTab } from '../components/rules/model'
import { RulesCard } from '../components/rules/RulesCard'
import { COLUMNS, type Decide } from '../components/rules/shared'
import { TrustStrip } from '../components/rules/TrustStrip'
import { Notice } from '../components/ui/States'
import { errorMessage, getJson, sendJson, type Rule } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories } from '../lib/categories'
import { useResource } from '../lib/useResource'

export function Rules() {
  const { version, invalidate } = useApp()
  const categories = useCategories()
  const rules = useResource(
    (signal) => getJson<{ rules: Rule[] }>('/api/assistant/rules', signal).then((r) => r.rules),
    version,
  )
  const [tab, setTab] = useState<RuleTab>('active')
  const [acting, setActing] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const refocus = useRef<number | null>(null)
  const posting = useRef(new Set<string>())

  const list = rules.data
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

  const settled = !rules.loading
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
      invalidate()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TrustStrip />
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <div className={COLUMNS}>
        <div className="flex min-w-0 flex-col gap-[18px]">{stats.matched > 0 && <Hero stats={stats} />}</div>
        <AddRuleCard rules={list} catalogue={categories.data} onCreated={invalidate} />
      </div>

      <RulesCard rules={rules} catalogue={categories.data} tab={tab} onTab={setTab} acting={acting} onDecide={decide} />

      {list && list.length > 0 && (
        <div className={COLUMNS}>
          <MatchesCard active={active} stats={stats} />
          <HowItDecides className="min-[1100px]:col-start-2" />
        </div>
      )}
    </div>
  )
}
