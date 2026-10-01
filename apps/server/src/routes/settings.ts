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

export const settingsRoutes = new Hono()

settingsRoutes.get('/general', async (c) => {
  const { displayCurrency } = await getTenantSettings(LOCAL_TENANT_ID)
  return c.json({ settings: { displayCurrency } })
})

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
