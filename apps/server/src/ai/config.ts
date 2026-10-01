/* SOURCE OF TRUTH: per-tenant AI settings and their encrypted keys (ai_settings, ai_credentials)
 * Invariant: key AAD is `${tenantId}:ai-key:${credentialId}`; a credential no role uses is deleted with the change.
 * Never: return a decrypted key to apps/web, a log line, an error message or an LLM tool call.
 * See: ADR 041 — why keys are per provider and shared across roles
 */

import { eq, and } from 'drizzle-orm'
import { db, aiCredentials, aiSettings } from '@repo/ledger'
import type { AiRole, AiProvider } from '@repo/ledger'
import { encrypt, decrypt } from '../vault.js'
import { isUuid } from '../routes/validate.js'
import { AI_PRESETS, AI_SENDS, PROVIDER_LABEL } from './presets.js'
import type { AiPreset } from './presets.js'

export type AiRoleStatus = {
  provider: AiProvider
  endpoint: string
  model: string
  credentialId: string | null
  updatedAt: string
  lastTest: { ok: boolean; at: string; message: string } | null
}

export type AiCredentialStatus = {
  id: string
  provider: AiProvider
  label: string
  updatedAt: string
  usedBy: AiRole[]
}

export type AiState = {
  presets: AiPreset[]
  sends: Record<AiRole, string>
  roles: { categorization: AiRoleStatus | null; chat: AiRoleStatus | null }
  credentials: AiCredentialStatus[]
}

export type AiKeyChoice =
  | { use: 'existing'; credentialId: string }
  | { use: 'new'; apiKey: string }
  | { use: 'replace'; credentialId: string; apiKey: string }
  | { use: 'none' }

export type AiDraft = {
  provider: AiProvider
  endpoint: string
  model: string
  key: AiKeyChoice
}

export type AiTestResult = { ok: boolean; message: string; latencyMs: number | null }

export function validateDraft(role: AiRole, draft: unknown): { ok: true; draft: AiDraft } | { ok: false; error: string } {
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'Invalid draft body' }
  const d = draft as Record<string, unknown>
  const provider = d.provider as AiProvider
  let endpointRaw = d.endpoint
  if (role === 'categorization' && !['typesafe', 'opencode', 'openrouter', 'jev-custom'].includes(provider)) {
    return { ok: false, error: `Invalid provider ${provider} for categorization` }
  }
  if (role === 'chat' && !['opencode', 'openrouter', 'openai', 'anthropic', 'gemini', 'openai-compatible'].includes(provider)) {
    return { ok: false, error: `Invalid provider ${provider} for chat` }
  }

  if (typeof endpointRaw !== 'string') return { ok: false, error: 'endpoint must be a string' }
  const endpoint = endpointRaw.trim().replace(/\/+$/, '')
  let modelRaw = d.model
  try {
    const u = new URL(endpoint)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
    if (u.username || u.password) return { ok: false, error: 'URL must not contain credentials' }
  } catch {
    return { ok: false, error: 'Invalid endpoint URL' }
  }

  if (typeof modelRaw !== 'string') return { ok: false, error: 'model must be a string' }
  const model = modelRaw.trim()
  if (model.length === 0 || model.length > 200) return { ok: false, error: 'model must be 1-200 chars' }

  const key = d.key as Record<string, unknown> | undefined
  if (!key || typeof key !== 'object') return { ok: false, error: 'key must be an object' }

  const preset = AI_PRESETS.find(p => p.role === role && p.provider === provider)
  if (!preset) return { ok: false, error: 'Preset not found' }

  let validatedKey: AiKeyChoice
  if (key.use === 'none') {
    if (preset.keyRequired) return { ok: false, error: 'Key is required for this provider' }
    validatedKey = { use: 'none' }
  } else if (key.use === 'existing') {
    if (typeof key.credentialId !== 'string') return { ok: false, error: 'credentialId must be a string' }
    validatedKey = { use: 'existing', credentialId: key.credentialId }
  } else if (key.use === 'new') {
    if (typeof key.apiKey !== 'string') return { ok: false, error: 'apiKey must be a string' }
    const apiKey = key.apiKey.trim()
    if (!apiKey || apiKey.length > 4000) return { ok: false, error: 'Key must be 1-4000 chars' }
    if (/\s/.test(apiKey)) return { ok: false, error: 'Paste only the key, without spaces or line breaks' }
    validatedKey = { use: 'new', apiKey }
  } else if (key.use === 'replace') {
    if (typeof key.credentialId !== 'string') return { ok: false, error: 'credentialId must be a string' }
    if (typeof key.apiKey !== 'string') return { ok: false, error: 'apiKey must be a string' }
    const apiKey = key.apiKey.trim()
    if (!apiKey || apiKey.length > 4000) return { ok: false, error: 'Key must be 1-4000 chars' }
    if (/\s/.test(apiKey)) return { ok: false, error: 'Paste only the key, without spaces or line breaks' }
    validatedKey = { use: 'replace', credentialId: key.credentialId, apiKey }
  } else {
    return { ok: false, error: 'Invalid key.use' }
  }

  return {
    ok: true,
    draft: { provider, endpoint, model, key: validatedKey }
  }
}

