import type { Rule } from '../../lib/api'
import type { CategoryCatalogue } from '../../lib/categories'

const TILES = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4'] as const

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' })

export function categoryLabel(catalogue: CategoryCatalogue | undefined, categoryId: string): string {
  return catalogue?.byId[categoryId]?.label ?? '—'
}

/** One tile color per category group, stable across renders and rules. */
export function tileClass(catalogue: CategoryCatalogue | undefined, categoryId: string): string {
  const primary = catalogue?.byId[categoryId]?.primary
  if (!primary) return TILES[2]
  let h = 0
  for (const ch of primary) h = (h * 31 + ch.charCodeAt(0)) % TILES.length
  return TILES[h]
}

export function dayParts(iso: string): { day: string; month: string } | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : { day: String(d.getDate()), month: monthFormat.format(d) }
}

const time = (iso: string) => new Date(iso).getTime() || 0

export type RuleTab = 'active' | 'off'

/** Active: busiest first. Off: most recently turned off first (updatedAt is the decision time). */
export function sortRules(list: Rule[], tab: RuleTab): Rule[] {
  if (tab === 'active') {
    return list
      .filter((r) => r.status === 'active')
      .sort((a, b) => b.timesMatched - a.timesMatched || time(b.createdAt) - time(a.createdAt))
  }
  return list.filter((r) => r.status !== 'active').sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
}

/** updatedAt is written only by the match counter and by the decision, so for an active rule that has matched it is the last match. */
export function lastMatchAt(rule: Rule): string | null {
  return rule.status === 'active' && rule.timesMatched > 0 ? rule.updatedAt : null
}

export type MatchStats = {
  active: number
  matched: number
  userRules: number
  userMatched: number
  learnedRules: number
  learnedMatched: number
}

export function matchStats(active: Rule[]): MatchStats {
  const s: MatchStats = { active: active.length, matched: 0, userRules: 0, userMatched: 0, learnedRules: 0, learnedMatched: 0 }
  for (const r of active) {
    s.matched += r.timesMatched
    if (r.isUserCustom) {
      s.userRules++
      s.userMatched += r.timesMatched
    } else {
      s.learnedRules++
      s.learnedMatched += r.timesMatched
    }
  }
  return s
}

export type PatternCheck = {
  ready: boolean
  /** Why Create is disabled; null when the pattern is fine, still empty, or the rules list has not loaded. */
  blocker: string | null
  /** Things the user should know about how the server matches this text; they never block. */
  notes: string[]
}

const MIN_PATTERN = 3

/** Mirrors what the server's `counterpartyRaw ILIKE '%' || pattern || '%'` would do with the text. */
export function checkPattern(raw: string, rules: Rule[] | undefined): PatternCheck {
  const p = raw.trim()
  const notes: string[] = []
  if (/[%_]/.test(p)) notes.push('“%” matches any run of text and “_” any single character, so this can match more than you type.')
  if (p.includes('*')) notes.push('“*” is matched literally, not as a wildcard.')
  if (p.includes('\\')) notes.push('“\\” escapes the next character; type “\\\\” to match a backslash.')
  const block = (blocker: string): PatternCheck => ({ ready: false, blocker, notes })
  if (!p || !rules) return { ready: false, blocker: null, notes }
  if (p.length < MIN_PATTERN) return block('Type at least 3 characters.')
  if (/^[%_]+$/.test(p)) return block('Add some text besides “%” and “_”.')
  if ((p.match(/\\+$/)?.[0].length ?? 0) % 2 === 1) return block('A pattern can’t end with a single “\\”.')
  const lower = p.toLowerCase()
  const twin = rules.find((r) => r.status !== 'rejected' && r.pattern.trim().toLowerCase() === lower)
  if (twin) return block(`Already covered by ${twin.status} rule “${twin.pattern}”.`)
  return { ready: true, blocker: null, notes }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}
