/** SOURCE OF TRUTH: the confidence gate — the user's binding 3-tier rule.
 * WHAT: decides what happens to a Jev categorization match, based on its
 * confidence band (high/medium/low from jev.ts's bandFor()) AND the
 * existing vendor-history/amount checklist. Tier 1 (deterministic rule
 * match) never goes through this gate -- a rule match is already
 * deterministic, there is nothing to gate.
 * WHY: a single high-confidence-looking match on a brand-new vendor or an
 * unusual amount is exactly the case that should NOT auto-apply -- same
 * "never silently guess" principle as every other tier. This is also
 * where the S1-3 bug lived: the old code discarded anything below a hard
 * 0.95 cutoff with zero record. The user's rule, exactly as given:
 *   >= 0.75 confidence -> can auto-apply (still gated by vendor/amount
 *     history below -- confidence alone isn't enough on a brand-new
 *     vendor).
 *   0.50 <= confidence < 0.75 -> never auto-apply. Always show the
 *     suggested category, flagged for review.
 *   < 0.50 -> never auto-apply, no suggestion shown. Posting stays plain
 *     uncategorized, separately flagged for review.
 * WHERE: categorize.ts calls this after a Jev match is found, before
 * deciding whether to write postings.categoryId, insert into
 * review_queue (with a suggestion), or leave the posting untouched and
 * flagged. Does not touch Tier 1's write path.
 */
import { db, postings, transactions, reviewQueue } from '@repo/ledger'
import { and, eq } from 'drizzle-orm'
import type { CategorizationMatch } from './jev.js'

const MIN_VENDOR_OCCURRENCES = 3
const AMOUNT_RANGE_TOLERANCE = 0.5

export type GateOutcome =
  | { action: 'auto_apply' }
  | { action: 'queue_with_suggestion'; reason: string }
  | { action: 'queue_uncategorized'; reason: string }

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
 * Only 'high' band is eligible for the existing vendor-history/amount
 * checklist to decide auto-apply vs queue. */
export async function evaluateGate(
  tenantId: string,
  counterpartyRaw: string,
  candidateAmount: number,
  match: CategorizationMatch,
): Promise<GateOutcome> {
  if (match.band === 'low') {
    return {
      action: 'queue_uncategorized',
      reason: `Jev confidence ${match.confidence.toFixed(2)} is below 0.50 -- no category suggested, flagged for review`,
    }
  }

  if (match.band === 'medium') {
    return {
      action: 'queue_with_suggestion',
      reason: `Jev confidence ${match.confidence.toFixed(2)} is in the 0.50-0.75 review band -- suggestion shown, needs human confirmation`,
    }
  }

  // high band: still subject to the vendor-history/amount checklist --
  // confidence alone doesn't justify auto-applying to a brand-new vendor.
  const history = await vendorCategoryHistory(tenantId, counterpartyRaw, match.categoryId)

  if (history.length < MIN_VENDOR_OCCURRENCES) {
    return {
      action: 'queue_with_suggestion',
      reason: `vendor "${counterpartyRaw}" has only ${history.length} prior categorized posting(s) in this category, need ${MIN_VENDOR_OCCURRENCES}`,
    }
  }

  const min = Math.min(...history)
  const max = Math.max(...history)
  const spread = Math.max(max - min, Math.abs(max) * AMOUNT_RANGE_TOLERANCE, 1)
  const lower = min - spread
  const upper = max + spread

  if (candidateAmount < lower || candidateAmount > upper) {
    return {
      action: 'queue_with_suggestion',
      reason: `amount ${candidateAmount} is outside the historical range [${lower.toFixed(2)}, ${upper.toFixed(2)}] for this vendor/category`,
    }
  }

  return { action: 'auto_apply' }
}

export async function queueForReview(
  postingId: string,
  match: CategorizationMatch,
  reason: string,
  suggestedCategoryId: string | null,
): Promise<void> {
  await db.insert(reviewQueue).values([
    {
      postingId,
      suggestedCategoryId,
      confidenceBand: match.band,
      source: match.source,
      confidence: match.confidence.toFixed(3),
      reason,
    },
  ])
}
