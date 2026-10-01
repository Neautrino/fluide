import { db, categories } from '@repo/ledger'
import type { AiProvider } from '@repo/ledger'
import { mapAiError } from './errors.js'
import { runJevBatch } from '../categorization/jev.js'
import { buildChatModel } from '../chat/model.js'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import type { AiTestResult } from './config.js'

const pingTool = tool(
  () => { return 'pong' },
  {
    name: 'ping',
    description: 'A test ping tool.',
    schema: z.object({}),
  }
)

export async function testCategorization(config: { endpoint: string, model: string, apiKey: string | null }): Promise<AiTestResult> {
  const cats = await db.select({ id: categories.id, detailed: categories.detailed, label: categories.label }).from(categories)
  const criteria: Record<string, string> = {}
  for (const c of cats) {
    criteria[c.detailed] = c.label ?? c.detailed.replace(/_/g, ' ')
  }

  const items = [
    'STARBUCKS STORE 1234 SEATTLE WA',
    'UBER *TRIP HELP.UBER.COM',
    'NETFLIX.COM 866-579-7172',
    'SHELL OIL 57444',
    'AMAZON MKTPLACE PMTS',
    'WHOLEFDS MKT 10234',
    'TST* LOCAL RESTAURANT',
    'TARGET 0011234',
    'CHEVRON 22334',
    'SPOTIFY 12345678',
    'APPLE COM BILL',
    'MCDONALDS 123',
    'HOME DEPOT 44556',
    'WALMART 3344',
    'CVS PHARMACY 111',
    'DOORDASH RESTAURANT',
    'UBER EATS TR',
    'LYFT RIDE',
    'AMZN MKTP US',
    'WHOLE FOODS MKT',
    'TRADER JOES 001',
    'COSTCO WHSE',
    'KROGER STORE',
    'PUBLIX 1234',
    'SAFEWAY STORE'
  ]

  const state: Record<string, string> = {}
  const questions: Record<string, unknown> = {}
  for (let i = 0; i < items.length; i++) {
    const id = `item_${i}`
    state[id] = items[i]!
    questions[id] = {
      type: 'choice',
      instructions: `Which spending category does the bank transaction description at key '${id}' belong to?`,
      criteria,
    }
  }

  const signal = AbortSignal.timeout(30000)
  const start = performance.now()
  try {
    const data = await runJevBatch(config, state, questions, signal)

    let answered = 0
    let firstExample = ''
    for (let i = 0; i < items.length; i++) {
      const answer = data.answers?.[`item_${i}`]
      const label = answer ? criteria[answer.choice] : undefined
      if (!answer || label === undefined) continue
      answered++
      if (!firstExample) firstExample = `${items[i]} → ${label} ${Math.round(answer.confidence * 100)}%`
    }

    const latencyMs = Math.round(performance.now() - start)
    if (answered === 0) {
      return { ok: false, message: 'Answered, but no answer matched one of your categories.', latencyMs }
    }

    let message = `${answered}/${items.length} answered · ${firstExample}`
    if (data.model) message += ` · served ${data.model}`
    if (data.usage?.cost !== undefined) message += ` · $${data.usage.cost}`

    return { ok: true, message, latencyMs }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start)
    return { ok: false, message: mapAiError(error, config.endpoint, config.apiKey, { signal, seconds: 30 }), latencyMs }
  }
}

export async function testChat(config: { provider: AiProvider, endpoint: string, model: string, apiKey: string | null }): Promise<AiTestResult> {
  const signal = AbortSignal.timeout(30000)
  const start = performance.now()
  try {
    // One attempt: LangChain's default retries would hide "Can't reach" behind the 30 s timeout.
    const modelWithTools = buildChatModel(config, { maxRetries: 0 }).bindTools([pingTool])

    const res = await modelWithTools.invoke([
      { role: 'user', content: 'Connection check: call the ping tool once, then stop.' }
    ], { signal })

    if (res.tool_calls && res.tool_calls.length > 0) {
      return { ok: true, message: 'Passed. AI successfully called a tool.', latencyMs: Math.round(performance.now() - start) }
    }

    return { ok: false, message: 'Replied, but did not call a tool. The assistant needs a model with tool calling.', latencyMs: Math.round(performance.now() - start) }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start)
    return { ok: false, message: mapAiError(error, config.endpoint, config.apiKey, { signal, seconds: 30 }), latencyMs }
  }
}
