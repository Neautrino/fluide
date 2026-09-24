/** SOURCE OF TRUTH: a human's categorization decisions on review_queue items.
 * WHAT: approve writes the suggested category onto the posting, marks the
 * queue row approved, writes the audit_log entry and proposes a Tier 1
 * rule for the vendor. Reject marks the row rejected and writes the
 * audit_log entry; the posting is never touched.
 * WHY: every step of a decision runs in one DB transaction, so a crash
 * can't leave a category applied with no audit_log row (S1-6) -- and
 * migration 0004 refuses to commit a category change without one anyway.
 * The queue row is locked FOR UPDATE so two concurrent clicks cannot
 * both resolve the same item. Rules proposed here stay inactive until the
 * user activates them (categorization/rules.ts).
 * WHERE: owns human decisions only. HTTP mapping lives in index.ts; the
 * gate that fills the queue lives in categorization/gate.ts.
 */
import { db, postings, reviewQueue } from '@repo/ledger'
import { eq } from 'drizzle-orm'
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
