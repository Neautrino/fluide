/* SOURCE OF TRUTH: the double-entry core: accounts, transactions, postings, balance_assertions.
 * Invariant: balances are derived from postings, never stored; posting money columns are immutable and sum to zero. Enforced by: migration 0001 triggers.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { categories } from './categories.js'
import { connectors } from './credentials.js'

export const accountType = pgEnum('account_type', [
  'asset',
  'liability',
  'income',
  'expense',
  'equity',
])

export const accountKind = pgEnum('account_kind', [
  'cash',
  'investment',
  'property',
  'vehicle',
  'crypto',
  'credit',
  'loan',
  'other',
])

export type AccountKind = (typeof accountKind.enumValues)[number]

export const transactionVoidReason = pgEnum('transaction_void_reason', [
  'pending_posted',
  'provider_modified',
  'provider_removed',
  'duplicate',
])

export const balanceType = pgEnum('balance_type', ['current', 'available', 'limit'])

export const transactionStatus = pgEnum('transaction_status', [
  'pending',
  'cleared',
  'reconciled',
])

export const transactionSource = pgEnum('transaction_source', [
  'manual',
  'import',
  'receipt-match',
  'opening-balance',
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
 * colon-hierarchical convention, e.g. "assets:cash:plaid:<account_id>".
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    type: accountType('type').notNull(),
    kind: accountKind('kind'),
    connectorId: uuid('connector_id').references(() => connectors.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    officialName: text('official_name'),
    mask: text('mask'),
    providerType: text('provider_type'),
    providerSubtype: text('provider_subtype'),
    path: text('path').notNull(),
    currency: text('currency').notNull(), // ISO 4217, e.g. "USD"
    externalRef: text('external_ref'), // connector account uid (e.g. Plaid account_id)
    excludeFromNetWorth: boolean('exclude_from_net_worth').notNull().default(false),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('accounts_tenant_idx').on(table.tenantId),
    index('accounts_path_idx').on(table.path),
    index('accounts_connector_idx').on(table.connectorId),
    uniqueIndex('accounts_tenant_external_ref_unique_idx')
      .on(table.tenantId, table.externalRef)
      .where(sql`${table.externalRef} IS NOT NULL`),
    check(
      'accounts_kind_matches_type',
      sql`${table.kind} IS NULL
        OR (${table.kind} IN ('cash', 'investment', 'property', 'vehicle', 'crypto') AND ${table.type} = 'asset')
        OR (${table.kind} IN ('credit', 'loan') AND ${table.type} = 'liability')
        OR (${table.kind} = 'other' AND ${table.type} IN ('asset', 'liability'))`,
    ),
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
    reversesTransactionId: uuid('reverses_transaction_id').references((): AnyPgColumn => transactions.id, {
      onDelete: 'restrict',
    }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: transactionVoidReason('void_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_tenant_date_idx').on(table.tenantId, table.date),
    uniqueIndex('transactions_external_ref_unique_idx')
      .on(table.externalRef)
      .where(sql`${table.externalRef} IS NOT NULL AND ${table.voidedAt} IS NULL`),
    uniqueIndex('transactions_reverses_unique_idx')
      .on(table.reversesTransactionId)
      .where(sql`${table.reversesTransactionId} IS NOT NULL`),
    check('transactions_void_reason_iff_voided', sql`(${table.voidedAt} IS NULL) = (${table.voidReason} IS NULL)`),
    check('transactions_not_self_reversing', sql`${table.reversesTransactionId} <> ${table.id}`),
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
 * balance_assertions — reconciliation checkpoints against bank-reported
 * balances. This table does not correct `postings` — it flags when the
 * replayed balance and the bank's own number disagree, for a human or a
 * later reconciliation engine to resolve. `assertedAmount` is ledger-signed
 * (money owed is negative); `limit` rows are non-negative.
 */
export const balanceAssertions = pgTable(
  'balance_assertions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    balanceType: balanceType('balance_type').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    assertedAmount: numeric('asserted_amount', { precision: 20, scale: 8 }).notNull(),
    currency: text('currency').notNull(),
    source: balanceAssertionSource('source').notNull(),
    providerBalanceType: text('provider_balance_type'),
    isFallback: boolean('is_fallback').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    index('balance_assertions_account_type_date_idx').on(table.accountId, table.balanceType, table.date),
    check('balance_assertions_limit_non_negative', sql`${table.balanceType} <> 'limit' OR ${table.assertedAmount} >= 0`),
  ],
)
