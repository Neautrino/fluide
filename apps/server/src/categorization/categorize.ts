/* SOURCE OF TRUTH: the categorization pipeline: Tier 1 rule match, then one batched Jev call.
 * Invariant: touches only postings with category_id IS NULL and only status='active' rules.
 * See: ADR 005 (never overturn a human), ADR 016 (why Jev is the only AI tier)
 */
import { db, postings, transactions, categorizationRules, reviewQueue, getGateSettings, liveTransaction, type DbExecutor, type GateSettings } from '@repo/ledger'
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { categorizeByJevBatch, type CategorizationMatch } from './jev.js'
import { evaluateGate, queueForReview } from './gate.js'
import { createJevRuleIfAbsent } from './rules.js'
import { writeAuditLog } from '../audit.js'

export type CategorizeResult = {
  checked: number
  categorized: number
  queuedForReview: number
  uncategorized: number
  /** Postings each tier categorized; items only sent to review are not counted. */
  byTier: { rule: number; jev: number }
}

async function findBestRule(tenantId: string, text: string) {
  const matches = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, tenantId),
        eq(categorizationRules.status, 'active'),
        sql`${text} ILIKE '%' || ${categorizationRules.pattern} || '%'`,
      ),
    )

  if (matches.length === 0) return undefined

  matches.sort((a, b) => {
    if (a.isUserCustom !== b.isUserCustom) return a.isUserCustom ? -1 : 1
    return b.timesMatched - a.timesMatched
  })
  return matches[0]
}

/** Locks the posting and its transaction; false once it is categorized or no longer live. */
async function lockUncategorizedLive(tx: DbExecutor, postingId: string) {
  const [row] = await tx
    .select({ id: postings.id })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(and(eq(postings.id, postingId), isNull(postings.categoryId), liveTransaction))
    .for('update')
  return row !== undefined
}

/** Runs a Jev match through the gate and writes the outcome, all in one
 * transaction. Three possible results, matching the user's exact rule:
 *  - auto_apply: postings.categoryId is set directly, and the vendor gets
 *    an active rule if it has none in any status.
 *  - queue_with_suggestion: postings.categoryId stays NULL, but
 *    review_queue gets a row with the suggested category so a human sees
 *    what Jev thinks it is (review band, or a high-band match whose amount
 *    is outside the vendor's range).
 *  - queue_uncategorized: postings.categoryId stays NULL, review_queue
 *    gets a row with NO suggested category (below the low threshold) --
 *    the posting shows as plain uncategorized in the UI, but it's still
 *    flagged for review, not silently dropped with zero record. */
async function applyOrQueue(
  tenantId: string,
  postingId: string,
  counterpartyRaw: string,
  amount: number,
  match: CategorizationMatch,
  settings: GateSettings,
): Promise<'applied' | 'queued' | 'skipped'> {
  const outcome = await evaluateGate(tenantId, counterpartyRaw, amount, match, settings)

  return db.transaction(async (tx) => {
    if (!(await lockUncategorizedLive(tx, postingId))) return 'skipped'
    if (outcome.action === 'auto_apply') {
      await tx.update(postings).set({ categoryId: match.categoryId }).where(eq(postings.id, postingId))
      const rule = await createJevRuleIfAbsent(
        { tenantId, counterpartyRaw, categoryId: match.categoryId, confidence: match.confidence },
        tx,
      )
      await writeAuditLog(
        {
          postingId,
          action: 'auto_applied',
          categoryId: match.categoryId,
          source: match.source,
          confidence: match.confidence,
          reason: `gate passed: ${outcome.reason}` + (rule ? `; created categorization_rules ${rule.id}` : ''),
          actor: 'system',
        },
        tx,
      )
      return 'applied'
    }

    const suggestedCategoryId = outcome.action === 'queue_with_suggestion' ? match.categoryId : null
    await queueForReview({ postingId, match, band: outcome.band, reason: outcome.reason, suggestedCategoryId }, tx)
    await writeAuditLog(
      {
        postingId,
        action: 'queued_for_review',
        categoryId: suggestedCategoryId,
        source: match.source,
        confidence: match.confidence,
        reason: outcome.reason,
        actor: 'system',
      },
      tx,
    )
    return 'queued'
  })
}

