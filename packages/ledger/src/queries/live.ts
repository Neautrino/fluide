import { and, isNull, ne } from 'drizzle-orm'
import { transactions } from '../schema/index.js'

export const liveTransaction = and(isNull(transactions.voidedAt), isNull(transactions.reversesTransactionId))

/** What a bank's current balance counts: live and no longer pending. */
export const settledTransaction = and(liveTransaction, ne(transactions.status, 'pending'))
