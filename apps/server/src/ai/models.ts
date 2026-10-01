import type { AiRole, AiProvider } from '@repo/ledger'
import { mapAiError } from './errors.js'

export async function fetchModels(
  role: AiRole,
  provider: AiProvider,
  endpoint: string,
  apiKey: string | null
): Promise<{ models: string[] } | { error: string; status: number }> {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const signal = AbortSignal.timeout(15000)
  try {

    if (role === 'categorization') {
      if (provider === 'typesafe') {
        const res = await fetch(new URL(endpoint).origin + '/v1/models', { headers, signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { models?: { name: string }[] }
        // The list carries only aliases (jev-latest, jev-preview); the pinned version is accepted but unlisted.
        const names = new Set(['jev-1.13.0', ...(data.models || []).map((m) => m.name).filter((name) => name.startsWith('jev-'))])
        return { models: [...names].sort() }
      } else if (provider === 'opencode') {
        let u = new URL('https://opencode.ai/zen/v1/models')
        try {
          const epUrl = new URL(endpoint)
          u = new URL(epUrl.origin + '/zen/v1/models')
        } catch {}
        const res = await fetch(u.toString(), { headers, signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { data?: { id: string }[] }
        const models = (data.data || []).map(d => d.id).filter(id => id.startsWith('jev-')).sort()
        return { models }
      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints', { signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { data?: { architecture?: { output_modalities?: string[] } } }
        const mods = data.data?.architecture?.output_modalities || []
        if (mods.includes('decisions')) {
          return { models: ['typesafe/jev-1.13'] }
        }
        return { models: [] }
      } else {
        // jev-custom
        return { models: [] }
      }
    } else { // chat
      if (provider === 'openai' || provider === 'openrouter' || provider === 'opencode' || provider === 'openai-compatible') {
        const u = endpoint.replace(/\/+$/, '') + '/models'
        const res = await fetch(u, { headers, signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { data?: { id: string, supported_parameters?: string[] }[] }
        let models = (data.data || []).map(d => {
          if (provider === 'openrouter') {
            if (!d.supported_parameters?.includes('tools')) return null
          } else if (provider === 'opencode') {
            const skip = ['claude-', 'gemini-', 'gpt-', 'grok-', 'muse-', 'jev-']
            if (skip.some(s => d.id.startsWith(s))) return null
          }
          return d.id
        }).filter(Boolean) as string[]
        models.sort()
        return { models }
      } else if (provider === 'anthropic') {
        const u = endpoint.replace(/\/+$/, '') + '/v1/models'
        const anthHeaders: Record<string, string> = { 'anthropic-version': '2023-06-01' }
        if (apiKey) anthHeaders['x-api-key'] = apiKey
        const res = await fetch(u, { headers: anthHeaders, signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { data?: { id: string }[] }
        const models = (data.data || []).map(d => d.id).sort()
        return { models }
      } else if (provider === 'gemini') {
        // The key rides in the URL here: never log `u` or put it in an error.
        const u = endpoint.replace(/\/+$/, '') + '/models?pageSize=1000' + (apiKey ? `&key=${encodeURIComponent(apiKey)}` : '')
        const res = await fetch(u, { signal })
        if (!res.ok) throw { response: { status: res.status, json: await res.text().catch(() => '') } }
        const data = (await res.json()) as { models?: { name: string, supportedGenerationMethods?: string[] }[] }
        const models = (data.models || []).map(d => {
          if (!d.supportedGenerationMethods?.includes('generateContent')) return null
          return d.name.replace(/^models\//, '')
        }).filter(Boolean) as string[]
        models.sort()
        return { models }
      }
    }
    return { models: [] }
  } catch (error) {
    const message = mapAiError(error, endpoint, apiKey, { signal, seconds: 15 })
    const err = error as Record<string, unknown> | null | undefined
    const response = err?.response as Record<string, unknown> | null | undefined
    const upstream = typeof response?.status === 'number' ? response.status : typeof err?.status === 'number' ? err.status : 0
    // A provider 4xx is passed through; network failures, timeouts and provider 5xx are a bad gateway.
    const status = upstream >= 400 && upstream < 500 ? upstream : 502
    return { error: message, status }
  }
}
