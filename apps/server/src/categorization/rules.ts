/* SOURCE OF TRUTH: creating categorization_rules and changing their status.
 * Invariant: learned rules start 'proposed' (isUserCustom=false); only the user activates them.
 * See: ADR 003 — why learned rules need activation
 */
import { db, categories, categorizationRules, postings, transactions, type DbExecutor } from '@repo/ledger'
import { and, eq, sql } from 'drizzle-orm'

export async function createCategorizationRule(
  rule: {
    tenantId: string
    pattern: string
    categoryId: string
    isUserCustom: boolean
    status: 'proposed' | 'active'
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
      status: rule.status,
      confidenceLearned: rule.confidenceLearned === undefined ? null : rule.confidenceLearned.toFixed(3),
    })
    .returning()
  return created!
}

export type CreateUserRuleResult =
  | { ok: true; rule: typeof categorizationRules.$inferSelect }
  | { ok: false; status: 400; error: string }

/** A rule the user typed (POST /api/categorization-rules), active
 * immediately. Checks the category exists first so an unknown categoryId is
 * a 400, not a foreign-key error surfacing as a 500. */
export async function createUserRule(
  tenantId: string,
  pattern: string,
  categoryId: string,
): Promise<CreateUserRuleResult> {
  return db.transaction(async (tx) => {
    const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId))
    if (!category) return { ok: false, status: 400, error: 'unknown categoryId' }
    const rule = await createCategorizationRule(
      { tenantId, pattern, categoryId, isUserCustom: true, status: 'active' },
      tx,
    )
    return { ok: true, rule }
  })
}

/** Proposes a Tier 1 rule keyed on the posting's counterparty text after a
 * human categorized it. Skips (returns null) when the posting has no
 * counterparty to match on, or when the tenant already has a rule for that
 * exact counterparty in any status -- an existing rule is never
 * overwritten, and a rule the user already rejected is not re-proposed. */
export async function proposeRuleForPosting(
  proposal: { postingId: string; categoryId: string; confidence: number | null },
  executor: DbExecutor,
) {
  const [posting] = await executor
    .select({ tenantId: transactions.tenantId, counterpartyRaw: postings.counterpartyRaw })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(eq(postings.id, proposal.postingId))
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
      categoryId: proposal.categoryId,
      isUserCustom: false,
      status: 'proposed',
      confidenceLearned: proposal.confidence ?? undefined,
    },
    executor,
  )
}

export type RuleDecisionResult =
  | { ok: true; rule: typeof categorizationRules.$inferSelect }
  | { ok: false; status: 404 | 409; error: string }

/** The user's decision on a proposed rule. Only 'proposed' rules can be
 * decided; active/rejected are final from this path. */
export async function decideProposedRule(id: string, decision: 'active' | 'rejected'): Promise<RuleDecisionResult> {
  return db.transaction(async (tx) => {
    const [rule] = await tx.select().from(categorizationRules).where(eq(categorizationRules.id, id)).for('update')
    if (!rule) return { ok: false, status: 404, error: 'not found' }
    if (rule.status !== 'proposed') return { ok: false, status: 409, error: `rule is already ${rule.status}` }

    const [updated] = await tx
      .update(categorizationRules)
      .set({ status: decision, updatedAt: new Date() })
      .where(eq(categorizationRules.id, id))
      .returning()
    return { ok: true, rule: updated! }
  })
}
