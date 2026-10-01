import { createAgent } from 'langchain'
import { MemorySaver } from '@langchain/langgraph'
import { buildChatModel } from './model.js'
import { getRoleConfig } from '../ai/config.js'
import { mapAiError } from '../ai/errors.js'
import { chatTools } from './tools.js'

const checkpointer = new MemorySaver()

let cachedAgent: { version: string, agent: any } | null = null

export class AgentNotConfiguredError extends Error {
  constructor() {
    super('The assistant has no model yet. Add one in Settings → Assistant.')
    this.name = 'AgentNotConfiguredError'
  }
}

/** Carries an already-mapped, key-redacted message; the raw provider error never leaves this file. */
export class AgentReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentReplyError'
  }
}

async function getAgent(tenantId: string) {
  const config = await getRoleConfig(tenantId, 'chat')
  if (!config) throw new AgentNotConfiguredError()

  if (cachedAgent?.version === config.version) {
    return { agent: cachedAgent.agent, config }
  }

  const model = buildChatModel(config)
  const agent = createAgent({
    model,
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
  cachedAgent = { version: config.version, agent }
  return { agent, config }
}

export type ChatReply = { answer: string }

/** Memory is per threadId in process (MemorySaver) on purpose: by the user's
 * rule, a chat never survives closing it or a server restart. */
export async function askAgent(message: string, threadId: string, tenantId: string): Promise<ChatReply> {
  const { agent, config } = await getAgent(tenantId)
  let result
  try {
    result = await agent.invoke(
      { messages: [{ role: 'user', content: message }] },
      { configurable: { thread_id: threadId } },
    )
  } catch (error) {
    throw new AgentReplyError(mapAiError(error, config.endpoint, config.apiKey))
  }
  const last = result.messages[result.messages.length - 1]
  const answer = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content)
  return { answer }
}
