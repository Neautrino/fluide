import { pgTable, uuid, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { transactions } from './ledger.js'

/** 'not_transfer' is only ever a user decision: "this is a payment, count it". */
export const transferKind = pgEnum('transfer_kind', ['transfer', 'card_payment', 'loan_payment', 'investment', 'not_transfer'])

export type TransferKind = (typeof transferKind.enumValues)[number]

export const transferMarkMethod = pgEnum('transfer_mark_method', ['pair_match', 'provider_tag', 'user'])

export type TransferMarkMethod = (typeof transferMarkMethod.enumValues)[number]

/**
 * transfer_marks — a bank transaction that may move money between the
 * user's own accounts (or pays a card/loan) rather than earning or spending
 * it. Derived rows ('pair_match', 'provider_tag') are rewritten by
 * detectTransferMarks (queries/transfers.ts); 'user' rows are decisions it
 * never touches. `pairTransactionId` is the matched opposite leg when
 * `method` is 'pair_match', else null.
 */
export const transferMarks = pgTable(
  'transfer_marks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    transactionId: uuid('transaction_id')
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    pairTransactionId: uuid('pair_transaction_id').references(() => transactions.id, { onDelete: 'restrict' }),
    kind: transferKind('kind').notNull(),
    method: transferMarkMethod('method').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('transfer_marks_tenant_idx').on(table.tenantId)],
)
