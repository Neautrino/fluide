import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, timestamp, check } from 'drizzle-orm/pg-core'

export const TENANT_SETTINGS_DEFAULTS = {
  displayCurrency: 'USD',
} as const

/**
 * tenant_settings — tenant-wide display preferences, one row per tenant.
 * No row = TENANT_SETTINGS_DEFAULTS. displayCurrency filters what the app
 * shows; Fluide never converts between currencies.
 */
export const tenantSettings = pgTable(
  'tenant_settings',
  {
    tenantId: uuid('tenant_id').primaryKey(),
    displayCurrency: text('display_currency').notNull().default(TENANT_SETTINGS_DEFAULTS.displayCurrency),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('tenant_settings_display_currency_iso', sql`${table.displayCurrency} ~ '^[A-Z]{3}$'`)],
)
