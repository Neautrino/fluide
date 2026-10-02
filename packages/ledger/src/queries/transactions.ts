import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, transactions, postings, categories } from '../schema/index.js'
import { bankPostingsFilter, countedHistory } from './period.js'
import type { ScopeWindow } from './cashflow.js'
import { liveTransaction } from './live.js'

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
 * optional merchant/window filter, capped at 50 rows so a broad match
 * doesn't dump the whole ledger into context. */
export async function listRecentTransactions(
  tenantId: string,
  window: ScopeWindow,
  merchantQuery?: string,
  limit = 20,
): Promise<TransactionRow[]> {
  const conditions = [bankPostingsFilter(tenantId, window), countedHistory]
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

/** Every live bank posting (asset/liability leg), newest first -- the web
 * transaction table's shape. `posting.id` is what recategorize targets.
 * `accountId` narrows it to postings on that one account. A row a replaced
 * login's successor also carries is still listed, with countsTowardTotals
 * false: it is out of every total but never simply missing. */
export async function listTransactionsWithPostings(tenantId: string, accountId?: string) {
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
      countsTowardTotals: sql<boolean>`${countedHistory}`,
    })
    .from(transactions)
    .innerJoin(postings, eq(postings.transactionId, transactions.id))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .leftJoin(categories, eq(categories.id, postings.categoryId))
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        liveTransaction,
        ne(transactions.source, 'opening-balance'),
        inArray(accounts.type, ['asset', 'liability']),
        accountId ? eq(postings.accountId, accountId) : undefined,
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.id))
}
