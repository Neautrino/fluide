/** SOURCE OF TRUTH: the ledger's schema — the double-entry core (accounts,
 * transactions, postings, balance_assertions) plus Slice 1's categorization
 * tables (categories, categorization_rules, review_queue, audit_log).
 * WHAT: Drizzle table definitions (PLAN.md §2) plus provider_credentials —
 * app-level connector API credentials (Plaid client_id/secret, Enable
 * Banking app_id + key path), entered via Settings and AES-256-GCM-
 * encrypted before they reach a row (apps/server's vault.ts). PLAN.md's
 * own `connectors` table (per-connection OAuth tokens) is still not
 * modeled — connection-store.ts still owns that (ADR 009).
 * WHY: `postings` is the only writable source of truth for money movement.
 * Balances are NEVER stored as ground truth — always derived by replaying
 * postings, reconciled against the bank via balance_assertions.
 * WHERE: this file owns table SHAPE only. The sum-to-zero rule and posting
 * immutability are hand-written trigger SQL in migrations/0001 — Drizzle's
 * schema DSL can't express them, and schema alone does not stop bad writes.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  bigint,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const accountType = pgEnum('account_type', [
  'asset',
  'liability',
  'income',
  'expense',
  'equity',
])

export const transactionStatus = pgEnum('transaction_status', [
  'pending',
  'cleared',
  'reconciled',
])

export const transactionSource = pgEnum('transaction_source', [
  'manual',
  'import',
  'receipt-match',
])

export const transactionCreatedBy = pgEnum('transaction_created_by', [
  'user',
  'ai',
  'connector',
])

export const balanceAssertionSource = pgEnum('balance_assertion_source', [
  'bank-feed',
  'manual',
])

export const reviewQueueStatus = pgEnum('review_queue_status', [
  'pending',
  'approved',
  'rejected',
])

export const jevConfidenceBand = pgEnum('jev_confidence_band', ['high', 'medium', 'low'])

export const auditLogAction = pgEnum('audit_log_action', [
  'auto_applied',
  'queued_for_review',
  'approved',
  'rejected',
  'recategorized',
])

export const categorizationRuleStatus = pgEnum('categorization_rule_status', ['proposed', 'active', 'rejected'])

export const connectorProvider = pgEnum('connector_provider', ['plaid', 'enable-banking'])

export type ConnectorProvider = (typeof connectorProvider.enumValues)[number]

/**
 * accounts — the chart of accounts. `path` follows hledger/beancount's
 * colon-hierarchical convention, e.g. "assets:bank:plaid:checking".
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    type: accountType('type').notNull(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    currency: text('currency').notNull(), // ISO 4217, e.g. "USD"
    externalRef: text('external_ref'), // connector account uid (e.g. Plaid account_id)
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('accounts_tenant_idx').on(table.tenantId),
    index('accounts_path_idx').on(table.path),
  ],
)

/**
 * transactions — a real-world event. Holds no amount itself — its postings
 * carry the money movement and must sum to zero per currency (enforced by
 * migration, not here).
 *
 * `externalRef` is an addition beyond PLAN.md §2's original schema listing:
 * connector-sourced rows need a way to detect "already ingested" (format
 * "plaid:<transaction_id>") since Plaid's transactionsSync re-returns full
 * history without a persisted cursor. Null for manual/receipt-matched rows.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    source: transactionSource('source').notNull(),
    status: transactionStatus('status').notNull().default('pending'),
    createdBy: transactionCreatedBy('created_by').notNull(),
    externalRef: text('external_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_tenant_date_idx').on(table.tenantId, table.date),
    uniqueIndex('transactions_external_ref_unique_idx')
      .on(table.externalRef)
      .where(sql`${table.externalRef} IS NOT NULL`),
  ],
)

/**
 * postings — the actual double-entry rows. N per transaction; every set of
 * postings sharing a transaction_id + currency must sum to zero. Money
 * columns are append-only: migrations/0001_ledger_guardrails.sql rejects
 * DELETE and any UPDATE except category_id/tags. To correct a money
 * mistake, post a reversing entry — never edit or remove a row.
 */
export const postings = pgTable(
  'postings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
    currency: text('currency').notNull(),
    counterpartyRaw: text('counterparty_raw'),
    counterpartyResolved: text('counterparty_resolved'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    tags: text('tags').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('postings_transaction_idx').on(table.transactionId),
    index('postings_account_idx').on(table.accountId),
  ],
)

/**
 * categories — the categorization taxonomy (S1-1). `tenantId IS NULL` =
 * shared system category (seeded, is_system = true); `tenantId IS NOT NULL`
 * = a tenant's own custom category, layered on top. `detailed` matches
 * Plaid PFCv2 identifiers verbatim (e.g. "FOOD_AND_DRINK_GROCERIES") so a
 * future Plaid connector maps onto it with no translation table.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    primary: text('primary').notNull(),
    detailed: text('detailed').notNull(),
    label: text('label').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categories_tenant_idx').on(table.tenantId),
    index('categories_primary_idx').on(table.primary),
    uniqueIndex('categories_system_detailed_unique_idx')
      .on(table.detailed)
      .where(sql`${table.tenantId} IS NULL`),
    uniqueIndex('categories_tenant_detailed_unique_idx')
      .on(table.tenantId, table.detailed)
      .where(sql`${table.tenantId} IS NOT NULL`),
  ],
)

/**
 * categorization_rules — deterministic pattern → category (S1-2), checked
 * before any AI fallback (S1-3) so known vendors cost zero AI calls.
 * `confidenceLearned`/`timesMatched` let an accepted AI categorization
 * become a permanent rule instead of a one-off relabel. `isUserCustom`
 * rules always win over system-learned ones on the same posting.
 * `status`: only 'active' rules are ever matched. A rule learned from a
 * human approval/recategorize starts 'proposed' and does nothing until the
 * user activates it (PLAN.md §5.2: the loop that turns corrections into an
 * auto-rule is itself reviewed before it changes future behavior).
 */
