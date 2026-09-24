/** SOURCE OF TRUTH: the confidence gate — the user's binding 3-tier rule.
 * WHAT: decides what happens to a Jev categorization match. It bands the
 * raw confidence with the tenant's saved thresholds (gate_settings, edited
 * on the Settings screen) and, for the high band, applies the
 * vendor-history/amount checklist. Tier 1 (deterministic rule match) never
 * goes through this gate -- a rule match is already deterministic, there
 * is nothing to gate.
 * WHY: a single high-confidence-looking match on a brand-new vendor or an
 * unusual amount is exactly the case that should NOT auto-apply -- same
 * "never silently guess" principle as every other tier. The user's rule,
 * with the defaults from GATE_SETTINGS_DEFAULTS:
 *   >= highConfidence (0.75) -> can auto-apply, still gated by vendor
 *     history (minVendorOccurrences) and amount range
 *     (amountRangeTolerance) -- confidence alone isn't enough.
 *   lowConfidence (0.50) <= confidence < highConfidence -> never
 *     auto-apply. Always show the suggested category, flagged for review.
 *   < lowConfidence -> never auto-apply, no suggestion shown. Posting stays
 *     plain uncategorized, separately flagged for review.
 * Thresholds are read from the DB, never hard-coded here (PLAN.md §5.2:
 * visible and admin-configurable).
 * WHERE: categorize.ts calls this after a Jev match is found, before
 * deciding whether to write postings.categoryId, insert into
 * review_queue (with a suggestion), or leave the posting untouched and
 * flagged. Does not touch Tier 1's write path.
 */
import { db, postings, transactions, reviewQueue, type DbExecutor, type GateSettings } from '@repo/ledger'
import { and, eq } from 'drizzle-orm'
import type { CategorizationMatch } from './jev.js'

export type ConfidenceBand = 'high' | 'medium' | 'low'

export type GateOutcome =
  | { action: 'auto_apply'; band: ConfidenceBand }
  | { action: 'queue_with_suggestion'; band: ConfidenceBand; reason: string }
  | { action: 'queue_uncategorized'; band: ConfidenceBand; reason: string }

async function vendorCategoryHistory(tenantId: string, counterpartyRaw: string, categoryId: string) {
  const rows = await db
    .select({ amount: postings.amount })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        eq(postings.counterpartyRaw, counterpartyRaw),
        eq(postings.categoryId, categoryId),
      ),
    )
  return rows.map((r) => Number(r.amount))
}

/** The user's 3-tier rule. 'low' band never reaches the vendor/amount
 * checklist at all -- it's excluded from auto-apply and from showing a
 * suggestion by confidence alone, per the rule as given. 'medium' band
 * also never auto-applies (always queued with the suggestion shown,
 * regardless of vendor history) -- that's the whole point of the band.
 * Only 'high' band is eligible for the vendor-history/amount checklist to
 * decide auto-apply vs queue. */
export async function evaluateGate(
  tenantId: string,
  counterpartyRaw: string,
  candidateAmount: number,
  match: CategorizationMatch,
  settings: GateSettings,
): Promise<GateOutcome> {
  const { highConfidence, lowConfidence, minVendorOccurrences, amountRangeTolerance } = settings
  const confidence = match.confidence.toFixed(2)

  if (match.confidence < lowConfidence) {
    return {
      action: 'queue_uncategorized',
      band: 'low',
      reason: `Jev confidence ${confidence} is below ${lowConfidence.toFixed(2)} -- no category suggested, flagged for review`,
    }
  }

  if (match.confidence < highConfidence) {
    return {
      action: 'queue_with_suggestion',
      band: 'medium',
      reason: `Jev confidence ${confidence} is in the ${lowConfidence.toFixed(2)}-${highConfidence.toFixed(2)} review band -- suggestion shown, needs human confirmation`,
    }
  }

  // high band: still subject to the vendor-history/amount checklist --
  // confidence alone doesn't justify auto-applying to a brand-new vendor.
  const history = await vendorCategoryHistory(tenantId, counterpartyRaw, match.categoryId)

  if (history.length < minVendorOccurrences) {
    return {
      action: 'queue_with_suggestion',
      band: 'high',
      reason: `vendor "${counterpartyRaw}" has only ${history.length} prior categorized posting(s) in this category, need ${minVendorOccurrences}`,
    }
  }

  const min = Math.min(...history)
  const max = Math.max(...history)
  const spread = Math.max(max - min, Math.abs(max) * amountRangeTolerance, 1)
  const lower = min - spread
  const upper = max + spread

  if (candidateAmount < lower || candidateAmount > upper) {
    return {
      action: 'queue_with_suggestion',
      band: 'high',
      reason: `amount ${candidateAmount} is outside the historical range [${lower.toFixed(2)}, ${upper.toFixed(2)}] for this vendor/category`,
    }
  }

  return { action: 'auto_apply', band: 'high' }
}

export async function queueForReview(
  entry: {
    postingId: string
    match: CategorizationMatch
    band: ConfidenceBand
    reason: string
    suggestedCategoryId: string | null
  },
  executor: DbExecutor,
): Promise<void> {
  await executor.insert(reviewQueue).values([
    {
      postingId: entry.postingId,
      suggestedCategoryId: entry.suggestedCategoryId,
      confidenceBand: entry.band,
      source: entry.match.source,
      confidence: entry.match.confidence.toFixed(3),
      reason: entry.reason,
    },
  ])
}
