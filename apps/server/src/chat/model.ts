import { ChatOpenAI } from '@langchain/openai'

export const chatModel = new ChatOpenAI({
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  temperature: 0,
})
