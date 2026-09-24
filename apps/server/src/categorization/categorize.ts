/** SOURCE OF TRUTH: the deterministic categorization pipeline (S1-2),
 * revised to a 2-tier pipeline after removing the embedding tier.
 * WHAT: matches a posting's counterparty text against categorization_rules
 * before any AI involvement (Tier 1). Anything unmatched goes to Jev in a
 * single batched API call (jev.ts's categorizeByJevBatch), gated by
 * the user's 3-tier confidence rule (gate.ts).
 * WHY: a known vendor costs zero AI calls -- same guardrail principle as
 * S0-4. `isUserCustom` rules always win over system rules on a tied match.
 * The embedding-similarity tier (S1-3 Tier 2) was removed after empirical
 * testing showed it never topped ~14% accuracy on real bank-transaction
 * text (see project history: generic MiniLM anchors and a fine-tuned
 * FinBERT variant were both tested and both badly underperformed Jev,
 * which scored 92% on the same class of data). Jev is now the only AI
 * tier -- simpler pipeline, and it was already carrying the real accuracy.
 * WHAT CHANGED: originally called categorizeByJev() one posting at a time
 * in a sequential loop -- with real transaction counts (42 in a first
 * Plaid sync) that took 55-65+ seconds of sequential HTTP round-trips
 * (each one also redundantly re-fetching the categories table), blowing
 * past Bun.serve's default 10s idle timeout and killing the request
 * before it finished. Fixed to batch every Tier-1-unmatched posting into
 * one categorizeByJevBatch() call (~11s for 200 items in earlier testing,
 * chunked under Jev's token ceiling) instead of N sequential calls.
 * WHAT CHANGED (Slice 1 gap fixes): every per-posting write (category
 * update + rule counter + audit row, or queue row + audit row) now runs in
 * its own db.transaction, so a crash can't leave a category without its
 * audit entry -- migration 0004 refuses to commit that anyway. Only
 * status='active' rules are matched (learned rules start 'proposed'), and
 * gate thresholds come from gate_settings, loaded once per run.
 * Postings a human already categorized are never touched: this only ever
 * selects postings whose category_id IS NULL, and a human decision always
 * sets one (PLAN.md §5.2 Tier 3: the AI never overturns a human choice).
 * WHERE: owns rule matching + posting updates + tier orchestration. Rule
 * creation lives in rules.ts; Jev call lives in jev.ts; the confidence
 * gate lives in gate.ts; human approve/reject/recategorize lives in
 * ../review.ts.
 */
import { db, postings, transactions, categorizationRules, reviewQueue, getGateSettings, type GateSettings } from '@repo/ledger'
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { categorizeByJevBatch, type CategorizationMatch } from './jev.js'
import { evaluateGate, queueForReview } from './gate.js'
import { writeAuditLog } from '../audit.js'

export type CategorizeResult = {
  checked: number
  categorized: number
  queuedForReview: number
  uncategorized: number
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

/** Runs a Jev match through the gate and writes the outcome, all in one
 * transaction. Three possible results, matching the user's exact rule:
 *  - auto_apply: postings.categoryId is set directly.
 *  - queue_with_suggestion: postings.categoryId stays NULL, but
 *    review_queue gets a row with the suggested category so a human sees
 *    what Jev thinks it is (review band, or a high-band match that didn't
 *    clear the vendor/amount checklist).
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
): Promise<'applied' | 'queued'> {
  const outcome = await evaluateGate(tenantId, counterpartyRaw, amount, match, settings)

  return db.transaction(async (tx) => {
    if (outcome.action === 'auto_apply') {
      await tx.update(postings).set({ categoryId: match.categoryId }).where(eq(postings.id, postingId))
      await writeAuditLog(
        {
          postingId,
          action: 'auto_applied',
          categoryId: match.categoryId,
          source: match.source,
          confidence: match.confidence,
          reason: `gate passed: confidence band '${outcome.band}' + vendor history + amount range checks satisfied`,
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
 * writing -- auto-apply if confidence is high AND the vendor has enough
 * history AND the amount fits, else queued to review_queue (with or
 * without a suggestion depending on confidence band). A posting where a
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
      await db.transaction(async (tx) => {
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
      })
      byTier.rule++
      categorized++
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
    byTier.jev++
    if (outcome === 'applied') categorized++
    else queuedForReview++
  }

  return {
    checked: candidates.length,
    categorized,
    queuedForReview,
    uncategorized: candidates.length - categorized - queuedForReview,
    byTier,
  }
}
