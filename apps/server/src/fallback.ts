/** SOURCE OF TRUTH: S1-3 Tier 2 (embedding similarity) + Tier 3 (Jev LLM)
 * categorization fallbacks, called from categorize.ts only after Tier 1
 * (categorization_rules) finds no match.
 * WHY: an LLM call per unmatched transaction is unnecessary for anything a
 * cheap local embedding can already resolve -- see the S1-3 research:
 * short-text bank-description classification favors lightweight
 * similarity/anchor methods over deep models (arXiv 2404.08664,
 * 2305.18430). Jev is the last resort, not the default path.
 * WHERE: categorize.ts owns tier orchestration + posting writes; this file
 * only returns a decision, it never writes to the DB itself.
 */
import { db, categories, categoryAnchors, postings, transactions } from '@repo/ledger'
import { and, eq, cosineDistance, sql, isNotNull } from 'drizzle-orm'
import { embed } from './embeddings.js'

export type CategorizationMatch = {
  categoryId: string
  embedding: number[]
  confidence: number
  source: 'embedding-anchor' | 'embedding-history' | 'jev'
}

const EMBEDDING_SIMILARITY_THRESHOLD = 0.7
const JEV_AUTO_APPLY_THRESHOLD = 0.95

/** Tier 2: embed the posting text, compare against category anchors (cold
 * start) and the tenant's own past categorized postings (gets better as
 * the tenant accumulates history). Returns undefined below the similarity
 * threshold -- falls through to Jev rather than guessing. */
export async function categorizeByEmbedding(
  tenantId: string,
  postingId: string,
  text: string,
): Promise<CategorizationMatch | undefined> {
  const vec = await embed(text)

  const historyMatches = await db
    .select({
      categoryId: postings.categoryId,
      distance: sql<number>`${cosineDistance(postings.descriptionEmbedding, vec)}`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        isNotNull(postings.categoryId),
        isNotNull(postings.descriptionEmbedding),
      ),
    )
    .orderBy(cosineDistance(postings.descriptionEmbedding, vec))
    .limit(1)

  const best = historyMatches[0]
  if (best && best.categoryId && 1 - best.distance >= EMBEDDING_SIMILARITY_THRESHOLD) {
    return { categoryId: best.categoryId, embedding: vec, confidence: 1 - best.distance, source: 'embedding-history' }
  }

  const anchorMatches = await db
    .select({
      categoryId: categoryAnchors.categoryId,
      distance: sql<number>`${cosineDistance(categoryAnchors.embedding, vec)}`,
    })
    .from(categoryAnchors)
    .orderBy(cosineDistance(categoryAnchors.embedding, vec))
    .limit(1)

  const bestAnchor = anchorMatches[0]
  if (bestAnchor && 1 - bestAnchor.distance >= EMBEDDING_SIMILARITY_THRESHOLD) {
    return {
      categoryId: bestAnchor.categoryId,
      embedding: vec,
      confidence: 1 - bestAnchor.distance,
      source: 'embedding-anchor',
    }
  }

  return undefined
}

type JevSystemOneResponse = {
  answers: {
    category: {
      choice: string
      confidence: number
      probabilities: Record<string, number>
    }
  }
}

/** Tier 3: last resort. Sends the transaction text + all category criteria
 * to Jev (free tier via OpenCode Zen) and asks it to pick one. Returns
 * undefined below JEV_AUTO_APPLY_THRESHOLD -- low-confidence answers are
 * not applied here, they fall through to the S1-5 review queue instead of
 * being guessed onto the posting. */
export async function categorizeByJev(text: string): Promise<CategorizationMatch | undefined> {
  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) return undefined

  const cats = await db.select({ id: categories.id, detailed: categories.detailed, label: categories.label }).from(categories)
  const criteria: Record<string, string> = {}
  for (const c of cats) {
    criteria[c.detailed] = c.label ?? c.detailed.replace(/_/g, ' ')
  }

  const res = await fetch('https://opencode.ai/zen/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-1.13-free',
      state: `Bank transaction description: ${text}`,
      questions: {
        category: {
          type: 'choice',
          instructions: 'Which spending category best matches this bank transaction?',
          criteria,
        },
      },
    }),
  })
  if (!res.ok) return undefined

  const data = (await res.json()) as JevSystemOneResponse
  const answer = data.answers?.category
  if (!answer || answer.confidence < JEV_AUTO_APPLY_THRESHOLD) return undefined

  const matched = cats.find((c) => c.detailed === answer.choice)
  if (!matched) return undefined

  const vec = await embed(text)
  return { categoryId: matched.id, embedding: vec, confidence: answer.confidence, source: 'jev' }
}
