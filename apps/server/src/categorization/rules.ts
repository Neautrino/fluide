/* SOURCE OF TRUTH: creating categorization_rules and changing their status.
 * Invariant: a human decision sets its vendor's rule active; a Jev auto-apply only creates a rule for a vendor with none.
 * See: ADR 034 — human decisions become active rules; vendor cascade
 */
import { db, categories, categorizationRules, type DbExecutor } from '@repo/ledger'
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
      status: 'active',
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
    const rule = await createCategorizationRule({ tenantId, pattern, categoryId, isUserCustom: true }, tx)
    return { ok: true, rule }
  })
}

/** A human filed `counterpartyRaw` under `categoryId`: every rule the tenant
 * has for that vendor, in any status, is pointed at that category and set
 * active; one is created when there is none. Returns the rule id. */
export async function upsertHumanRule(
  rule: { tenantId: string; counterpartyRaw: string; categoryId: string; confidence: number | null },
  executor: DbExecutor,
): Promise<string> {
  const [updated] = await executor
    .update(categorizationRules)
    .set({ categoryId: rule.categoryId, status: 'active', updatedAt: new Date() })
    .where(
      and(
        eq(categorizationRules.tenantId, rule.tenantId),
        sql`lower(${categorizationRules.pattern}) = lower(${rule.counterpartyRaw})`,
      ),
    )
    .returning({ id: categorizationRules.id })
  if (updated) return updated.id

  const created = await createCategorizationRule(
    {
      tenantId: rule.tenantId,
      pattern: rule.counterpartyRaw,
      categoryId: rule.categoryId,
      isUserCustom: false,
      confidenceLearned: rule.confidence ?? undefined,
    },
    executor,
  )
  return created.id
}

/** Jev auto-applied `categoryId` to `counterpartyRaw`: creates an active rule
 * only when the tenant has no rule for that vendor in any status, so a
 * human's rule (or one they turned off) is never changed. Returns the new
 * rule, or null when one already existed. */
export async function createJevRuleIfAbsent(
  rule: { tenantId: string; counterpartyRaw: string; categoryId: string; confidence: number },
  executor: DbExecutor,
) {
  const [existing] = await executor
    .select({ id: categorizationRules.id })
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, rule.tenantId),
        sql`lower(${categorizationRules.pattern}) = lower(${rule.counterpartyRaw})`,
      ),
    )
    .limit(1)
  if (existing) return null

  return createCategorizationRule(
    {
      tenantId: rule.tenantId,
      pattern: rule.counterpartyRaw,
      categoryId: rule.categoryId,
      isUserCustom: false,
      confidenceLearned: rule.confidence,
    },
    executor,
  )
}

export type RuleStatusResult =
  | { ok: true; rule: typeof categorizationRules.$inferSelect }
  | { ok: false; status: 404 | 409; error: string }

/** Turns a rule on ('active') or off ('rejected'); 409 when it already has that status. */
export async function setRuleStatus(id: string, status: 'active' | 'rejected'): Promise<RuleStatusResult> {
  return db.transaction(async (tx) => {
    const [rule] = await tx.select().from(categorizationRules).where(eq(categorizationRules.id, id)).for('update')
    if (!rule) return { ok: false, status: 404, error: 'not found' }
    if (rule.status === status) return { ok: false, status: 409, error: `rule is already ${rule.status}` }

    const [updated] = await tx
      .update(categorizationRules)
      .set({ status, updatedAt: new Date() })
      .where(eq(categorizationRules.id, id))
      .returning()
    return { ok: true, rule: updated! }
  })
}
