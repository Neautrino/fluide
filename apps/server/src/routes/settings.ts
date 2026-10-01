import { Hono } from 'hono'
import type { PlaidCredentials, EnableBankingCredentials } from '@repo/connectors'
import {
  getProviderCredentialsStatus,
  savePlaidCredentials,
  saveEnableBankingCredentials,
} from '../provider-credentials.js'
import { getTenantSettings } from '@repo/ledger'
import { saveGeneralSettings } from '../settings.js'
import { LOCAL_TENANT_ID } from '../ingest.js'
import { ENABLE_BANKING_AVAILABLE } from '../enable-banking-link.js'
import { getVersionInfo } from '../version.js'
import { getAiState, validateDraft, saveAiRole, removeAiRole, getRoleConfig, resolveDraftKey, recordTestResult } from '../ai/config.js'
import { testCategorization, testChat } from '../ai/test.js'
import { fetchModels } from '../ai/models.js'
import type { AiRole, AiProvider } from '@repo/ledger'

export const settingsRoutes = new Hono()

settingsRoutes.get('/general', async (c) => {
  const { displayCurrency } = await getTenantSettings(LOCAL_TENANT_ID)
  return c.json({ settings: { displayCurrency } })
})

settingsRoutes.get('/version', async (c) => c.json(await getVersionInfo()))

settingsRoutes.put('/general', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (typeof body !== 'object' || body === null) return c.json({ error: 'body must be a JSON object' }, 400)
  const result = await saveGeneralSettings(LOCAL_TENANT_ID, body)
  if (!result.ok) return c.json({ error: result.error }, 400)
  return c.json({ settings: { displayCurrency: result.settings.displayCurrency } })
})

const PROVIDERS = ['plaid', 'enable-banking'] as const
type ProviderParam = (typeof PROVIDERS)[number]
const isProvider = (value: unknown): value is ProviderParam =>
  typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)

settingsRoutes.get('/provider-credentials/:provider', async (c) => {
  const provider = c.req.param('provider')
  if (!isProvider(provider)) return c.json({ error: `provider must be one of ${PROVIDERS.join(', ')}` }, 400)
  return c.json(await getProviderCredentialsStatus(LOCAL_TENANT_ID, provider))
})

settingsRoutes.put('/provider-credentials/:provider', async (c) => {
  const provider = c.req.param('provider')
  if (!isProvider(provider)) return c.json({ error: `provider must be one of ${PROVIDERS.join(', ')}` }, 400)
  if (provider === 'enable-banking' && !ENABLE_BANKING_AVAILABLE) {
    return c.json({ error: 'Enable Banking is not available yet.' }, 403)
  }
  const result =
    provider === 'plaid'
      ? await savePlaidCredentials(LOCAL_TENANT_ID, await c.req.json<Partial<PlaidCredentials>>().catch(() => ({})))
      : await saveEnableBankingCredentials(
          LOCAL_TENANT_ID,
          await c.req.json<Partial<EnableBankingCredentials>>().catch(() => ({})),
        )
  if (!result.ok) return c.json({ error: result.error }, 400)
  return c.json({ ok: true })
})

const isAiRole = (value: unknown): value is AiRole => value === 'categorization' || value === 'chat'

settingsRoutes.get('/ai', async (c) => {
  return c.json(await getAiState(LOCAL_TENANT_ID))
})

settingsRoutes.put('/ai/:role', async (c) => {
  const role = c.req.param('role')
  if (!isAiRole(role)) return c.json({ error: 'invalid role' }, 400)
  const body = await c.req.json().catch(() => null)
  const val = validateDraft(role, body)
  if (!val.ok) return c.json({ error: val.error }, 400)
  const saveRes = await saveAiRole(LOCAL_TENANT_ID, role, val.draft)
  if ('error' in saveRes) return c.json({ error: saveRes.error }, (saveRes.status || 500) as 400 | 401 | 403 | 404 | 409 | 500 | 502)
  return c.json(await getAiState(LOCAL_TENANT_ID))
})

settingsRoutes.delete('/ai/:role', async (c) => {
  const role = c.req.param('role')
  if (!isAiRole(role)) return c.json({ error: 'invalid role' }, 400)
  await removeAiRole(LOCAL_TENANT_ID, role)
  return c.json(await getAiState(LOCAL_TENANT_ID))
})

settingsRoutes.post('/ai/:role/test', async (c) => {
  const role = c.req.param('role')
  if (!isAiRole(role)) return c.json({ error: 'invalid role' }, 400)
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'invalid body' }, 400)
  
  const isSaved = Object.keys(body).length === 0
  
  let configToTest: { provider: AiProvider, endpoint: string, model: string, apiKey: string | null }
  if (isSaved) {
    const saved = await getRoleConfig(LOCAL_TENANT_ID, role)
    if (!saved) return c.json({ error: 'Role not set up' }, 409)
    configToTest = saved
  } else {
    const val = validateDraft(role, body)
    if (!val.ok) return c.json({ error: val.error }, 400)
    const d = val.draft
    const resKey = await resolveDraftKey(LOCAL_TENANT_ID, d.provider, d.key)
    if (resKey.error) return c.json({ error: resKey.error }, 404)
    configToTest = { provider: d.provider, endpoint: d.endpoint, model: d.model, apiKey: resKey.apiKey }
  }

  const result = role === 'categorization' ? await testCategorization(configToTest) : await testChat(configToTest)
  
  if (isSaved) {
    await recordTestResult(LOCAL_TENANT_ID, role, result)
  }
  return c.json(result)
})

settingsRoutes.post('/ai/:role/models', async (c) => {
  const role = c.req.param('role')
  if (!isAiRole(role)) return c.json({ error: 'invalid role' }, 400)
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid body' }, 400)
  
  // fake draft to reuse validation (model not required for /models)
  const val = validateDraft(role, { ...body, model: 'temp-model' })
  if (!val.ok) return c.json({ error: val.error }, 400)
  const d = val.draft
  const resKey = await resolveDraftKey(LOCAL_TENANT_ID, d.provider, d.key)
  if (resKey.error) return c.json({ error: resKey.error }, 404)
  
  const res = await fetchModels(role, d.provider, d.endpoint, resKey.apiKey)
  if ('error' in res) return c.json({ error: res.error }, (res.status || 500) as 400 | 401 | 403 | 404 | 409 | 500 | 502)
  return c.json(res)
})
