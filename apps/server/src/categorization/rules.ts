/** SOURCE OF TRUTH: every write to categorization_rules.
 * WHAT: creates Tier 1 rules -- either typed by the user (POST
 * /api/categorization-rules) or learned from a human approving a Jev
 * suggestion in the review queue.
 * WHY: without the learned path, approving "Uber -> Transport" fixed one
 * posting and the next Uber charge went straight back to Jev and the
 * queue. A learned rule makes the approval permanent, so a known vendor
 * costs zero AI calls from then on (schema.ts's categorizationRules doc).
 * Learned rules are isUserCustom=false, so a rule the user typed by hand
 * always wins over one the system inferred (categorize.ts's tie-break).
 * WHERE: owns rule inserts only. Matching lives in categorize.ts; reads
 * live in @repo/ledger's queries.ts.
 */
import { db, categorizationRules, postings, transactions, type DbExecutor } from '@repo/ledger'
import { and, eq, sql } from 'drizzle-orm'

export async function createCategorizationRule(
  rule: {
    tenantId: string
    pattern: string
    categoryId: string
    isUserCustom: boolean
    confidenceLearned?: number
  },
  executor: DbExecutor = db,
) {
  const [created] = await executor
    .insert(categorizationRules)
    .values({
      tenantId: rule.tenantId,
      pattern: rule.pattern,
      categoryId: rule.categoryId,
      isUserCustom: rule.isUserCustom,
      confidenceLearned: rule.confidenceLearned === undefined ? null : rule.confidenceLearned.toFixed(3),
    })
    .returning()
  return created!
}

/** Turns an approved review-queue suggestion into a Tier 1 rule keyed on
 * the posting's counterparty text. Skips (returns null) when the posting
 * has no counterparty to match on, or when the tenant already has a rule
 * for that exact counterparty -- an existing rule, especially a
 * user-typed one, is never overwritten by an inferred one. */
export async function learnRuleFromApproval(
  approval: { postingId: string; categoryId: string; confidence: number },
  executor: DbExecutor,
) {
  const [posting] = await executor
    .select({ tenantId: transactions.tenantId, counterpartyRaw: postings.counterpartyRaw })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(eq(postings.id, approval.postingId))
  if (!posting?.counterpartyRaw) return null

  const [existing] = await executor
    .select({ id: categorizationRules.id })
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, posting.tenantId),
        sql`lower(${categorizationRules.pattern}) = lower(${posting.counterpartyRaw})`,
      ),
    )
    .limit(1)
  if (existing) return null

  return createCategorizationRule(
    {
      tenantId: posting.tenantId,
      pattern: posting.counterpartyRaw,
      categoryId: approval.categoryId,
      isUserCustom: false,
      confidenceLearned: approval.confidence,
    },
    executor,
  )
}
