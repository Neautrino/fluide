import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, balanceAssertions, postings, transactions, type AccountKind } from '../schema/index.js'
import { liveTransaction, settledTransaction } from './live.js'

export type AccountBalance = {
  name: string
  currency: string
  kind: AccountKind | null
  balance: number | null
  bankBalance: number | null
  bankBalanceAt: string | null
  bankBalanceIsFallback: boolean
  ledgerBalance: number
  pendingBalance: number
  bankCountsPending: boolean | null
  mismatch: boolean
}

/** `balance` is the bank's latest current balance, else the ledger sum of an
 * anchored account, else null (unknown). `ledgerBalance` counts the opening
 * balance plus settled postings in the account's currency dated on or before
 * that bank balance; `pendingBalance` counts live pending postings the same way.
 * Banks differ on whether `current` includes pending, so an anchored cash/credit
 * account mismatches only when the bank equals neither total; `bankCountsPending`
 * records which one matched (null when there is no pending amount to tell).
 * Investments and loans change without transactions, so they are not reconciled. */
export async function listAccountBalances(tenantId: string): Promise<AccountBalance[]> {
  const bankDate = sql`(
    select ${balanceAssertions.date} from ${balanceAssertions}
    where ${balanceAssertions.accountId} = ${accounts.id}
      and ${balanceAssertions.balanceType} = 'current'
      and ${balanceAssertions.currency} = ${accounts.currency}
    order by ${balanceAssertions.date} desc limit 1
  )`
  const ledgerRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      currency: accounts.currency,
      kind: accounts.kind,
      ledgerBalance: sql<string>`coalesce(sum(${postings.amount}) filter (where ${and(
        settledTransaction,
        eq(postings.currency, accounts.currency),
      )} and (${transactions.source} = 'opening-balance' or ${transactions.date} <= coalesce(${bankDate}, 'infinity'))), 0)`,
      pendingBalance: sql<string>`coalesce(sum(${postings.amount}) filter (where ${and(
        liveTransaction,
        eq(transactions.status, 'pending'),
        eq(postings.currency, accounts.currency),
      )} and ${transactions.date} <= coalesce(${bankDate}, 'infinity')), 0)`,
    })
    .from(accounts)
    .leftJoin(postings, eq(postings.accountId, accounts.id))
    .leftJoin(transactions, eq(transactions.id, postings.transactionId))
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.type, ['asset', 'liability'])))
    .groupBy(accounts.id, accounts.name, accounts.currency, accounts.kind)

  const ids = ledgerRows.map((r) => r.id)
  const bankRows = ids.length
    ? await db
        .selectDistinctOn([balanceAssertions.accountId], {
          accountId: balanceAssertions.accountId,
          amount: balanceAssertions.assertedAmount,
          date: balanceAssertions.date,
          isFallback: balanceAssertions.isFallback,
        })
        .from(balanceAssertions)
        .innerJoin(accounts, eq(accounts.id, balanceAssertions.accountId))
        .where(
          and(
            inArray(balanceAssertions.accountId, ids),
            eq(balanceAssertions.balanceType, 'current'),
            eq(balanceAssertions.currency, accounts.currency),
          ),
        )
        .orderBy(balanceAssertions.accountId, desc(balanceAssertions.date))
    : []
  const anchoredRefs = ids.length
    ? await db
        .select({ externalRef: transactions.externalRef })
        .from(transactions)
        .where(inArray(transactions.externalRef, ids.map((id) => `opening:${id}`)))
    : []
  const anchored = new Set(anchoredRefs.map((r) => r.externalRef))

  return ledgerRows.map((r) => {
    const bank = bankRows.find((b) => b.accountId === r.id)
    const isAnchored = anchored.has(`opening:${r.id}`)
    const ledgerBalance = Number(r.ledgerBalance)
    const pendingBalance = Number(r.pendingBalance)
    const bankBalance = bank ? Number(bank.amount) : null
    const reconciled = isAnchored && bankBalance !== null && (r.kind === 'cash' || r.kind === 'credit')
    const matchesSettled = bankBalance !== null && Math.abs(bankBalance - ledgerBalance) < 0.005
    const matchesWithPending =
      bankBalance !== null && Math.abs(pendingBalance) >= 0.005 && Math.abs(bankBalance - ledgerBalance - pendingBalance) < 0.005
    return {
      name: r.name,
      currency: r.currency,
      kind: r.kind,
      balance: bankBalance ?? (isAnchored ? ledgerBalance : null),
      bankBalance,
      bankBalanceAt: bank ? bank.date.toISOString() : null,
      bankBalanceIsFallback: bank?.isFallback ?? false,
      ledgerBalance,
      pendingBalance,
      bankCountsPending: reconciled && Math.abs(pendingBalance) >= 0.005 ? (matchesWithPending ? true : matchesSettled ? false : null) : null,
      mismatch: reconciled && !matchesSettled && !matchesWithPending,
    }
  })
}

export async function listAccounts(tenantId: string) {
  return db.select().from(accounts).where(eq(accounts.tenantId, tenantId))
}
