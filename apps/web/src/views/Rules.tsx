import { useEffect, useRef, useState } from 'react'
import { AddRuleCard } from '../components/rules/AddRuleCard'
import { Hero } from '../components/rules/Hero'
import { HowItDecides } from '../components/rules/HowItDecides'
import { MatchesCard } from '../components/rules/MatchesCard'
import { matchStats, sortRules } from '../components/rules/model'
import { ProposedTiles } from '../components/rules/ProposedTiles'
import { RulesCard } from '../components/rules/RulesCard'
import { COLUMNS, type Decide } from '../components/rules/shared'
import { TrustStrip } from '../components/rules/TrustStrip'
import { Notice } from '../components/ui/States'
import { errorMessage, getJson, sendJson, type Rule, type RuleStatus } from '../lib/api'
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
  const [tab, setTab] = useState<RuleStatus | null>(null)
  const [acting, setActing] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const refocus = useRef<{ scope: 'tile' | 'row'; index: number } | null>(null)
  const posting = useRef(new Set<string>())

  const list = rules.data
  const proposed = list ? sortRules(list, 'proposed') : []
  const active = list ? sortRules(list, 'active') : []
  const stats = matchStats(active)
  if (tab === null && list) setTab(proposed.length > 0 ? 'proposed' : 'active')

  useEffect(() => {
    const target = refocus.current
    if (!target || !list) return
    refocus.current = null
    if (document.activeElement && document.activeElement !== document.body) return
    const items = document.querySelectorAll<HTMLElement>(target.scope === 'tile' ? '#rules-tiles article' : '#rules-panel tbody tr')
    const next = items[Math.min(target.index, items.length - 1)]
    ;(next?.querySelector<HTMLElement>('button') ?? document.getElementById('rules-panel'))?.focus()
  }, [list])

  const settled = !rules.loading
  useEffect(() => {
    if (settled) setActing((s) => new Set([...s].filter((id) => posting.current.has(id))))
  }, [settled])
  const decide: Decide = async (rule, decision, from) => {
    if (acting.has(rule.id)) return
    const holder = from.closest('article, tr')
    if (holder?.parentElement) {
      refocus.current = {
        scope: holder.tagName === 'ARTICLE' ? 'tile' : 'row',
        index: Array.from(holder.parentElement.children).indexOf(holder),
      }
    }
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
      <TrustStrip proposed={proposed.length} />
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <div className={COLUMNS}>
        <div className="flex min-w-0 flex-col gap-[18px]">
          {stats.matched > 0 && <Hero stats={stats} />}
          {list && <ProposedTiles proposed={proposed} catalogue={categories.data} acting={acting} onDecide={decide} />}
        </div>
        <AddRuleCard rules={list} catalogue={categories.data} onCreated={invalidate} />
      </div>

      <RulesCard rules={rules} catalogue={categories.data} tab={tab ?? 'active'} onTab={setTab} acting={acting} onDecide={decide} />

      {list && list.length > 0 && (
        <div className={COLUMNS}>
          <MatchesCard active={active} stats={stats} />
          <HowItDecides className="min-[1100px]:col-start-2" />
        </div>
      )}
    </div>
  )
}
