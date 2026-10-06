import type { AccountBalance, CashFlow, ConnectionSummary, NotCountedKind, ReviewItem } from '../../types'
import { summarizeConnections, syncedText } from '../../lib/connection-health'
import { isLive } from '../accounts/model'
import { topRiser, type Mover } from '../cashflow/movers'
import { niceStep } from '../cashflow/shared'

export const NOT_COUNTED_LABEL: Record<NotCountedKind, string> = {
  between_accounts: 'moved between your accounts',
  card_payoffs: 'card payments',
  invested: 'moved to investments',
  savings: 'moved to savings',
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The stalest of the given timestamps, or null when none is set. */
export function oldestOf(stamps: (string | null)[]): string | null {
  let oldest: string | null = null
  let at = Infinity
  for (const s of stamps) {
    const t = s ? new Date(s).getTime() : Number.NaN
    if (!Number.isNaN(t) && t < at) {
      at = t
      oldest = s
    }
  }
  return oldest
}

/** Live accounts in `currency` whose balance is known and counts toward totals. */
export const countedIn = (accounts: AccountBalance[], currency: string) =>
  accounts.filter((b) => isLive(b) && b.currency === currency && b.countsTowardTotals && b.balance !== null)

export type Fresh = { text: string; broken: boolean }

/** How stale the picture is: the connections' own stamp (oldest sync, never-synced logins), else the oldest account sync. */
export function freshness(accounts: AccountBalance[] | undefined, connections: ConnectionSummary[] | undefined, now: number): Fresh | null {
  if (connections) {
    const summary = summarizeConnections(connections, now)
    if (summary.syncStamp) return { text: summary.syncStamp, broken: summary.broken.length > 0 }
  }
  const at = oldestOf((accounts ?? []).filter(isLive).map((b) => b.lastSyncedAt))
  return at ? { text: syncedText(at, now), broken: false } : null
}

/** Queue items whose transaction falls in `month`, the month a card reports on. */
export const itemsInMonth = (items: ReviewItem[], month: string) => items.filter((i) => i.posting?.date.slice(0, 7) === month)

/** The category that grew against its typical spend, if it is one the assistant can be asked about. */
export function risingCategory(flow: CashFlow): (Mover & { pct: number }) | null {
  const top = topRiser(flow.categories)
  if (!top || top.change === null || top.change <= 0) return null
  if (top.label === 'Uncategorized' && !top.fromBank) return null
  return { ...top, pct: Math.round(top.change * 100) }
}

export type Bar = { month: string; value: number; partial: boolean }

export const chartBars = (flow: CashFlow): Bar[] => flow.months.slice(-6).map((m) => ({ month: m.month, value: m.moneyOut, partial: m.partial }))

export const hasHistory = (flow: CashFlow) => flow.months.filter((m) => !m.partial && m.moneyOut > 0).length >= 2

/** What a typical month had spent by this day; null once the month is over or without a baseline. */
export function typicalByNow(flow: CashFlow): number | null {
  if (!flow.partial) return null
  return flow.pace.find((p) => p.day === flow.daysElapsed)?.baseline ?? null
}

export function chartScale(bars: Bar[], typical: number | null): { step: number; top: number } {
  const max = Math.max(0, typical ?? 0, ...bars.map((b) => b.value))
  const step = niceStep(max)
  return { step, top: Math.max(step, Math.ceil(max / step) * step) }
}

export type Slice = { label: string; amount: number; uncategorized: boolean; riser: boolean }

/** Spending categories plus debt payments, biggest first; they add up to money out. */
export function slicesOf(flow: CashFlow, riser: Mover | null): Slice[] {
  const slices: Slice[] = flow.categories
    .filter((c) => c.amount > 0)
    .map((c) => ({ label: c.label, amount: c.amount, uncategorized: c.label === 'Uncategorized' && !c.fromBank, riser: riser?.label === c.label }))
  if (flow.totals.debtPayments > 0) slices.push({ label: 'Debt payments', amount: flow.totals.debtPayments, uncategorized: false, riser: false })
  return slices.sort((a, b) => b.amount - a.amount)
}

export type LegendRow = { kind: 'slice'; slice: Slice } | { kind: 'more'; names: string[]; amount: number }

/** Top four slices, the rest folded into one row unless that would fold at most one; uncategorized money is never folded. */
export function legendRows(slices: Slice[]): { rows: LegendRow[]; uncategorized: Slice | null } {
  const uncategorized = slices.find((s) => s.uncategorized) ?? null
  const rest = slices.filter((s) => !s.uncategorized)
  if (rest.length <= 5) return { rows: rest.map((slice) => ({ kind: 'slice', slice })), uncategorized }
  const folded = rest.slice(4)
  return {
    rows: [
      ...rest.slice(0, 4).map((slice): LegendRow => ({ kind: 'slice', slice })),
      { kind: 'more', names: folded.map((s) => s.label), amount: folded.reduce((sum, s) => sum + s.amount, 0) },
    ],
    uncategorized,
  }
}
