import type { ConfidenceBand, ReviewItem } from '../../types'
import { toNumber } from '../../lib/format'
import type { PostingAccount } from '../../types'

export type ReviewFilter = 'all' | ConfidenceBand

export const pct = (n: number) => `${Number((n * 100).toFixed(1))}%`

export const itemAmount = (item: ReviewItem) => toNumber(item.posting?.amount ?? 0)

export const itemName = (item: ReviewItem) => item.posting?.counterpartyRaw || item.posting?.description || 'Unknown merchant'

const utcWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const utcMonth = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })

/** Ledger dates are UTC-midnight calendar days. */
export function ledgerWeekday(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : utcWeekday.format(d)
}

export function dateParts(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: '–', month: '' }
  return { day: String(d.getUTCDate()), month: utcMonth.format(d) }
}

export type AtStake = { currency: string; total: number }

/** Money going out that is still waiting on a decision, per currency (never summed across). */
export function atStakeByCurrency(items: ReviewItem[]): AtStake[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    const amount = itemAmount(item)
    if (item.posting && amount < 0) totals.set(item.posting.currency, (totals.get(item.posting.currency) ?? 0) - amount)
  }
  return [...totals].map(([currency, total]) => ({ currency, total }))
}

export type Tile = { key: string; name: string; currency: string; total: number; waiting: number }

/** Null until every waiting item's account is known, so the tiles always add up to the hero. */
export function tilesFor(items: ReviewItem[], accounts: Map<string, PostingAccount> | undefined): Tile[] | null {
  if (!accounts) return null
  const tiles = new Map<string, Tile>()
  for (const item of items) {
    const a = accounts.get(item.postingId)
    if (!a || !item.posting) return null
    const key = `${a.accountId}:${item.posting.currency}`
    const tile = tiles.get(key) ?? { key, name: a.name, currency: item.posting.currency, total: 0, waiting: 0 }
    tile.waiting += 1
    const amount = itemAmount(item)
    if (amount < 0) tile.total -= amount
    tiles.set(key, tile)
  }
  return [...tiles.values()].filter((t) => t.total > 0).sort((a, b) => b.total - a.total)
}
