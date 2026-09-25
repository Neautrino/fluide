/** SOURCE OF TRUTH: the chat agent -- tool-calling loop + per-thread memory.
 * WHAT: one module-level createAgent() (LangChain's own agent runner, not
 * a hand-rolled loop) wired to chatModel + chatTools, with an in-memory
 * checkpointer keyed by thread_id.
 * WHY: MemorySaver is intentional, not a placeholder -- an open chat
 * remembers everything within itself, but nothing survives closing it or
 * a server restart. That's the user's explicit rule, not a gap. Built
 * once here (not per-call) -- the per-thread rebuild in an earlier
 * version existed only to give OpenCode Go's client a per-conversation
 * session header; OpenAI has no such requirement, so one shared agent
 * over one shared chatModel is correct now.
 * WHERE: owns the agent instance + invoke wrapper only. Model config lives
 * in model.ts, tool definitions in tools.ts, the HTTP route in routes/assistant.ts.
 */
import { createAgent } from 'langchain'
import { MemorySaver } from '@langchain/langgraph'
import { chatModel } from './model.js'
import { chatTools } from './tools.js'

const checkpointer = new MemorySaver()

const agent = createAgent({
  model: chatModel,
  tools: chatTools,
  checkpointer,
  systemPrompt:
    'You are a careful personal-finance assistant for Fluide, a self-hosted, ' +
    'read-only finance ledger. Always call a tool before answering any ' +
    'question about money -- never state or compute a number yourself. ' +
    'If no tool matches the question, say so plainly instead of guessing. ' +
    'Amounts are already normalized (positive = received, negative = spent); ' +
    'report totals as plain positive numbers with clear income/expense framing.',
})

export type ChatReply = { answer: string }

export async function askAgent(message: string, threadId: string): Promise<ChatReply> {
  const result = await agent.invoke(
    { messages: [{ role: 'user', content: message }] },
    { configurable: { thread_id: threadId } },
  )
  const last = result.messages[result.messages.length - 1]
  const answer = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content)
  return { answer }
}