export async function getAiState(tenantId: string): Promise<AiState> {
  const [settings, credentials] = await Promise.all([
    db.select().from(aiSettings).where(eq(aiSettings.tenantId, tenantId)),
    db.select().from(aiCredentials).where(eq(aiCredentials.tenantId, tenantId)),
  ])

  const creds: AiCredentialStatus[] = credentials.map(c => {
    const usedBy: AiRole[] = settings.filter(s => s.credentialId === c.id).map(s => s.role)
    return {
      id: c.id,
      provider: c.provider,
      label: c.label,
      updatedAt: c.updatedAt.toISOString(),
      usedBy,
    }
  })

  const state: AiState = {
    presets: AI_PRESETS,
    sends: AI_SENDS,
    roles: { categorization: null, chat: null },
    credentials: creds,
  }

  for (const s of settings) {
    state.roles[s.role] = {
      provider: s.provider,
      endpoint: s.endpoint,
      model: s.model,
      credentialId: s.credentialId,
      updatedAt: s.updatedAt.toISOString(),
      lastTest: s.lastTestOk !== null ? { ok: s.lastTestOk, at: s.lastTestAt!.toISOString(), message: s.lastTestMessage || '' } : null,
    }
  }

  return state
}

export async function getRoleConfig(tenantId: string, role: AiRole) {
  const setting = await db.query.aiSettings.findFirst({
    where: and(eq(aiSettings.tenantId, tenantId), eq(aiSettings.role, role))
  })
  if (!setting) return null

  let apiKey: string | null = null
  let credentialVersion = ''
  if (setting.credentialId) {
    const cred = await db.query.aiCredentials.findFirst({
      where: and(eq(aiCredentials.tenantId, tenantId), eq(aiCredentials.id, setting.credentialId))
    })
    if (cred) {
      const aad = `${tenantId}:ai-key:${cred.id}`
      apiKey = decrypt({ ciphertext: cred.keyCiphertext, nonce: cred.keyNonce }, aad)
      credentialVersion = `${cred.id}:${cred.updatedAt.getTime()}`
    }
  }

  return {
    provider: setting.provider,
    endpoint: setting.endpoint,
    model: setting.model,
    apiKey,
    /** Changes when this role's settings or its (possibly shared) key change. */
    version: `${setting.updatedAt.getTime()}:${credentialVersion}`
  }
}

export async function resolveDraftKey(tenantId: string, provider: AiProvider, key: AiKeyChoice): Promise<{ apiKey: string | null, error?: string }> {
  if (key.use === 'none') return { apiKey: null }
  if (key.use === 'new') return { apiKey: key.apiKey }
  
  if (!isUuid(key.credentialId)) return { apiKey: null, error: 'unknown key for this provider' }
  const cred = await db.query.aiCredentials.findFirst({
    where: and(eq(aiCredentials.tenantId, tenantId), eq(aiCredentials.id, key.credentialId))
  })
  if (!cred || cred.provider !== provider) return { apiKey: null, error: 'unknown key for this provider' }
  
  if (key.use === 'replace') return { apiKey: key.apiKey }
  
  const aad = `${tenantId}:ai-key:${cred.id}`
  const apiKey = decrypt({ ciphertext: cred.keyCiphertext, nonce: cred.keyNonce }, aad)
  return { apiKey }
}

