import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core'

export const connectorProvider = pgEnum('connector_provider', ['plaid', 'enable-banking'])

export type ConnectorProvider = (typeof connectorProvider.enumValues)[number]

/**
 * provider_credentials — the API credentials Fluide needs to talk to a
 * connector provider (Plaid client_id/secret, Enable Banking app_id + a
 * private-key file path), entered once via Settings. One row per (tenant,
 * provider); fieldsCiphertext/fieldsNonce hold an AES-256-GCM-encrypted
 * JSON blob (apps/server's vault.ts) — the plaintext is never a column.
 * Distinct from PLAN.md §2's `connectors` table (per-connection OAuth
 * tokens), which is not modeled yet.
 */
export const providerCredentials = pgTable(
  'provider_credentials',
  {
    tenantId: uuid('tenant_id').notNull(),
    provider: connectorProvider('provider').notNull(),
    fieldsCiphertext: text('fields_ciphertext').notNull(),
    fieldsNonce: text('fields_nonce').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.provider] })],
)
