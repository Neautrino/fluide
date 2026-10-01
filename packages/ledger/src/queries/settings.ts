import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { tenantSettings, TENANT_SETTINGS_DEFAULTS } from '../schema/index.js'

export type TenantSettings = {
  displayCurrency: string
  updatedAt: Date | null
}

export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const [row] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId))
  if (!row) return { ...TENANT_SETTINGS_DEFAULTS, updatedAt: null }
  return { displayCurrency: row.displayCurrency, updatedAt: row.updatedAt }
}

export async function saveTenantSettings(
  tenantId: string,
  input: Omit<TenantSettings, 'updatedAt'>,
): Promise<TenantSettings> {
  const values = { displayCurrency: input.displayCurrency, updatedAt: new Date() }
  await db
    .insert(tenantSettings)
    .values({ tenantId, ...values })
    .onConflictDoUpdate({ target: tenantSettings.tenantId, set: values })
  return getTenantSettings(tenantId)
}
