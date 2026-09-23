/** SOURCE OF TRUTH: the deterministic categorization pipeline (S1-2).
 * WHAT: matches a posting's counterparty text against categorization_rules
 * before any AI involvement (S1-3 embeddings/Jev fallback is a later slice).
 * WHY: a known vendor costs zero AI calls — same guardrail principle as
 * S0-4. `isUserCustom` rules always win over system rules on a tied match.
 * WHERE: owns rule matching + posting updates only. Rule CRUD lives in
 * index.ts routes; embeddings/LLM fallback will live in a separate file.
 */
import { db, postings, transactions, categorizationRules } from '@repo/ledger'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type CategorizeResult = {
  checked: number
  categorized: number
  uncategorized: number
}

async function findBestRule(tenantId: string, text: string) {
  const matches = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.tenantId, tenantId),
        sql`${text} ILIKE '%' || ${categorizationRules.pattern} || '%'`,
      ),
    )

  if (matches.length === 0) return undefined

  // user rules win over system-seeded ones; among ties, most-matched wins
  matches.sort((a, b) => {
    if (a.isUserCustom !== b.isUserCustom) return a.isUserCustom ? -1 : 1
    return b.timesMatched - a.timesMatched
  })
  return matches[0]
}

/** Categorizes every uncategorized posting for a tenant that has a
 * counterparty and a matching rule. Postings with no rule match are left
 * alone for S1-3 to pick up — never guessed here. */
export async function categorizeUncategorizedPostings(tenantId: string): Promise<CategorizeResult> {
  const candidates = await db
    .select({ id: postings.id, counterpartyRaw: postings.counterpartyRaw })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        isNull(postings.categoryId),
        sql`${postings.counterpartyRaw} IS NOT NULL`,
      ),
    )

  let categorized = 0
  for (const posting of candidates) {
    const rule = await findBestRule(tenantId, posting.counterpartyRaw!)
    if (!rule) continue

    await db.update(postings).set({ categoryId: rule.categoryId }).where(eq(postings.id, posting.id))
    await db
      .update(categorizationRules)
      .set({ timesMatched: rule.timesMatched + 1, updatedAt: new Date() })
      .where(eq(categorizationRules.id, rule.id))
    categorized++
  }

  return {
    checked: candidates.length,
    categorized,
    uncategorized: candidates.length - categorized,
  }
}
