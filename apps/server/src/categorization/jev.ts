/** SOURCE OF TRUTH: the Jev API client for transaction categorization.
 * WHAT: called from categorize.ts only after Tier 1 (categorization_rules)
 * finds no match. Sends the posting text + full category criteria to Jev
 * and classifies the answer into one of three confidence bands.
 * WHY: empirical testing (see project history) compared this against local
 * embedding-similarity (both generic MiniLM anchors and a fine-tuned
 * FinBERT variant) and two open-source alternative decision models
 * (TransactAI, Laya) on a real 68k-row bank-transaction dataset. Jev scored
 * 92% on a fair 200-row batched-API test; the next best (a domain-specific
 * fine-tuned classifier) scored 36% on the same class of data, and the
 * embedding-similarity tier this replaced never topped ~14% on real bank
 * jargon (Zomato/Swiggy/FUN/INTRST PYMNT all matched wrong or missed
 * entirely). Decision: drop the embedding tier, Jev only.
 * WHAT CHANGED: the old hard JEV_AUTO_APPLY_THRESHOLD (0.95) silently
 * discarded any answer below it -- a real bug, since Jev often answers
 * correctly at 0.50-0.94 confidence and that signal was being thrown away
 * instead of surfaced for review. This file no longer discards anything;
 * every Jev answer is classified into a band and returned. gate.ts /
 * categorize.ts decide what each band does (auto-apply vs queue vs plain
 * uncategorized) per the user's explicit 3-tier rule.
 * WHERE: categorize.ts owns tier orchestration + posting writes; this file
 * only returns a decision, it never writes to the DB itself.
 */
import { db, categories } from '@repo/ledger'

export type JevConfidenceBand = 'high' | 'medium' | 'low'

export type CategorizationMatch = {
  categoryId: string
  confidence: number
  band: JevConfidenceBand
  source: 'jev'
}

/** >= this: auto-apply eligible (still subject to gate.ts's vendor/amount
 * checklist). 0.50-0.75: show the suggestion, always queue for review.
 * < 0.50: no suggestion returned at all -- posting stays plain
 * uncategorized, and is separately flagged for review by categorize.ts. */
const JEV_HIGH_CONFIDENCE = 0.75
const JEV_LOW_CONFIDENCE = 0.5

type JevSystemOneResponse = {
  answers: {
    category: {
      choice: string
      confidence: number
      probabilities: Record<string, number>
    }
  }
}

function bandFor(confidence: number): JevConfidenceBand {
  if (confidence >= JEV_HIGH_CONFIDENCE) return 'high'
  if (confidence >= JEV_LOW_CONFIDENCE) return 'medium'
  return 'low'
}

/** Sends one posting's text to Jev and classifies the answer. Never
 * discards a low-confidence answer -- 'low' band is returned with its
 * categoryId so categorize.ts can decide what a human sees (per the user's
 * rule: low band shows as uncategorized-and-flagged, not silently dropped
 * with no record at all). Returns undefined only on a hard failure (no API
 * key, network/API error, or an answer that doesn't match a known
 * category) -- those really are "nothing to act on" cases. */
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
  if (!answer) return undefined

  const matched = cats.find((c) => c.detailed === answer.choice)
  if (!matched) return undefined

  return {
    categoryId: matched.id,
    confidence: answer.confidence,
    band: bandFor(answer.confidence),
    source: 'jev',
  }
}

/** Batch variant: classifies many postings in one Jev API call (many
 * `choice` questions against one `state`), chunked to stay under Jev's
 * documented per-request token budget. Empirically ~25 questions/call at
 * this taxonomy's criteria size keeps requests well under the ceiling --
 * see project history for the real HTTP 400 max_tokens_exceeded that a
 * single 200-question call produced before this was chunked. Falls back to
 * the same per-item bandFor() classification as categorizeByJev, so
 * callers get identical CategorizationMatch shapes either way. */
export async function categorizeByJevBatch(
  items: { id: string; text: string }[],
  batchSize = 25,
): Promise<Map<string, CategorizationMatch>> {
  const results = new Map<string, CategorizationMatch>()
  if (items.length === 0) return results

  const apiKey = process.env.OPENCODE_API_KEY
  if (!apiKey) return results

  const cats = await db.select({ id: categories.id, detailed: categories.detailed, label: categories.label }).from(categories)
  const criteria: Record<string, string> = {}
  for (const c of cats) {
    criteria[c.detailed] = c.label ?? c.detailed.replace(/_/g, ' ')
  }
  const byDetailed = new Map(cats.map((c) => [c.detailed, c]))

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const state: Record<string, string> = {}
    const questions: Record<string, unknown> = {}
    for (const item of chunk) {
      state[item.id] = item.text
      questions[item.id] = {
        type: 'choice',
        instructions: `Which spending category does the bank transaction description at key '${item.id}' belong to?`,
        criteria,
      }
    }

    const res = await fetch('https://opencode.ai/zen/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-1.13-free', state, questions }),
    })
    if (!res.ok) continue // this chunk failed -- its items are left unresolved, not silently guessed

    const data = (await res.json()) as { answers: Record<string, { choice: string; confidence: number }> }
    for (const item of chunk) {
      const answer = data.answers?.[item.id]
      if (!answer) continue
      const matched = byDetailed.get(answer.choice)
      if (!matched) continue
      results.set(item.id, {
        categoryId: matched.id,
        confidence: answer.confidence,
        band: bandFor(answer.confidence),
        source: 'jev',
      })
    }
  }

  return results
}
