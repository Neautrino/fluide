/* SOURCE OF TRUTH: the double-entry core: accounts, transactions, postings, balance_assertions.
 * Invariant: balances are derived from postings, never stored; posting money columns are immutable and sum to zero. Enforced by: migration 0001 triggers.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { categories } from './categories.js'

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