/** Categorizes every uncategorized posting for a tenant through 2 tiers:
 * (1) deterministic active-rule match (applies directly, no gate --
 * already deterministic, and cheap enough to run per-row), (2) Jev,
 * batched into as few HTTP calls as Jev's token budget allows rather than
 * one call per posting. Each Jev match passes through the S1-4 gate before
 * writing -- auto-apply if confidence is high AND (for a vendor with
 * history in that category) the amount fits, else queued to review_queue
 * (with or without a suggestion depending on confidence band). A posting where a
 * batch call fails outright (no API key, network error) is left fully
 * uncategorized and unflagged -- that is a hard failure case, not a
 * confidence judgment. */
export async function categorizeUncategorizedPostings(tenantId: string): Promise<CategorizeResult> {
  const settings = await getGateSettings(tenantId)

  const alreadyQueued = db
    .select({ postingId: reviewQueue.postingId })
    .from(reviewQueue)
    .where(inArray(reviewQueue.status, ['pending', 'rejected']))

  const candidates = await db
    .select({ id: postings.id, counterpartyRaw: postings.counterpartyRaw, amount: postings.amount })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        isNull(postings.categoryId),
        sql`${postings.counterpartyRaw} IS NOT NULL`,
        notInArray(postings.id, alreadyQueued),
        liveTransaction,
      ),
    )

  const byTier = { rule: 0, jev: 0 }
  let categorized = 0
  let queuedForReview = 0

  // Pass 1: deterministic rules. Cheap (DB only), applies directly, no
  // batching needed -- this pass also determines which postings actually
  // need to go to Jev at all.
  const needsJev: { id: string; text: string; amount: number }[] = []

  for (const posting of candidates) {
    const text = posting.counterpartyRaw!
    const amount = Number(posting.amount)

    const rule = await findBestRule(tenantId, text)
    if (rule) {
      const applied = await db.transaction(async (tx) => {
        if (!(await lockUncategorizedLive(tx, posting.id))) return false
        await tx.update(postings).set({ categoryId: rule.categoryId }).where(eq(postings.id, posting.id))
        await tx
          .update(categorizationRules)
          .set({ timesMatched: sql`${categorizationRules.timesMatched} + 1`, updatedAt: new Date() })
          .where(eq(categorizationRules.id, rule.id))
        await writeAuditLog(
          {
            postingId: posting.id,
            action: 'auto_applied',
            categoryId: rule.categoryId,
            source: 'rule',
            confidence: rule.confidenceLearned ? Number(rule.confidenceLearned) : null,
            reason: `matched categorization_rules pattern "${rule.pattern}"`,
            actor: 'system',
          },
          tx,
        )
        return true
      })
      if (applied) {
        byTier.rule++
        categorized++
      }
      continue
    }

    needsJev.push({ id: posting.id, text, amount })
  }

  // Pass 2: everything Tier 1 didn't resolve goes to Jev in as few batched
  // HTTP calls as possible (categorizeByJevBatch chunks internally to stay
  // under Jev's per-request token ceiling) instead of one call per row.
  const jevResults = await categorizeByJevBatch(needsJev.map((p) => ({ id: p.id, text: p.text })))

  for (const posting of needsJev) {
    const jevMatch = jevResults.get(posting.id)
    if (!jevMatch) continue // hard failure for this item -- left uncategorized, unflagged

    const outcome = await applyOrQueue(tenantId, posting.id, posting.text, posting.amount, jevMatch, settings)
    if (outcome === 'skipped') continue
    if (outcome === 'applied') {
      byTier.jev++
      categorized++
    } else queuedForReview++
  }

  return {
    checked: candidates.length,
    categorized,
    queuedForReview,
    uncategorized: candidates.length - categorized - queuedForReview,
    byTier,
  }
}
