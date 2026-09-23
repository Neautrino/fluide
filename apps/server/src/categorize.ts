/** SOURCE OF TRUTH: the deterministic categorization pipeline (S1-2).
 * WHAT: matches a posting's counterparty text against categorization_rules
 * before any AI involvement. S1-3's embedding/Jev fallback tiers live in
 * fallback.ts and are called from categorizeUncategorizedPostings below.
 * WHY: a known vendor costs zero AI calls — same guardrail principle as
 * S0-4. `isUserCustom` rules always win over system rules on a tied match.
 * WHERE: owns rule matching + posting updates + tier orchestration. Rule
 * CRUD lives in index.ts routes; embeddings/LLM fallback in fallback.ts.
 */
import { db, postings, transactions, categorizationRules } from '@repo/ledger'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { categorizeByEmbedding, categorizeByJev } from './fallback.js'

export type CategorizeResult = {
  checked: number
  categorized: number
  uncategorized: number
  byTier: { rule: number; embedding: number; llm: number }
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

  matches.sort((a, b) => {
    if (a.isUserCustom !== b.isUserCustom) return a.isUserCustom ? -1 : 1
    return b.timesMatched - a.timesMatched
  })
  return matches[0]
}

/** Categorizes every uncategorized posting for a tenant through 3 tiers:
 * (1) deterministic rule match, (2) embedding similarity vs anchors/history,
 * (3) Jev LLM fallback. Falls through tiers only on no-match — never
 * guesses. A posting that clears no tier is left uncategorized for the
 * S1-5 review queue. */
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

  const byTier = { rule: 0, embedding: 0, llm: 0 }
  let categorized = 0

  for (const posting of candidates) {
    const text = posting.counterpartyRaw!

    const rule = await findBestRule(tenantId, text)
    if (rule) {
      await db.update(postings).set({ categoryId: rule.categoryId }).where(eq(postings.id, posting.id))
      await db
        .update(categorizationRules)
        .set({ timesMatched: rule.timesMatched + 1, updatedAt: new Date() })
        .where(eq(categorizationRules.id, rule.id))
      byTier.rule++
      categorized++
      continue
    }

    const embMatch = await categorizeByEmbedding(tenantId, posting.id, text)
    if (embMatch) {
      await db
        .update(postings)
        .set({ categoryId: embMatch.categoryId, descriptionEmbedding: embMatch.embedding })
        .where(eq(postings.id, posting.id))
      byTier.embedding++
      categorized++
      continue
    }

    const llmMatch = await categorizeByJev(text)
    if (llmMatch) {
      await db
        .update(postings)
        .set({ categoryId: llmMatch.categoryId, descriptionEmbedding: llmMatch.embedding })
        .where(eq(postings.id, posting.id))
      byTier.llm++
      categorized++
      continue
    }
  }

  return {
    checked: candidates.length,
    categorized,
    uncategorized: candidates.length - categorized,
    byTier,
  }
}
