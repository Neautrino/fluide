/** SOURCE OF TRUTH: the chat LLM client for the S1-7 chat agent.
 * WHAT: a single ChatOpenAI instance pointed at OpenAI's gpt-4o-mini.
 * WHY: centralizing construction means swapping models/providers later is
 * a change to this file alone -- agent.ts and tools.ts never reference a
 * model id or endpoint directly. Switched from OpenCode Go's mimo-v2.5:
 * Go's chat-completions endpoint needs an active paid subscription this
 * account didn't have (confirmed live: 403 "An active OpenCode Go
 * subscription is required"), and OpenCode's free chat tier explicitly
 * blocks non-OpenCode-client callers (confirmed live: 403 FreeTierError,
 * even spoofing their own User-Agent) -- both dead ends regardless of
 * code correctness. No per-thread instance needed here, unlike the Go
 * path -- OpenAI has no per-conversation routing header requirement, so
 * one shared client is correct and simpler.
 * WHERE: owns "how do we talk to the chat model" only. Reads
 * OPENAI_API_KEY -- a different secret from jev.ts's OPENCODE_API_KEY.
 * jev.ts's categorization pipeline is untouched, still on OpenCode/Jev
 * (confirmed still working live on that key -- this swap is chat-only).
 */
import { ChatOpenAI } from '@langchain/openai'

export const chatModel = new ChatOpenAI({
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  temperature: 0,
})
