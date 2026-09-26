/* SOURCE OF TRUTH: human categorization decisions (approve, reject, recategorize).
 * Invariant: each decision runs in one db.transaction with its audit row. Enforced by: migration 0004 (category changes only).
 * See: ADR 005 — an automatic run never overturns a human choice
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
