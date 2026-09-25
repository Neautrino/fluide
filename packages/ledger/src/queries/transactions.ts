import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, transactions, postings, categories } from '../schema/index.js'
import { bankPostingsFilter, type Period } from './period.js'

export type TransactionRow = {
  date: string
  description: string
  merchant: string
  amount: number
  category: string
}

/** Raw, filterable transaction listing -- the one gap found comparing our
 * tool surface against BankMCP's get_transactions / Ghostfolio's
 * get_orders: those return a raw list for the calling model to reason
 * over; our other tools are all pre-aggregated. Same join as
 * listTransactionsWithPostings, narrowed to one account-type filter and an
 * optional merchant/period filter, capped at 50 rows so a broad match
 * doesn't dump the whole ledger into context. */
export async function listRecentTransactions(
  tenantId: string,
  period: Period,
  merchantQuery?: string,
  limit = 20,
): Promise<TransactionRow[]> {
  const conditions = [bankPostingsFilter(tenantId, period)]
  if (merchantQuery) {
    conditions.push(sql`${postings.counterpartyRaw} ILIKE '%' || ${merchantQuery} || '%'`)
  }

  const rows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      merchant: sql<string>`coalesce(${postings.counterpartyRaw}, 'Unknown')`,
      amount: postings.amount,
      category: sql<string>`coalesce(${categories.label}, 'Uncategorized')`,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .where(and(...conditions))
    .orderBy(sql`${transactions.date} desc`)
    .limit(Math.min(limit, 50))

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    description: r.description,
    merchant: r.merchant,
    amount: Number(r.amount),
    category: r.category,
  }))
}

/** One row per posting (both legs of every transaction), newest first --
 * the web transaction table's shape. `account.type` lets the UI hide the
 * equity suspense leg; `posting.id` is what recategorize targets. */
export async function listTransactionsWithPostings(tenantId: string, limit = 100) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      status: transactions.status,
      posting: {
        id: postings.id,
        accountId: postings.accountId,
        amount: postings.amount,
        currency: postings.currency,
        categoryId: postings.categoryId,
        counterpartyRaw: postings.counterpartyRaw,
      },
      account: {
        name: accounts.name,
        type: accounts.type,
      },
      category: {
        label: categories.label,
        detailed: categories.detailed,
      },
    })
    .from(transactions)
    .innerJoin(postings, eq(postings.transactionId, transactions.id))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .where(eq(transactions.tenantId, tenantId))
    .orderBy(desc(transactions.date))
    .limit(limit)
}
