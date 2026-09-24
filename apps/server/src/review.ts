/** SOURCE OF TRUTH: a human's approve/reject decision on a review_queue item.
 * WHAT: resolves one pending review_queue row. Approve writes the suggested
 * category onto the posting, marks the row approved and writes the
 * audit_log entry. Reject marks the row rejected and writes the audit_log
 * entry; the posting is never touched.
 * WHY: every step of a decision runs in one DB transaction. Before this,
 * the three writes were separate statements in the route handler, so a
 * crash between them could leave a category applied with no audit_log row
 * -- breaking S1-6's "every categorization is audited, no exceptions".
 * The queue row is locked FOR UPDATE so two concurrent clicks cannot both
 * resolve the same item.
 * WHERE: owns review resolution only. HTTP mapping lives in index.ts; the
 * gate that fills the queue lives in categorization/gate.ts.
 */
import { db, postings, reviewQueue } from '@repo/ledger'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from './audit.js'

export type ReviewResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string }

export async function resolveReviewItem(id: string, decision: 'approve' | 'reject'): Promise<ReviewResult> {
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(reviewQueue).where(eq(reviewQueue.id, id)).for('update')
    if (!item) return { ok: false, status: 404, error: 'not found' }
    if (item.status !== 'pending') return { ok: false, status: 409, error: `already ${item.status}` }

    const confidence = Number(item.confidence)

    if (decision === 'approve') {
      if (!item.suggestedCategoryId) {
        return {
          ok: false,
          status: 400,
          error:
            'this item has no suggested category (low-confidence, Jev < 0.50) -- nothing to approve, pick a category manually instead',
        }
      }
      await tx.update(postings).set({ categoryId: item.suggestedCategoryId }).where(eq(postings.id, item.postingId))
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
        reason: `human ${decision === 'approve' ? 'approved' : 'rejected'} review_queue suggestion (original reason: ${item.reason})`,
        actor: 'human',
      },
      tx,
    )

    return { ok: true }
  })
}
