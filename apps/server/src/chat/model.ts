import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { AiProvider } from '@repo/ledger'

/** `maxRetries` unset keeps LangChain's default retries (the agent); the connection test passes 0. */
export function buildChatModel(
  config: { provider: AiProvider, endpoint: string, model: string, apiKey: string | null },
  { maxRetries }: { maxRetries?: number } = {},
) {
  const { provider, endpoint, model, apiKey } = config
  const key = apiKey ?? 'not-needed'

  if (provider === 'anthropic') {
    return new ChatAnthropic({ model, apiKey: apiKey || undefined, temperature: 0, anthropicApiUrl: endpoint, maxRetries })
  }
  if (provider === 'gemini') {
    let baseUrl = endpoint
    let apiVersion = undefined
    try {
      const u = new URL(endpoint)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length > 0) {
        apiVersion = parts[parts.length - 1]
        u.pathname = '/'
        baseUrl = u.toString().replace(/\/$/, '')
      }
    } catch {}
    return new ChatGoogleGenerativeAI({ model, apiKey: apiKey || undefined, temperature: 0, baseUrl, apiVersion, maxRetries })
  }
  
  return new ChatOpenAI({
    model,
    apiKey: key,
    temperature: 0,
    maxRetries,
    configuration: { baseURL: endpoint }
  })
}
