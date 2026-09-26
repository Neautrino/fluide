/* SOURCE OF TRUTH: the audit_log writer for every posting-category decision.
 * Invariant: callers pass their transaction; a category change commits only with its audit row. Enforced by: migration 0004 postings_category_change_audited.
 * See: ADR 004 — why the DB, not the code, enforces this
 */
import { auditLog, auditLogAction, type DbExecutor } from '@repo/ledger'

export type AuditAction = (typeof auditLogAction.enumValues)[number]

export async function writeAuditLog(
  entry: {
    postingId: string
    action: AuditAction
    categoryId: string | null
    source: string
    confidence: number | null
    reason: string
    actor: string
  },
  executor: DbExecutor,
): Promise<void> {
  await executor.insert(auditLog).values([
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
