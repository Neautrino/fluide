/** SOURCE OF TRUTH: the deterministic categorization pipeline (S1-2).
 * WHAT: matches a posting's counterparty text against categorization_rules
 * before any AI involvement. S1-3's embedding/Jev fallback tiers live in
 * fallback.ts; S1-4's auto-apply-vs-review-queue gate lives in gate.ts.
 * WHY: a known vendor costs zero AI calls — same guardrail principle as
 * S0-4. `isUserCustom` rules always win over system rules on a tied match.
 * WHERE: owns rule matching + posting updates + tier orchestration. Rule
 * CRUD lives in index.ts routes; embeddings/LLM fallback in fallback.ts;
 * auto-apply gate in gate.ts.
 */
import { db, postings, transactions, categorizationRules, reviewQueue, auditLog } from '@repo/ledger'
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { categorizeByEmbedding, categorizeByJev, type CategorizationMatch } from './fallback.js'
import { evaluateGate, queueForReview } from './gate.js'
import { writeAuditLog } from './audit.js'

export type CategorizeResult = {
  checked: number
  categorized: number
  queuedForReview: number
  uncategorized: number
  byTier: { rule: number; embedding: number; llm: number }
}

async function findBestRule(tenantId: string, text: string) {
  const matches = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, tenantId),
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

async function applyOrQueue(
  tenantId: string,
  postingId: string,
  counterpartyRaw: string,
  amount: number,
  match: CategorizationMatch,
): Promise<'applied' | 'queued'> {
  const decision = await evaluateGate(tenantId, counterpartyRaw, amount, match)
  if (decision.autoApply) {
    await db
      .update(postings)
      .set({ categoryId: match.categoryId, descriptionEmbedding: match.embedding })
      .where(eq(postings.id, postingId))
    await writeAuditLog({
      postingId,
      action: 'auto_applied',
      categoryId: match.categoryId,
      source: match.source,
      confidence: match.confidence,
      reason: `gate passed: vendor history + amount range checks satisfied`,
      actor: 'system',
    })
    return 'applied'
  }
  await queueForReview(postingId, match, decision.reason)
  await writeAuditLog({
    postingId,
    action: 'queued_for_review',
    categoryId: match.categoryId,
    source: match.source,
    confidence: match.confidence,
    reason: decision.reason,
    actor: 'system',
  })
  return 'queued'
}

/** Categorizes every uncategorized posting for a tenant through 3 tiers:
 * (1) deterministic rule match (applies directly, no gate — already
 * deterministic), (2) embedding similarity vs anchors/history, (3) Jev LLM
 * fallback. Tier 2/3 matches pass through the S1-4 gate before writing —
 * auto-apply if the vendor has enough history and the amount fits, else
 * queued to review_queue. A posting that clears no tier is left
 * uncategorized entirely. */
export async function categorizeUncategorizedPostings(tenantId: string): Promise<CategorizeResult> {
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

  const byTier = { rule: 0, embedding: 0, llm: 0 }
  let categorized = 0
  let queuedForReview = 0

  for (const posting of candidates) {
    const text = posting.counterpartyRaw!
    const amount = Number(posting.amount)

    const rule = await findBestRule(tenantId, text)
    if (rule) {
      await db.update(postings).set({ categoryId: rule.categoryId }).where(eq(postings.id, posting.id))
      await db
        .update(categorizationRules)
        .set({ timesMatched: rule.timesMatched + 1, updatedAt: new Date() })
        .where(eq(categorizationRules.id, rule.id))
      await writeAuditLog({
        postingId: posting.id,
        action: 'auto_applied',
        categoryId: rule.categoryId,
        source: 'rule',
        confidence: rule.confidenceLearned ? Number(rule.confidenceLearned) : null,
        reason: `matched categorization_rules pattern "${rule.pattern}"`,
        actor: 'system',
      })
      byTier.rule++
      categorized++
      continue
    }

    const embMatch = await categorizeByEmbedding(tenantId, posting.id, text)
    if (embMatch) {
      const outcome = await applyOrQueue(tenantId, posting.id, text, amount, embMatch)
      byTier.embedding++
      if (outcome === 'applied') categorized++
      else queuedForReview++
      continue
    }

    const llmMatch = await categorizeByJev(text)
    if (llmMatch) {
      const outcome = await applyOrQueue(tenantId, posting.id, text, amount, llmMatch)
      byTier.llm++
      if (outcome === 'applied') categorized++
      else queuedForReview++
      continue
    }
  }

  return {
    checked: candidates.length,
    categorized,
    queuedForReview,
    uncategorized: candidates.length - categorized - queuedForReview,
    byTier,
  }
}
