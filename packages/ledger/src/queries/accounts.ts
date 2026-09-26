import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, balanceAssertions, postings, type AccountKind } from '../schema/index.js'

export type AccountBalance = {
  name: string
  currency: string
  kind: AccountKind | null
  balance: number
  bankBalance: number | null
  bankBalanceAt: string | null
  bankBalanceIsFallback: boolean
  ledgerBalance: number
  mismatch: boolean
}

/** `balance` is the bank's latest current balance when there is one. Only
 * cash/credit accounts are reconciled; investments and loans change without
 * transactions, so their ledger sum is not expected to match. */
export async function listAccountBalances(tenantId: string): Promise<AccountBalance[]> {
  const ledgerRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      currency: accounts.currency,
      kind: accounts.kind,
      ledgerBalance: sql<string>`coalesce(sum(${postings.amount}), 0)`,
    })
    .from(accounts)
    .leftJoin(postings, eq(postings.accountId, accounts.id))
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.type, ['asset', 'liability'])))
    .groupBy(accounts.id, accounts.name, accounts.currency, accounts.kind)

  const bankRows = ledgerRows.length
    ? await db
        .selectDistinctOn([balanceAssertions.accountId], {
          accountId: balanceAssertions.accountId,
          amount: balanceAssertions.assertedAmount,
          date: balanceAssertions.date,
          isFallback: balanceAssertions.isFallback,
        })
        .from(balanceAssertions)
        .where(
          and(
            inArray(balanceAssertions.accountId, ledgerRows.map((r) => r.id)),
            eq(balanceAssertions.balanceType, 'current'),
          ),
        )
        .orderBy(balanceAssertions.accountId, desc(balanceAssertions.date))
    : []

  return ledgerRows.map((r) => {
    const bank = bankRows.find((b) => b.accountId === r.id)
    const ledgerBalance = Number(r.ledgerBalance)
    const bankBalance = bank ? Number(bank.amount) : null
    return {
      name: r.name,
      currency: r.currency,
      kind: r.kind,
      balance: bankBalance ?? ledgerBalance,
      bankBalance,
      bankBalanceAt: bank ? bank.date.toISOString() : null,
      bankBalanceIsFallback: bank?.isFallback ?? false,
      ledgerBalance,
      mismatch:
        bankBalance !== null && (r.kind === 'cash' || r.kind === 'credit') && Math.abs(bankBalance - ledgerBalance) >= 0.005,
    }
  })
}

export async function listAccounts(tenantId: string) {
  return db.select().from(accounts).where(eq(accounts.tenantId, tenantId))
}
