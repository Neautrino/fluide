import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, balanceAssertions, connectors, postings, transactions, type AccountKind, type ConnectorStatus } from '../schema/index.js'
import { liveTransaction, settledTransaction } from './live.js'

export type AccountBalance = {
  id: string
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
  mask: string | null
  subtype: string | null
  officialName: string | null
  excludeFromNetWorth: boolean
  institutionName: string | null
  connectionStatus: ConnectorStatus | null
  lastSyncedAt: string | null
  availableBalance: number | null
  creditLimit: number | null
  countsTowardTotals: boolean
  replacedByConnectorId: string | null
  countedUntil: string | null
}

/** A balance counts toward net worth only while its login still reports it: a
 * disconnected login's last balance is stale for ever, and the user can leave
 * an account out by hand. */
export function countsTowardTotals(account: { connectionStatus: ConnectorStatus | null; excludeFromNetWorth: boolean }): boolean {
  return account.connectionStatus !== 'disconnected' && !account.excludeFromNetWorth
}

/** `balance` is the bank's latest current balance, else the ledger sum of an
 * anchored account, else null (unknown). `ledgerBalance` counts the opening
 * balance plus settled postings in the account's currency dated on or before
 * that bank balance; `pendingBalance` counts live pending postings the same way.
 * Banks differ on whether `current` includes pending, so an anchored cash/credit
 * account mismatches only when the bank equals neither total; `bankCountsPending`
 * records which one matched (null when there is no pending amount to tell).
 * Investments and loans change without transactions, so they are not reconciled.
 * Connection fields come from the account's connector (null for manual accounts);
 * `availableBalance`/`creditLimit` are the latest same-currency assertions of that type. */
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
      mask: accounts.mask,
      subtype: accounts.providerSubtype,
      officialName: accounts.officialName,
      excludeFromNetWorth: accounts.excludeFromNetWorth,
      institutionName: connectors.institutionName,
      connectionStatus: connectors.status,
      lastSyncedAt: connectors.lastSyncedAt,
      replacedByConnectorId: connectors.replacedByConnectorId,
      countedUntil: connectors.countedUntil,
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
    .leftJoin(connectors, eq(connectors.id, accounts.connectorId))
    .where(and(eq(accounts.tenantId, tenantId), inArray(accounts.type, ['asset', 'liability'])))
    .groupBy(accounts.id, accounts.name, accounts.currency, accounts.kind, connectors.id)
    .orderBy(accounts.type, accounts.kind, accounts.name, accounts.id)

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
  const otherRows = ids.length
    ? await db
        .selectDistinctOn([balanceAssertions.accountId, balanceAssertions.balanceType], {
          accountId: balanceAssertions.accountId,
          balanceType: balanceAssertions.balanceType,
          amount: balanceAssertions.assertedAmount,
        })
        .from(balanceAssertions)
        .innerJoin(accounts, eq(accounts.id, balanceAssertions.accountId))
        .where(
          and(
            inArray(balanceAssertions.accountId, ids),
            inArray(balanceAssertions.balanceType, ['available', 'limit']),
            eq(balanceAssertions.currency, accounts.currency),
          ),
        )
        .orderBy(balanceAssertions.accountId, balanceAssertions.balanceType, desc(balanceAssertions.date))
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
    const available = otherRows.find((b) => b.accountId === r.id && b.balanceType === 'available')
    const limit = otherRows.find((b) => b.accountId === r.id && b.balanceType === 'limit')
    const isAnchored = anchored.has(`opening:${r.id}`)
    const ledgerBalance = Number(r.ledgerBalance)
    const pendingBalance = Number(r.pendingBalance)
    const bankBalance = bank ? Number(bank.amount) : null
    const reconciled = isAnchored && bankBalance !== null && (r.kind === 'cash' || r.kind === 'credit')
    const matchesSettled = bankBalance !== null && Math.abs(bankBalance - ledgerBalance) < 0.005
    const matchesWithPending =
      bankBalance !== null && Math.abs(pendingBalance) >= 0.005 && Math.abs(bankBalance - ledgerBalance - pendingBalance) < 0.005
    return {
      id: r.id,
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
      mask: r.mask,
      subtype: r.subtype,
      officialName: r.officialName,
      excludeFromNetWorth: r.excludeFromNetWorth,
      institutionName: r.institutionName,
      connectionStatus: r.connectionStatus,
      lastSyncedAt: r.lastSyncedAt ? r.lastSyncedAt.toISOString() : null,
      availableBalance: available ? Number(available.amount) : null,
      creditLimit: limit ? Number(limit.amount) : null,
      countsTowardTotals: countsTowardTotals(r),
      replacedByConnectorId: r.replacedByConnectorId,
      countedUntil: r.countedUntil ? r.countedUntil.toISOString() : null,
    }
  })
}

export async function listAccounts(tenantId: string) {
  return db.select().from(accounts).where(eq(accounts.tenantId, tenantId))
}