export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    pattern: text('pattern').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    isUserCustom: boolean('is_user_custom').notNull().default(true),
    confidenceLearned: numeric('confidence_learned', { precision: 4, scale: 3 }),
    timesMatched: integer('times_matched').notNull().default(0),
    status: categorizationRuleStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categorization_rules_tenant_idx').on(table.tenantId),
    index('categorization_rules_pattern_idx').on(table.pattern),
  ],
)

/**
 * review_queue — S1-4's confidence gate output for Tier 2 (Jev) matches that
 * did not clear the auto-apply checklist (confidence + vendor seen 3+
 * times + amount in the historical range for that vendor/category pair).
 * `postings.categoryId` is left NULL for these — the suggestion lives only
 * here until a human approves/rejects it (S1-5 UI). Approving writes
 * `postings.categoryId` through the normal update path; rejecting never
 * writes it at all. Every row is a record of a tier that almost applied
 * but didn't — same "never silently guess" principle as S0-4/S1-2/S1-3.
 */
export const reviewQueue = pgTable(
  'review_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postingId: uuid('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    suggestedCategoryId: uuid('suggested_category_id').references(() => categories.id, { onDelete: 'restrict' }),
    confidenceBand: jevConfidenceBand('confidence_band').notNull(),
    source: text('source').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    status: reviewQueueStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('review_queue_status_idx').on(table.status),
    index('review_queue_posting_idx').on(table.postingId),
  ],
)

/**
 * audit_log — one row per categorization decision, no exceptions (S1-6).
 * Every path that touches postings.categoryId writes here: Tier 1 rule
 * apply, gate auto-apply, gate reject-to-queue, a human's approve/reject
 * on a queued item, and a human's manual recategorize. This is a record of
 * decisions, not of end state — postings.categoryId alone cannot answer
 * "why was this categorized this way, by what, at what confidence."
 * `txId` is the writing DB transaction's id; migration 0004's deferred
 * trigger uses it to refuse any postings.category_id change that has no
 * matching audit row written in the same transaction. Append-only by
 * convention (no code path updates or deletes a row).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postingId: uuid('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    action: auditLogAction('action').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    source: text('source').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    reason: text('reason').notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    txId: bigint('tx_id', { mode: 'number' })
      .notNull()
      .default(sql`txid_current()`),
  },
  (table) => [
    index('audit_log_posting_idx').on(table.postingId),
    index('audit_log_created_idx').on(table.createdAt),
  ],
)

/** The gate's defaults when a tenant has never saved settings. The column
 * defaults below are derived from this, so there is one place to change. */
export const GATE_SETTINGS_DEFAULTS = {
  highConfidence: 0.75,
  lowConfidence: 0.5,
  minVendorOccurrences: 3,
  amountRangeTolerance: 0.5,
} as const

/**
 * gate_settings — the confidence gate's thresholds, one row per tenant
 * (PLAN.md §5.2: thresholds are visible and admin-configurable, not hidden
 * constants). No row = GATE_SETTINGS_DEFAULTS; the Settings screen upserts
 * it. CHECKs keep the bands coherent so a bad save can't e.g. put the
 * review band above the auto-apply band.
 */
export const gateSettings = pgTable(
  'gate_settings',
  {
    tenantId: uuid('tenant_id').primaryKey(),
    highConfidence: numeric('high_confidence', { precision: 4, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.highConfidence.toFixed(3)),
    lowConfidence: numeric('low_confidence', { precision: 4, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.lowConfidence.toFixed(3)),
    minVendorOccurrences: integer('min_vendor_occurrences')
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.minVendorOccurrences),
    amountRangeTolerance: numeric('amount_range_tolerance', { precision: 6, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.amountRangeTolerance.toFixed(3)),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('gate_settings_confidence_bands', sql`0 <= ${table.lowConfidence} AND ${table.lowConfidence} < ${table.highConfidence} AND ${table.highConfidence} <= 1`),
    check('gate_settings_min_vendor_occurrences', sql`${table.minVendorOccurrences} >= 1`),
    check('gate_settings_amount_range_tolerance', sql`${table.amountRangeTolerance} >= 0`),
  ],
)

/**
 * balance_assertions — reconciliation checkpoints against bank-reported
 * balances. This table does not correct `postings` — it flags when the
 * replayed balance and the bank's own number disagree, for a human or a
 * later reconciliation engine to resolve.
 */
export const balanceAssertions = pgTable(
  'balance_assertions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    assertedAmount: numeric('asserted_amount', { precision: 20, scale: 8 }).notNull(),
    source: balanceAssertionSource('source').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [index('balance_assertions_account_date_idx').on(table.accountId, table.date)],
)

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
