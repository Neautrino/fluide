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

/** Memory is per threadId in process (MemorySaver) on purpose: by the user's
 * rule, a chat never survives closing it or a server restart. */
export async function askAgent(message: string, threadId: string): Promise<ChatReply> {
  const result = await agent.invoke(
    { messages: [{ role: 'user', content: message }] },
    { configurable: { thread_id: threadId } },
  )
  const last = result.messages[result.messages.length - 1]
  const answer = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content)
  return { answer }
}
