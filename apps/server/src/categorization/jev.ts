import { db, categories } from '@repo/ledger'

export type CategorizationMatch = {
  categoryId: string
  confidence: number
  source: 'jev'
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

/** Sends one posting's text to Jev and returns its answer. Never discards
 * a low-confidence answer -- the gate decides what a human sees. Returns
 * undefined only on a hard failure (no API key, network/API error, or an
 * answer that doesn't match a known category) -- those really are "nothing
 * to act on" cases. */
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
    source: 'jev',
  }
}

/** Batch variant: classifies many postings in one Jev API call (many
 * `choice` questions against one `state`), chunked to stay under Jev's
 * documented per-request token budget. Empirically ~25 questions/call at
 * this taxonomy's criteria size keeps requests well under the ceiling --
 * see project history for the real HTTP 400 max_tokens_exceeded that a
 * single 200-question call produced before this was chunked. Returns the
 * same CategorizationMatch shape as categorizeByJev. Like categorizeByJev,
 * never drops a low-confidence answer; gate.ts bands it. */
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
        source: 'jev',
      })
    }
  }

  return results
}
