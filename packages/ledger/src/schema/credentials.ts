import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  primaryKey,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

export const connectorProvider = pgEnum('connector_provider', ['plaid', 'enable-banking'])

export type ConnectorProvider = (typeof connectorProvider.enumValues)[number]

export const connectorKind = pgEnum('connector_kind', ['bank', 'gst-gsp', 'aa-fiu', 'tax-portal-upload', 'manual'])

export const connectorStatus = pgEnum('connector_status', ['active', 'reauth_required', 'error', 'disconnected'])

export type ConnectorStatus = (typeof connectorStatus.enumValues)[number]

/**
 * provider_credentials — the API credentials Fluide needs to talk to a
 * connector provider (Plaid client_id/secret, Enable Banking app_id + a
 * private-key file path), entered once via Settings. One row per (tenant,
 * provider); fieldsCiphertext/fieldsNonce hold an AES-256-GCM-encrypted
 * JSON blob (apps/server's vault.ts) — the plaintext is never a column.
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

/**
 * connectors — one row per linked bank connection. The per-connection token
 * (Plaid access_token, Enable Banking session_id) is AES-256-GCM-encrypted by
 * apps/server's vault.ts into credentialCiphertext/credentialNonce, with the
 * row id in the AAD — the plaintext is never a column. externalId is the
 * provider's own id for the connection (Plaid item_id), null when it has none.
 * replacedByConnectorId records that a newer login took this one over;
 * countedUntil is the derived date from which the successor's history covers
 * this login, so the two are never counted twice.
 */
export const connectors = pgTable(
  'connectors',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    kind: connectorKind('kind').notNull().default('bank'),
    provider: connectorProvider('provider').notNull(),
    externalId: text('external_id'),
    institutionId: text('institution_id'),
    institutionName: text('institution_name'),
    credentialCiphertext: text('credential_ciphertext'),
    credentialNonce: text('credential_nonce'),
    cursor: text('cursor'),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    status: connectorStatus('status').notNull().default('active'),
    statusReason: text('status_reason'),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    replacedByConnectorId: uuid('replaced_by_connector_id').references((): AnyPgColumn => connectors.id),
    countedUntil: timestamp('counted_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('connectors_replaced_by_idx').on(table.replacedByConnectorId),
    uniqueIndex('connectors_tenant_provider_external_id_unique_idx')
      .on(table.tenantId, table.provider, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    check(
      'connectors_credential_unless_disconnected',
      sql`${table.status} = 'disconnected'
        OR (${table.credentialCiphertext} IS NOT NULL AND ${table.credentialNonce} IS NOT NULL)`,
    ),
  ],
)
