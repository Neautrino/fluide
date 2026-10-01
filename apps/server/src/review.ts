/* SOURCE OF TRUTH: human categorization decisions (approve, reject, recategorize).
 * Invariant: each decision runs in one db.transaction with its audit row. Enforced by: migration 0004 (category changes only).
 * See: ADR 005 — an automatic run never overturns a human choice
 */
import { db, accounts, categories, postings, reviewQueue, transactions, liveTransaction, type DbExecutor } from '@repo/ledger'
import { and, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm'
import { writeAuditLog } from './audit.js'
import { upsertHumanRule } from './categorization/rules.js'

type VendorResult = { ruleId: string | null; alsoFiled: number }

export type ReviewResult = ({ ok: true } & VendorResult) | { ok: false; status: 400 | 404 | 409; error: string }

const NOT_CATEGORIZABLE = 'only live bank postings can be categorized (not voided, reversal, opening-balance or equity legs)'

/** Live bank posting: not voided, reversal, opening-balance or equity leg. Needs transactions and accounts joined. */
const categorizable = and(
  liveTransaction,
  ne(transactions.source, 'opening-balance'),
  inArray(accounts.type, ['asset', 'liability']),
)

/** Locks the posting; `categorizable` is false for voided, reversal, opening-balance and equity legs. */
async function lockPosting(tx: DbExecutor, postingId: string) {
  const [posting] = await tx
    .select({
      id: postings.id,
      tenantId: transactions.tenantId,
      counterpartyRaw: postings.counterpartyRaw,
      categoryId: postings.categoryId,
      categorizable: sql<boolean>`coalesce(${categorizable}, false)`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(eq(postings.id, postingId))
    .for('update')
  return posting
}

/** Makes a human's category choice for one posting hold for its vendor
 * (same tenant, case-insensitive counterpartyRaw): the vendor's rule is set
 * active on `categoryId`, and every other uncategorized, categorizable
 * posting of that vendor is filed under it with its own audit row. Postings
 * that have a category or a rejected review item are left alone. */
async function applyToVendor(
  tx: DbExecutor,
  posting: { id: string; tenantId: string; counterpartyRaw: string | null },
  categoryId: string,
  confidence: number | null,
): Promise<VendorResult> {
  const vendor = posting.counterpartyRaw
  if (!vendor) return { ruleId: null, alsoFiled: 0 }
  const ruleId = await upsertHumanRule({ tenantId: posting.tenantId, counterpartyRaw: vendor, categoryId, confidence }, tx)

  const rejectedItems = tx
    .select({ postingId: reviewQueue.postingId })
    .from(reviewQueue)
    .where(eq(reviewQueue.status, 'rejected'))
  const siblings = await tx
    .select({ id: postings.id })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(
      and(
        eq(transactions.tenantId, posting.tenantId),
        sql`lower(${postings.counterpartyRaw}) = lower(${vendor})`,
        ne(postings.id, posting.id),
        isNull(postings.categoryId),
        categorizable,
        notInArray(postings.id, rejectedItems),
      ),
    )
    .for('update')
  if (siblings.length === 0) return { ruleId, alsoFiled: 0 }

  const ids = siblings.map((s) => s.id)
  await tx.update(postings).set({ categoryId }).where(inArray(postings.id, ids))
  await tx
    .update(reviewQueue)
    .set({ status: 'approved', resolvedAt: new Date() })
    .where(and(inArray(reviewQueue.postingId, ids), eq(reviewQueue.status, 'pending')))
  for (const id of ids) {
    await writeAuditLog(
      {
        postingId: id,
        action: 'approved',
        categoryId,
        source: 'rule',
        confidence: null,
        reason: `filed with vendor "${vendor}" by the human decision on posting ${posting.id} (categorization_rules ${ruleId})`,
        actor: 'human',
      },
      tx,
    )
  }
  return { ruleId, alsoFiled: ids.length }
}

export async function resolveReviewItem(id: string, decision: 'approve' | 'reject'): Promise<ReviewResult> {
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(reviewQueue).where(eq(reviewQueue.id, id)).for('update')
    if (!item) return { ok: false, status: 404, error: 'not found' }
    if (item.status !== 'pending') return { ok: false, status: 409, error: `already ${item.status}` }

    const confidence = Number(item.confidence)
    let vendor: VendorResult = { ruleId: null, alsoFiled: 0 }

    if (decision === 'approve') {
      if (!item.suggestedCategoryId) {
        return {
          ok: false,
          status: 400,
          error:
            'this item has no suggested category (low-confidence) -- nothing to approve, pick a category manually instead',
        }
      }
      const posting = await lockPosting(tx, item.postingId)
      if (!posting?.categorizable) return { ok: false, status: 409, error: NOT_CATEGORIZABLE }
      await tx.update(postings).set({ categoryId: item.suggestedCategoryId }).where(eq(postings.id, item.postingId))
      vendor = await applyToVendor(tx, posting, item.suggestedCategoryId, confidence)
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
          (vendor.ruleId ? `; categorization_rules ${vendor.ruleId} active` : '') +
          (vendor.alsoFiled > 0 ? `; also filed ${vendor.alsoFiled} other posting(s) of this vendor` : ''),
        actor: 'human',
      },
      tx,
    )

    return { ok: true, ...vendor }
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

    const vendor = await applyToVendor(tx, posting, categoryId, null)

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
          (vendor.ruleId ? `; categorization_rules ${vendor.ruleId} active` : '') +
          (vendor.alsoFiled > 0 ? `; also filed ${vendor.alsoFiled} other posting(s) of this vendor` : ''),
        actor: 'human',
      },
      tx,
    )

    return { ok: true, ...vendor }
  })
}
