import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, postings } from '../schema/index.js'

export type AccountBalance = { name: string; currency: string; balance: number }

export async function listAccountBalances(tenantId: string): Promise<AccountBalance[]> {
  const rows = await db
    .select({
      name: accounts.name,
      currency: accounts.currency,
      balance: sql<string>`coalesce(sum(${postings.amount}), 0)`,
    })
    .from(accounts)
    .leftJoin(postings, eq(postings.accountId, accounts.id))
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.type, ['asset', 'liability'])))
    .groupBy(accounts.id, accounts.name, accounts.currency)

  return rows.map((r) => ({ name: r.name, currency: r.currency, balance: Number(r.balance) }))
}

export async function listAccounts(tenantId: string) {
  return db.select().from(accounts).where(eq(accounts.tenantId, tenantId))
}
