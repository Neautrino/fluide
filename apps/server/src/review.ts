/* SOURCE OF TRUTH: human categorization decisions (approve, reject, recategorize).
 * Invariant: each decision runs in one db.transaction with its audit row. Enforced by: migration 0004 (category changes only).
 * See: ADR 005 — an automatic run never overturns a human choice
 */
import { db, accounts, categories, postings, reviewQueue, transactions, liveTransaction, type DbExecutor } from '@repo/ledger'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { writeAuditLog } from './audit.js'
import { proposeRuleForPosting } from './categorization/rules.js'

export type ReviewResult =
  | { ok: true; proposedRuleId: string | null }
  | { ok: false; status: 400 | 404 | 409; error: string }

const NOT_CATEGORIZABLE = 'only live bank postings can be categorized (not voided, reversal, opening-balance or equity legs)'

/** Locks the posting; `categorizable` is false for voided, reversal, opening-balance and equity legs. */
async function lockPosting(tx: DbExecutor, postingId: string) {
  const [posting] = await tx
    .select({
      id: postings.id,
      categoryId: postings.categoryId,
      categorizable: sql<boolean>`coalesce(${and(
        liveTransaction,
        ne(transactions.source, 'opening-balance'),
        inArray(accounts.type, ['asset', 'liability']),
      )}, false)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(eq(postings.id, postingId))
    .for('update')
  return posting
}

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
      if (!(await lockPosting(tx, item.postingId))?.categorizable) return { ok: false, status: 409, error: NOT_CATEGORIZABLE }
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

/** A human sets a posting's category directly. Allowed on any live bank
 * posting, including ones categorized automatically; categorize.ts never
 * touches a posting once it has a category, so this choice sticks. */
export async function recategorizePosting(postingId: string, categoryId: string): Promise<ReviewResult> {
  return db.transaction(async (tx) => {
    const posting = await lockPosting(tx, postingId)
    if (!posting) return { ok: false, status: 404, error: 'posting not found' }
    if (!posting.categorizable) return { ok: false, status: 409, error: NOT_CATEGORIZABLE }

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
