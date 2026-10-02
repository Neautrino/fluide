import type { AiProvider, AiRole } from '@repo/ledger'

/** What Settings shows before anything is saved: where the provider answers, which model to start with, where to get a key. */
export type AiPreset = {
  role: AiRole
  provider: AiProvider
  label: string
  endpoint: string
  /** Empty when the user must pick one (custom endpoints). */
  defaultModel: string
  keyRequired: boolean
  keyHint: string
  keyUrl: string | null
  /** Other endpoints offered as one-click choices (OpenAI-compatible local servers). */
  endpointChoices?: { label: string; endpoint: string }[]
  note?: string
}

const CATEGORIZATION_SENDS = 'Transaction descriptions that no rule matched, and your category names.'
const CHAT_SENDS =
  'Your questions and the results of the read-only ledger queries the assistant runs: balances, account masks and up to 50 transactions per query.'

export const AI_SENDS: Record<AiRole, string> = { categorization: CATEGORIZATION_SENDS, chat: CHAT_SENDS }

export const AI_PRESETS: AiPreset[] = [
  {
    role: 'categorization',
    provider: 'typesafe',
    label: 'TypeSafe',
    endpoint: 'https://api.typesafe.ai/v1/systemone',
    defaultModel: 'jev-1.13.0',
    keyRequired: true,
    keyHint: 'From console.typesafe.ai',
    keyUrl: 'https://console.typesafe.ai/keys',
    note: 'Made by TypeSafe, who build Jev. $0.042 per 1M input tokens; output is free.',
  },
  {
    role: 'categorization',
    provider: 'opencode',
    label: 'OpenCode Zen',
    endpoint: 'https://opencode.ai/zen/v1/systemone',
    defaultModel: 'jev-1.13-free',
    keyRequired: true,
    keyHint: 'Your OpenCode Zen API key',
    keyUrl: 'https://opencode.ai/auth',
    note: 'jev-1.13-free is free for a limited time; switch to jev-1.13 if it stops answering.',
  },
  {
    role: 'categorization',
    provider: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/alpha/decisions',
    defaultModel: 'typesafe/jev-1.13',
    keyRequired: true,
    keyHint: 'Starts with sk-or-',
    keyUrl: 'https://openrouter.ai/settings/keys',
    note: 'Billed per input token by OpenRouter; output tokens are free.',
  },
  {
    role: 'categorization',
    provider: 'jev-custom',
    label: 'Custom Jev endpoint',
    endpoint: '',
    defaultModel: '',
    keyRequired: true,
    keyHint: 'The key your Jev host issued',
    keyUrl: null,
    note: 'Any host serving the Jev System One API (state + questions in, typed answers with confidence out). Use the full URL.',
  },
  {
    role: 'chat',
    provider: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyRequired: true,
    keyHint: 'Starts with sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    role: 'chat',
    provider: 'anthropic',
    label: 'Claude',
    endpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5',
    keyRequired: true,
    keyHint: 'Starts with sk-ant-',
    keyUrl: 'https://platform.claude.com/settings/keys',
  },
  {
    role: 'chat',
    provider: 'gemini',
    label: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.5-flash-lite',
    keyRequired: true,
    keyHint: 'Starts with AIza',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    role: 'chat',
    provider: 'opencode',
    label: 'OpenCode Zen',
    endpoint: 'https://opencode.ai/zen/v1',
    defaultModel: 'glm-5.3-flash',
    keyRequired: true,
    keyHint: 'Your OpenCode Zen API key',
    keyUrl: 'https://opencode.ai/auth',
    note: 'Lists models served on chat/completions. Free models refuse callers other than the OpenCode app.',
  },
  {
    role: 'chat',
    provider: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyRequired: true,
    keyHint: 'Starts with sk-or-',
    keyUrl: 'https://openrouter.ai/settings/keys',
  },
  {
    role: 'chat',
    provider: 'openai-compatible',
    label: 'OpenAI-compatible',
    endpoint: 'http://localhost:11434/v1',
    defaultModel: '',
    keyRequired: false,
    keyHint: 'Leave empty for a local server that needs no key',
    keyUrl: null,
    endpointChoices: [
      { label: 'Ollama', endpoint: 'http://localhost:11434/v1' },
      { label: 'LM Studio', endpoint: 'http://localhost:1234/v1' },
    ],
    note: 'The model must support tool calling; the connection test checks it.',
  },
]

export function findPreset(role: AiRole, provider: AiProvider): AiPreset | undefined {
  return AI_PRESETS.find((p) => p.role === role && p.provider === provider)
}

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  typesafe: 'TypeSafe',
  opencode: 'OpenCode Zen',
  openrouter: 'OpenRouter',
  'jev-custom': 'Custom Jev',
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
  'openai-compatible': 'OpenAI-compatible',
}
