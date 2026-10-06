/* The landing's sample world (today = Tue 29 Sep 2026, 14:00 UTC), as the props the real @repo/ui components
   take. Derived from ./fixtures.ts the same way apps/web derives them from its queries (views/Overview.tsx,
   components/overview/*, views/Review.tsx, components/assistant/TrustLine.tsx), so every view agrees with the
   others. The fixtures carry the landing's figures (Checking ••4821 $8,412.37, Savings ••0917 $24,150.00,
   Sapphire ••3390 $1,284.55, Sept out $3,918.64 / in $6,240.00, the four review items). One adjustment: the
   waiting $203.75 Amazon purchase counts under Shopping (not its bank tag), and Shopping's typical is $421.50,
   so September Shopping reads $581.90, +38% — the riser the donut highlights and the hero question asks about.
   @repo/ui's SampleAnswer hard-codes its own Shopping figures ($548.20 vs $397.00, +38%). */
import type { ComponentProps } from 'react'
import { creditUsage, isLive, totalsByCurrency } from '@repo/ui/accounts'
import type { TrustFlag } from '@repo/ui/assistant'
import { buildCatalogue } from '@repo/ui/categories'
import { chipText, shortName, summarizeConnections } from '@repo/ui/connection-health'
import { countedIn, freshness, oldestOf, toLatest, type CashOnHandCard, type Latest, type NeedsYouStripView, type OwnAndOweCard } from '@repo/ui/overview'
import { atStakeByCurrency, tilesFor, type QueueCard } from '@repo/ui/review'
import type { AccountBalance, ConfidenceBand, PostingAccount, ReviewItem } from '@repo/ui/types'
import { noop } from '../../lib/noop'
import {
  accountBalances,
  cashflow,
  categories,
  connections,
  gate,
  postingAccountList,
  reviewQueue,
  threads,
  transactionCount,
  transactions,
  transfers,
  uncategorizedCount,
} from './fixtures'

export { accountBalances, cashflow, categories, connections, gate, reviewQueue, threads, transactionCount, transactions, transfers, uncategorizedCount }

/** The sample world's clock: pass it wherever a component takes `now`. */
export const NOW = Date.UTC(2026, 8, 29, 14, 0, 0)
export const CURRENCY = 'USD'

export const catalogue = buildCatalogue(categories)
export const connectionSummary = summarizeConnections(connections, NOW)
export const fresh = freshness(accountBalances, connections, NOW)
/** Auto-file gate: suggestions at or above this confidence are filed without asking. */
export const threshold = gate.highConfidence
export const gateBounds = { high: gate.highConfidence, low: gate.lowConfidence }

/** The Overview's Latest card: the newest rows, with totals over the whole ledger. */
export const latest: Latest = { ...toLatest(transactions), total: transactionCount, uncategorized: uncategorizedCount }

const live = accountBalances.filter(isLive)
const counted = countedIn(accountBalances, CURRENCY)
/** Display-currency totals over live accounts: cash, owed, net worth. */
export const mainTotals = totalsByCurrency(live).find((t) => t.currency === CURRENCY)

export const cashOnHandProps = {
  cash: mainTotals?.cash ?? 0,
  currency: CURRENCY,
  count: counted.filter((b) => b.kind === 'cash').length,
  fresh,
  ready: true,
} satisfies Partial<ComponentProps<typeof CashOnHandCard>>

const count = (kind: AccountBalance['kind']) => counted.filter((b) => b.kind === kind).length
const counts = { cash: count('cash'), investment: count('investment'), credit: count('credit'), loan: count('loan'), other: 0 }
counts.other = counted.length - counts.cash - counts.investment - counts.credit - counts.loan

export const ownAndOweProps = {
  currency: CURRENCY,
  totals: mainTotals,
  counts,
  usage: creditUsage(counted),
  oldestInput: oldestOf(counted.map((b) => b.bankBalanceAt ?? b.lastSyncedAt)),
  held: totalsByCurrency(live)
    .filter((t) => t.currency !== CURRENCY)
    .map((t) => ({
      currency: t.currency,
      net: t.net,
      banks: [...new Set(countedIn(accountBalances, t.currency).map((b) => shortName(b.institutionName ?? 'Bank')))].join(', '),
      stale: false,
    })),
  ready: true,
} satisfies Partial<ComponentProps<typeof OwnAndOweCard>>

export const needsYouProps = {
  summary: { live: connectionSummary.live.length, attention: connectionSummary.attention, syncStamp: connectionSummary.syncStamp },
  suggestions: reviewQueue.length,
  atStake: atStakeByCurrency(reviewQueue),
  transferCount: transfers.reduce((n, g) => n + g.rows.length, 0),
  transferTotals: transfers.map((g) => ({ currency: g.currency, total: g.rows.reduce((sum, r) => sum + Math.abs(r.amount), 0) })),
  failed: [],
} satisfies Partial<ComponentProps<typeof NeedsYouStripView>>

/* ---- Review */
export const postingAccounts = new Map<string, PostingAccount>(postingAccountList)
export const stake = atStakeByCurrency(reviewQueue)
export const reviewTiles = tilesFor(reviewQueue, postingAccounts)
export const bandCounts: Record<ConfidenceBand, number> = { high: 0, medium: 0, low: 0 }
for (const i of reviewQueue) bandCounts[i.confidenceBand] += 1
const byVendor = new Map<string, number>()
for (const i of reviewQueue) {
  const k = i.posting?.counterpartyRaw?.toLowerCase()
  if (k) byVendor.set(k, (byVendor.get(k) ?? 0) + 1)
}

/** Every prop QueueCard takes for one queue item, handlers as no-ops. */
export function queueCardProps(item: ReviewItem): ComponentProps<typeof QueueCard> {
  return {
    item,
    catalogue,
    catalogueFailed: false,
    threshold,
    account: postingAccounts.get(item.postingId)?.name,
    sameVendor: byVendor.get(item.posting?.counterpartyRaw?.toLowerCase() ?? '') ?? 1,
    disabled: false,
    pendingKind: null,
    onApprove: noop,
    onReject: noop,
    onFile: noop,
  }
}

export type SampleMerchant = 'Gusto' | 'Amazon' | 'Steam' | 'Corner Deli'

/** QueueCard props for one of the four waiting items, by the merchant the landing names it by. */
export function reviewCardProps(merchant: SampleMerchant): ComponentProps<typeof QueueCard> {
  const item = reviewQueue.find((i) => (i.posting?.counterpartyRaw ?? '').toLowerCase().includes(merchant.toLowerCase()))
  if (!item) throw new Error(`No sample review item for ${merchant}`)
  return queueCardProps(item)
}

/** The Assistant's trust line (apps/web components/assistant/TrustLine.tsx). */
export const assistantTrustProps = {
  flags: connectionSummary.attention.map(({ connection: c, health }): TrustFlag => ({ id: c.id, text: chipText(c, health), severity: health.severity })),
  others: connectionSummary.live.length - connectionSummary.attention.length,
  syncStamp: connectionSummary.syncStamp,
  waiting: reviewQueue.length,
}
