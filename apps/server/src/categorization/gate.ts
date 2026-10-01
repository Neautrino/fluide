/* SOURCE OF TRUTH: the confidence gate: whether a Jev answer auto-applies or goes to review.
 * Invariant: thresholds come only from the tenant's gate_settings, never constants here.
 * See: ADR 002 — the user's binding 3-tier rule and its defaults
 */
import { db, postings, transactions, reviewQueue, liveTransaction, type DbExecutor, type GateSettings } from '@repo/ledger'
import { and, eq } from 'drizzle-orm'
import type { CategorizationMatch } from './jev.js'

export type ConfidenceBand = 'high' | 'medium' | 'low'

export type GateOutcome =
  | { action: 'auto_apply'; band: ConfidenceBand; reason: string }
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
        liveTransaction,
      ),
    )
  return rows.map((r) => Number(r.amount))
}

/** The user's 3-tier rule. 'low' band never auto-applies or shows a
 * suggestion; 'medium' band is always queued with the suggestion shown.
 * Only 'high' band auto-applies, on first sight of a vendor too; when the
 * vendor already has categorized postings in this category, the amount
 * must also fit their range. */
export async function evaluateGate(
  tenantId: string,
  counterpartyRaw: string,
  candidateAmount: number,
  match: CategorizationMatch,
  settings: GateSettings,
): Promise<GateOutcome> {
  const { highConfidence, lowConfidence, amountRangeTolerance } = settings
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

  const history = await vendorCategoryHistory(tenantId, counterpartyRaw, match.categoryId)
  if (history.length === 0) {
    return {
      action: 'auto_apply',
      band: 'high',
      reason: `confidence ${confidence} is in the high band; no prior posting of vendor "${counterpartyRaw}" in this category, so no amount range to check`,
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

  return {
    action: 'auto_apply',
    band: 'high',
    reason: `confidence ${confidence} is in the high band and amount ${candidateAmount} is within the historical range [${lower.toFixed(2)}, ${upper.toFixed(2)}] for this vendor/category`,
  }
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
