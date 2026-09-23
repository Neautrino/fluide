/** SOURCE OF TRUTH: the S1-4 confidence gate.
 * WHAT: decides whether a Tier 2/3 categorization match auto-applies to
 * postings.categoryId, or is written to review_queue instead. Tier 1
 * (deterministic rule match) never goes through this gate -- a rule match
 * is already deterministic, there is nothing to gate.
 * WHY: a single high-confidence-looking match on a brand-new vendor or an
 * unusual amount is exactly the case that should NOT auto-apply -- same
 * "never silently guess" principle as every other tier. The checklist
 * (confidence + vendor seen 3+ times + amount in the vendor's historical
 * range) all have to pass, not just the raw similarity/confidence number.
 * WHERE: categorize.ts calls this after a Tier 2/3 match is found, before
 * deciding whether to write postings.categoryId or insert into
 * review_queue. Does not touch Tier 1's write path.
 */
import { db, postings, transactions, reviewQueue } from '@repo/ledger'
import { and, eq } from 'drizzle-orm'
import type { CategorizationMatch } from './fallback.js'

const MIN_VENDOR_OCCURRENCES = 3
const AMOUNT_RANGE_TOLERANCE = 0.5

export type GateDecision = { autoApply: true } | { autoApply: false; reason: string }

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

export async function evaluateGate(
  tenantId: string,
  counterpartyRaw: string,
  candidateAmount: number,
  match: CategorizationMatch,
): Promise<GateDecision> {
  const history = await vendorCategoryHistory(tenantId, counterpartyRaw, match.categoryId)

  if (history.length < MIN_VENDOR_OCCURRENCES) {
    return {
      autoApply: false,
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
      autoApply: false,
      reason: `amount ${candidateAmount} is outside the historical range [${lower.toFixed(2)}, ${upper.toFixed(2)}] for this vendor/category`,
    }
  }

  return { autoApply: true }
}

export async function queueForReview(
  postingId: string,
  match: CategorizationMatch,
  reason: string,
): Promise<void> {
  await db.insert(reviewQueue).values([
    {
      postingId,
      suggestedCategoryId: match.categoryId,
      source: match.source,
      confidence: match.confidence.toFixed(3),
      reason,
    },
  ])
}