export async function saveAiRole(tenantId: string, role: AiRole, draft: AiDraft): Promise<{ok: true} | {error: string, status: number}> {
  return await db.transaction(async (tx) => {
    let credentialId: string | null = null

    if (draft.key.use === 'existing' || draft.key.use === 'replace') {
      if (!isUuid(draft.key.credentialId)) return { error: 'unknown key for this provider', status: 404 }
      const cred = await tx.query.aiCredentials.findFirst({
        where: and(eq(aiCredentials.tenantId, tenantId), eq(aiCredentials.id, draft.key.credentialId))
      })
      if (!cred || cred.provider !== draft.provider) return { error: 'unknown key for this provider', status: 404 }
      credentialId = cred.id

      if (draft.key.use === 'replace') {
        const aad = `${tenantId}:ai-key:${cred.id}`
        const { ciphertext, nonce } = encrypt(draft.key.apiKey, aad)
        await tx.update(aiCredentials)
          .set({ keyCiphertext: ciphertext, keyNonce: nonce, updatedAt: new Date() })
          .where(eq(aiCredentials.id, cred.id))
      }
    } else if (draft.key.use === 'new') {
      const id = globalThis.crypto.randomUUID()
      const aad = `${tenantId}:ai-key:${id}`
      const { ciphertext, nonce } = encrypt(draft.key.apiKey, aad)
      
      const existing = await tx.select({ count: aiCredentials.id }).from(aiCredentials)
        .where(and(eq(aiCredentials.tenantId, tenantId), eq(aiCredentials.provider, draft.provider)))
      
      let label = PROVIDER_LABEL[draft.provider] || draft.provider
      if (existing.length > 0) label += ` · ${role}`

      await tx.insert(aiCredentials).values({
        id,
        tenantId,
        provider: draft.provider,
        label,
        keyCiphertext: ciphertext,
        keyNonce: nonce,
      })
      credentialId = id
    }

    await tx.insert(aiSettings)
      .values({
        tenantId,
        role,
        provider: draft.provider,
        endpoint: draft.endpoint,
        model: draft.model,
        credentialId,
        lastTestOk: null,
        lastTestAt: null,
        lastTestMessage: null,
      })
      .onConflictDoUpdate({
        target: [aiSettings.tenantId, aiSettings.role],
        set: {
          provider: draft.provider,
          endpoint: draft.endpoint,
          model: draft.model,
          credentialId,
          lastTestOk: null,
          lastTestAt: null,
          lastTestMessage: null,
          updatedAt: new Date(),
        }
      })

    // Cleanup unused credentials
    const used = await tx.select({ id: aiSettings.credentialId }).from(aiSettings).where(eq(aiSettings.tenantId, tenantId))
    const usedIds = new Set(used.map(u => u.id).filter(Boolean))
    
    const all = await tx.select({ id: aiCredentials.id }).from(aiCredentials).where(eq(aiCredentials.tenantId, tenantId))
    for (const c of all) {
      if (!usedIds.has(c.id)) {
        await tx.delete(aiCredentials).where(eq(aiCredentials.id, c.id))
      }
    }

    return { ok: true }
  })
}

export async function removeAiRole(tenantId: string, role: AiRole) {
  await db.transaction(async (tx) => {
    await tx.delete(aiSettings).where(and(eq(aiSettings.tenantId, tenantId), eq(aiSettings.role, role)))
    
    // Cleanup unused credentials
    const used = await tx.select({ id: aiSettings.credentialId }).from(aiSettings).where(eq(aiSettings.tenantId, tenantId))
    const usedIds = new Set(used.map(u => u.id).filter(Boolean))
    
    const all = await tx.select({ id: aiCredentials.id }).from(aiCredentials).where(eq(aiCredentials.tenantId, tenantId))
    for (const c of all) {
      if (!usedIds.has(c.id)) {
        await tx.delete(aiCredentials).where(eq(aiCredentials.id, c.id))
      }
    }
  })
}

export async function recordTestResult(tenantId: string, role: AiRole, result: AiTestResult) {
  await db.update(aiSettings)
    .set({
      lastTestOk: result.ok,
      lastTestAt: new Date(),
      lastTestMessage: result.message,
    })
    .where(and(eq(aiSettings.tenantId, tenantId), eq(aiSettings.role, role)))
}
