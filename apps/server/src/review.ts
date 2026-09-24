/** SOURCE OF TRUTH: a human's categorization decisions -- approve/reject on
 * a review_queue item, and a manual recategorize of any posting.
 * WHAT: approve writes the suggested category onto the posting, marks the
 * queue row approved, writes the audit_log entry and proposes a Tier 1
 * rule for the vendor. Reject marks the row rejected and writes the
 * audit_log entry; the posting is never touched. Recategorize sets any
 * category the human picks (even over an automatic one), writes a
 * 'recategorized' audit entry, resolves a pending queue item for that
 * posting, and proposes a rule.
 * WHY: every step of a decision runs in one DB transaction, so a crash
 * can't leave a category applied with no audit_log row (S1-6) -- and
 * migration 0004 refuses to commit a category change without one anyway.
 * Queue/posting rows are locked FOR UPDATE so two concurrent clicks cannot
 * both resolve the same item. Rules proposed here stay inactive until the
 * user activates them (categorization/rules.ts).
 * WHERE: owns human decisions only. HTTP mapping lives in index.ts; the
 * gate that fills the queue lives in categorization/gate.ts.
 */
import { db, categories, postings, reviewQueue } from '@repo/ledger'
import { and, eq } from 'drizzle-orm'
import { writeAuditLog } from './audit.js'
import { proposeRuleForPosting } from './categorization/rules.js'

export type ReviewResult =
  | { ok: true; proposedRuleId: string | null }
  | { ok: false; status: 400 | 404 | 409; error: string }

export async function resolveReviewItem(id: string, decision: 'approve' | 'reject'): Promise<ReviewResult> {
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(reviewQueue).where(eq(reviewQueue.id, id)).for('update')
    if (!item) return { ok: false, status: 404, error: 'not found' }
    if (item.status !== 'pending') return { ok: false, status: 409, error: `already ${item.status}` }

    const confidence = Number(item.confidence)
    let proposedRuleId: string | null = null

    if (decision === 'approve') {
      if (!item.suggestedCategoryId) {
        return {
          ok: false,
          status: 400,
          error:
            'this item has no suggested category (low-confidence) -- nothing to approve, pick a category manually instead',
        }
      }
      await tx.update(postings).set({ categoryId: item.suggestedCategoryId }).where(eq(postings.id, item.postingId))
      const rule = await proposeRuleForPosting(
        { postingId: item.postingId, categoryId: item.suggestedCategoryId, confidence },
        tx,
      )
      proposedRuleId = rule?.id ?? null
    }

    await tx
      .update(reviewQueue)
      .set({ status: decision === 'approve' ? 'approved' : 'rejected', resolvedAt: new Date() })
      .where(eq(reviewQueue.id, id))
    await writeAuditLog(
      {
        postingId: item.postingId,
        action: decision === 'approve' ? 'approved' : 'rejected',
        categoryId: item.suggestedCategoryId,
        source: item.source,
        confidence,
        reason:
          `human ${decision === 'approve' ? 'approved' : 'rejected'} review_queue suggestion (original reason: ${item.reason})` +
          (proposedRuleId ? `; proposed categorization_rules ${proposedRuleId}` : ''),
        actor: 'human',
      },
      tx,
    )

    return { ok: true, proposedRuleId }
  })
}

/** A human sets a posting's category directly. Allowed on any posting,
 * including ones categorized automatically; categorize.ts never touches a
 * posting once it has a category, so this choice sticks. */
export async function recategorizePosting(postingId: string, categoryId: string): Promise<ReviewResult> {
  return db.transaction(async (tx) => {
    const [posting] = await tx
      .select({ id: postings.id, categoryId: postings.categoryId })
      .from(postings)
      .where(eq(postings.id, postingId))
      .for('update')
    if (!posting) return { ok: false, status: 404, error: 'posting not found' }

    const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId))
    if (!category) return { ok: false, status: 400, error: 'unknown categoryId' }

    await tx.update(postings).set({ categoryId }).where(eq(postings.id, postingId))

    // A pending suggestion for this posting is now decided by the human's
    // pick: approved if it matches, rejected if they chose something else.
    const [pending] = await tx
      .select()
      .from(reviewQueue)
      .where(and(eq(reviewQueue.postingId, postingId), eq(reviewQueue.status, 'pending')))
      .for('update')
    if (pending) {
      await tx
        .update(reviewQueue)
        .set({ status: pending.suggestedCategoryId === categoryId ? 'approved' : 'rejected', resolvedAt: new Date() })
        .where(eq(reviewQueue.id, pending.id))
    }

    const rule = await proposeRuleForPosting({ postingId, categoryId, confidence: null }, tx)
    const proposedRuleId = rule?.id ?? null

    await writeAuditLog(
      {
        postingId,
        action: 'recategorized',
        categoryId,
        source: 'human',
        confidence: null,
        reason:
          `human set category (previous: ${posting.categoryId ?? 'uncategorized'})` +
          (pending ? `; resolved pending review_queue ${pending.id}` : '') +
          (proposedRuleId ? `; proposed categorization_rules ${proposedRuleId}` : ''),
        actor: 'human',
      },
      tx,
    )

    return { ok: true, proposedRuleId }
  })
}
