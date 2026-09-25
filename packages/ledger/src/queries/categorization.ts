import { desc, eq } from 'drizzle-orm'
import { db } from '../db.js'
import {
  transactions,
  postings,
  categories,
  categorizationRules,
  reviewQueue,
  auditLog,
  gateSettings,
  GATE_SETTINGS_DEFAULTS,
} from '../schema/index.js'

export async function listCategories() {
  return db.select().from(categories)
}

export async function listCategorizationRules(tenantId: string) {
  return db.select().from(categorizationRules).where(eq(categorizationRules.tenantId, tenantId))
}

/** Pending items with the posting context a reviewer needs to decide. */
export async function listPendingReviewItems() {
  return db
    .select({
      id: reviewQueue.id,
      postingId: reviewQueue.postingId,
      suggestedCategoryId: reviewQueue.suggestedCategoryId,
      confidenceBand: reviewQueue.confidenceBand,
      source: reviewQueue.source,
      confidence: reviewQueue.confidence,
      reason: reviewQueue.reason,
      status: reviewQueue.status,
      createdAt: reviewQueue.createdAt,
      posting: {
        amount: postings.amount,
        currency: postings.currency,
        counterpartyRaw: postings.counterpartyRaw,
        description: transactions.description,
        date: transactions.date,
      },
    })
    .from(reviewQueue)
    .innerJoin(postings, eq(postings.id, reviewQueue.postingId))
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(eq(reviewQueue.status, 'pending'))
    .orderBy(desc(transactions.date))
}

export async function listAuditLogForPosting(postingId: string) {
  return db.select().from(auditLog).where(eq(auditLog.postingId, postingId)).orderBy(desc(auditLog.createdAt))
}

export type GateSettings = {
  highConfidence: number
  lowConfidence: number
  minVendorOccurrences: number
  amountRangeTolerance: number
  updatedAt: Date | null
}

/** The tenant's saved gate thresholds, or GATE_SETTINGS_DEFAULTS
 * (updatedAt null) when none were ever saved. */
export async function getGateSettings(tenantId: string): Promise<GateSettings> {
  const [row] = await db.select().from(gateSettings).where(eq(gateSettings.tenantId, tenantId))
  if (!row) return { ...GATE_SETTINGS_DEFAULTS, updatedAt: null }
  return {
    highConfidence: Number(row.highConfidence),
    lowConfidence: Number(row.lowConfidence),
    minVendorOccurrences: row.minVendorOccurrences,
    amountRangeTolerance: Number(row.amountRangeTolerance),
    updatedAt: row.updatedAt,
  }
}
