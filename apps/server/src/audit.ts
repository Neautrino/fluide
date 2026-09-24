/** SOURCE OF TRUTH: the S1-6 audit log writer.
 * WHAT: one function, called from every path that decides a posting's
 * category (or decides not to) -- Tier 1 rule apply, Tier 2/3 gate
 * auto-apply, gate reject-to-queue, and a human's approve/reject on a
 * queued item.
 * WHY: postings.categoryId alone is end state, not a decision trail. If a
 * category is later found wrong, this is the only way to answer "why was
 * this assigned, by what tier, at what confidence, by whom."
 * WHERE: called from categorization/categorize.ts (tier decisions) and
 * index.ts (human approve/reject routes). Never called from gate.ts
 * directly -- the caller already has the full context (postingId, tier, confidence).
 */
import { db, auditLog } from '@repo/ledger'

export type AuditAction = 'auto_applied' | 'queued_for_review' | 'approved' | 'rejected'

export async function writeAuditLog(entry: {
  postingId: string
  action: AuditAction
  categoryId: string | null
  source: string
  confidence: number | null
  reason: string
  actor: string
}): Promise<void> {
  await db.insert(auditLog).values([
    {
      postingId: entry.postingId,
      action: entry.action,
      categoryId: entry.categoryId,
      source: entry.source,
      confidence: entry.confidence === null ? null : entry.confidence.toFixed(3),
      reason: entry.reason,
      actor: entry.actor,
    },
  ])
}
