import { db, categories } from '@repo/ledger'

export type CategorizationMatch = {
  categoryId: string
  confidence: number
  source: 'jev'
}

type JevSystemOneResponse = {
  answers: Record<string, { choice: string; confidence: number }>
  model?: string
  usage?: { cost?: number }
}

export type JevConfig = {
  endpoint: string
  model: string
  apiKey: string | null
}

export async function runJevBatch(
  config: JevConfig,
  state: Record<string, string>,
  questions: Record<string, unknown>,
  signal?: AbortSignal
): Promise<JevSystemOneResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: config.model, state, questions }),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw { response: { status: res.status, json: text } }
  }

  return (await res.json()) as JevSystemOneResponse
}


/** Classifies many postings in one Jev API call (many
 * `choice` questions against one `state`), chunked to stay under Jev's
 * documented per-request token budget. Empirically ~25 questions/call at
 * this taxonomy's criteria size keeps requests well under the ceiling --
 * see project history for the real HTTP 400 max_tokens_exceeded that a
 * single 200-question call produced before this was chunked. Never drops a
 * low-confidence answer; gate.ts bands it. A failed chunk leaves its items
 * unresolved. */
export async function categorizeByJevBatch(
  config: JevConfig,
  items: { id: string; text: string }[],
  batchSize = 25,
): Promise<Map<string, CategorizationMatch>> {
  const results = new Map<string, CategorizationMatch>()
  if (items.length === 0) return results

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

    try {
      const data = await runJevBatch(config, state, questions)
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
    } catch {
      // this chunk failed -- its items are left unresolved, not silently guessed
    }
  }

  return results
}
