import { and, isNull } from 'drizzle-orm'
import { transactions } from '../schema/index.js'

export const liveTransaction = and(isNull(transactions.voidedAt), isNull(transactions.reversesTransactionId))
