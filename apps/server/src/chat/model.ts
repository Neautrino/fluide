import { ChatOpenAI } from '@langchain/openai'
import { secretEnv } from '@repo/ledger'

export const chatModel = new ChatOpenAI({
  model: 'gpt-4o-mini',
  apiKey: secretEnv('OPENAI_API_KEY') ?? '',
  temperature: 0,
})
