import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, timestamp, boolean, pgEnum, primaryKey, unique, foreignKey, check } from 'drizzle-orm/pg-core'

export const aiRole = pgEnum('ai_role', ['categorization', 'chat'])

export type AiRole = (typeof aiRole.enumValues)[number]

export const aiProvider = pgEnum('ai_provider', [
  'typesafe',
  'opencode',
  'openrouter',
  'jev-custom',
  'openai',
  'anthropic',
  'gemini',
  'openai-compatible',
])

export type AiProvider = (typeof aiProvider.enumValues)[number]

/**
 * ai_credentials — API keys for AI providers, entered in Settings. One
 * provider can have several keys; each ai_settings role points at one, so a
 * key is shared by both roles unless the user gives a role its own.
 * keyCiphertext/keyNonce are AES-256-GCM (apps/server's vault.ts) with the
 * row id in the AAD; the plaintext key is never a column.
 */
export const aiCredentials = pgTable(
  'ai_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    provider: aiProvider('provider').notNull(),
    label: text('label').notNull(),
    keyCiphertext: text('key_ciphertext').notNull(),
    keyNonce: text('key_nonce').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('ai_credentials_tenant_id_provider_unique').on(table.tenantId, table.id, table.provider)],
)

/**
 * ai_settings — which provider, endpoint and model each AI role uses, one
 * row per (tenant, role). No row = the role is not set up. The composite
 * foreign key keeps a role on a key of its own tenant and provider.
 */
export const aiSettings = pgTable(
  'ai_settings',
  {
    tenantId: uuid('tenant_id').notNull(),
    role: aiRole('role').notNull(),
    provider: aiProvider('provider').notNull(),
    endpoint: text('endpoint').notNull(),
    model: text('model').notNull(),
    credentialId: uuid('credential_id'),
    lastTestOk: boolean('last_test_ok'),
    lastTestAt: timestamp('last_test_at', { withTimezone: true }),
    lastTestMessage: text('last_test_message'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.role] }),
    foreignKey({
      name: 'ai_settings_credential_fk',
      columns: [table.tenantId, table.credentialId, table.provider],
      foreignColumns: [aiCredentials.tenantId, aiCredentials.id, aiCredentials.provider],
    }),
    check(
      'ai_settings_role_provider',
      sql`(${table.role} = 'categorization' AND ${table.provider}::text IN ('typesafe', 'opencode', 'openrouter', 'jev-custom'))
        OR (${table.role} = 'chat' AND ${table.provider}::text IN ('opencode', 'openrouter', 'openai', 'anthropic', 'gemini', 'openai-compatible'))`,
    ),
    check('ai_settings_key_unless_compatible', sql`${table.credentialId} IS NOT NULL OR ${table.provider} = 'openai-compatible'`),
    check('ai_settings_endpoint_http', sql`${table.endpoint} ~ '^https?://'`),
    check('ai_settings_model_present', sql`length(btrim(${table.model})) > 0`),
  ],
)
