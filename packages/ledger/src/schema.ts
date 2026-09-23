/** SOURCE OF TRUTH: the double-entry ledger's schema — accounts, transactions,
 * postings, balance_assertions.
 * WHAT: Drizzle table definitions for Slice 0's ledger core (PLAN.md §2).
 * Later-slice tables (documents/matches/categorization_rules/review_queue/
 * audit_log/connectors/watches) are deliberately not modeled yet.
 * WHY: `postings` is the only writable source of truth for money movement.
 * Balances are NEVER stored as ground truth — always derived by replaying
 * postings, reconciled against the bank via balance_assertions.
 * WHERE: this file owns table SHAPE only. The sum-to-zero CHECK and the
 * immutability REVOKE are hand-written SQL in migrations/ — Drizzle's schema
 * DSL can't express them, and schema alone does not stop bad writes.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  vector,
  pgEnum,
  index,
  uniqueIndex,
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
 * postings sharing a transaction_id + currency must sum to zero. This table
 * is append-only: migrations/0000_ledger_guardrails.sql revokes UPDATE and
 * DELETE on it entirely. To correct a mistake, post a reversing entry —
 * never edit or remove a row.
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
    descriptionEmbedding: vector('description_embedding', { dimensions: 384 }),
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
 * rules always win over system-seeded ones on the same posting.
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categorization_rules_tenant_idx').on(table.tenantId),
    index('categorization_rules_pattern_idx').on(table.pattern),
  ],
)

/**
 * category_anchors — embedded example phrases per category (S1-3 Tier 2
 * cold start). A brand-new tenant has no categorized history to embed
 * against yet, so anchors give Tier 2 something to match against from day
 * one. `embedding` uses the same all-MiniLM-L6-v2 model/dimensions as
 * postings.descriptionEmbedding so cosine distance is comparable across
 * both sources.
 */
export const categoryAnchors = pgTable(
  'category_anchors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    anchorText: text('anchor_text').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('category_anchors_category_idx').on(table.categoryId)],
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
