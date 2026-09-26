/* SOURCE OF TRUTH: connector -> ledger ingest; the only inserter of transactions and postings.
 * Invariant: each transaction is a balanced bank + equity (suspense or opening-balance) posting pair; re-ingest never duplicates. Enforced by: migration 0001 postings_must_balance, transactions_external_ref_unique_idx.
 * See: ADR 008 — provider-agnostic ingest and the externalRef format
 */
import { db, accounts, transactions, postings, balanceAssertions } from '@repo/ledger'
import type { Connector, NormalizedAccount, NormalizedBalance, NormalizedTransaction } from '@repo/connectors'
import { eq, and, sql } from 'drizzle-orm'

type Account = typeof accounts.$inferSelect

// Single self-hosted tenant for now — replaced once a real tenant/user table exists.
const LOCAL_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function upsertConnectorAccount(tenantId: string, provider: string, connectorId: string, acct: NormalizedAccount) {
  const type = acct.kind === 'credit' || acct.kind === 'loan' ? ('liability' as const) : ('asset' as const)
  const classification = {
    type,
    kind: acct.kind,
    connectorId,
    name: acct.name,
    officialName: acct.officialName ?? null,
    mask: acct.mask ?? null,
    providerType: acct.type,
    providerSubtype: acct.subtype ?? null,
    path: `${type === 'liability' ? 'liabilities' : 'assets'}:${acct.kind}:${provider}:${acct.providerAccountId}`,
  }

  const [account] = await db
    .insert(accounts)
    .values({ tenantId, currency: acct.currency, externalRef: acct.providerAccountId, ...classification })
    .onConflictDoUpdate({
      target: [accounts.tenantId, accounts.externalRef],
      targetWhere: sql`${accounts.externalRef} IS NOT NULL`,
      set: classification,
    })
    .returning()

  return account!
}

async function findOrCreateEquityAccount(tenantId: string, path: string, name: string, currency: string) {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.path, path)))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(accounts)
    .values({ tenantId, type: 'equity', name, path, currency })
    .returning()

  return created!
}

/** Anchors a cash/credit account's ledger to the bank's balance once, dated
 * before its earliest posting so the whole ingested history replays to it.
 * Later differences are real discrepancies and are never re-anchored. */
async function postOpeningBalance(tenantId: string, account: Account, current: NormalizedBalance) {
  const externalRef = `opening:${account.id}`
  const equity = await findOrCreateEquityAccount(
    tenantId,
    `equity:opening-balances:${account.currency.toLowerCase()}`,
    `Opening balances (${account.currency})`,
    account.currency,
  )

  await db.transaction(async (tx_db) => {
    const [existing] = await tx_db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.externalRef, externalRef))
      .limit(1)
    if (existing) return

    const [ledger] = await tx_db
      .select({
        difference: sql<string>`${current.amount.toFixed(8)}::numeric - coalesce(sum(${postings.amount}), 0)`,
        earliest: sql<string | null>`min(${transactions.date})`,
      })
      .from(postings)
      .innerJoin(transactions, eq(transactions.id, postings.transactionId))
      .where(eq(postings.accountId, account.id))

    const date = ledger?.earliest
      ? new Date(new Date(ledger.earliest).getTime() - 24 * 60 * 60 * 1000)
      : new Date(current.asOf ?? Date.now())
    const [row] = await tx_db
      .insert(transactions)
      .values({
        tenantId,
        date,
        description: `Opening balance: ${account.name}`,
        source: 'opening-balance',
        status: 'cleared',
        createdBy: 'connector',
        externalRef,
      })
      .returning()

    const difference = ledger?.difference ?? current.amount.toFixed(8)
    if (Number(difference) === 0) return
    await tx_db.insert(postings).values([
      { transactionId: row!.id, accountId: account.id, amount: difference, currency: account.currency },
      { transactionId: row!.id, accountId: equity.id, amount: sql`-(${difference}::numeric)`, currency: account.currency },
    ])
  })
}

export type BalanceFlag = {
  account: string
  issue: 'no_bank_balance' | 'fallback_type' | 'currency_mismatch' | 'history_pending'
  providerBalanceType?: string
}

export type IngestResult = {
  accountsSeen: number
  unclassifiedAccounts: string[]
  balanceFlags: BalanceFlag[]
  transactionsInserted: number
  transactionsSkipped: number
  nextCursor?: string
}

function postingTags(provider: string, tx: NormalizedTransaction) {
  const tags = [
    ...(tx.providerCategory ? [`${provider}:${tx.providerCategory}`] : []),
    ...(tx.syntheticId ? [`${provider}:synthetic-id`] : []),
  ]
  return tags.length > 0 ? tags : undefined
}

/** Ingest all new transactions for one connection. `credential` is the
 * provider's opaque token (Plaid access_token, Enable Banking session_id).
 * Safe to call repeatedly — see idempotency notes in the file header. */
export async function ingestConnection(
  connector: Connector,
  connectorId: string,
  credential: string,
  cursor?: string,
): Promise<IngestResult> {
  const providerAccounts = await connector.listAccounts(credential)
  const accountByProviderId = new Map<string, Account>()
  for (const acct of providerAccounts) {
    accountByProviderId.set(
      acct.providerAccountId,
      await upsertConnectorAccount(LOCAL_TENANT_ID, connector.provider, connectorId, acct),
    )
  }

  const { transactions: normalizedTxs, nextCursor, historyComplete } = await connector.getTransactions(credential, cursor)
  let inserted = 0
  let skipped = 0

  for (const tx of normalizedTxs) {
    const bankAccount = accountByProviderId.get(tx.accountId)
    if (!bankAccount) {
      skipped++ // account listAccounts didn't return — skip, don't guess
      continue
    }

    const suspenseAccount = await findOrCreateEquityAccount(
      LOCAL_TENANT_ID,
      `equity:uncategorized:${tx.currency.toLowerCase()}`,
      `Uncategorized (${tx.currency})`,
      tx.currency,
    )
    const externalRef = `${connector.provider}:${tx.providerTransactionId}`

    const inserted_ = await db.transaction(async (tx_db) => {
      const [existing] = await tx_db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.externalRef, externalRef))
        .limit(1)
      if (existing) return false

      const [txnRow] = await tx_db
        .insert(transactions)
        .values({
          tenantId: LOCAL_TENANT_ID,
          date: new Date(tx.date),
          description: tx.description,
          source: 'import',
          status: tx.pending ? 'pending' : 'cleared',
          createdBy: 'connector',
          externalRef,
        })
        .returning()

      // two balanced postings: bank account moves by tx.amount, suspense
      // account takes the exact offset
      await tx_db.insert(postings).values([
        {
          transactionId: txnRow!.id,
          accountId: bankAccount.id,
          amount: tx.amount.toFixed(8),
          currency: tx.currency,
          counterpartyRaw: tx.description,
          tags: postingTags(connector.provider, tx),
        },
        {
          transactionId: txnRow!.id,
          accountId: suspenseAccount.id,
          amount: (-tx.amount).toFixed(8),
          currency: tx.currency,
        },
      ])

      return true
    })

    if (inserted_) inserted++
    else skipped++
  }

  const balances = await connector.getBalances(credential)
  const fetchedAt = new Date()
  const assertionRows = balances.flatMap((b) => {
    const account = accountByProviderId.get(b.providerAccountId)
    if (!account) return []
    return [
      {
        accountId: account.id,
        balanceType: b.balanceType,
        date: b.asOf ? new Date(b.asOf) : fetchedAt,
        assertedAmount: b.amount.toFixed(8),
        currency: b.currency,
        source: 'bank-feed' as const,
        providerBalanceType: b.providerBalanceType,
        isFallback: b.isFallback,
      },
    ]
  })
  if (assertionRows.length > 0) await db.insert(balanceAssertions).values(assertionRows)

  const balanceFlags: BalanceFlag[] = []
  for (const [providerAccountId, account] of accountByProviderId) {
    const current = balances.find((b) => b.providerAccountId === providerAccountId && b.balanceType === 'current')
    if (!current) {
      balanceFlags.push({ account: account.name, issue: 'no_bank_balance' })
      continue
    }
    if (current.isFallback) {
      balanceFlags.push({ account: account.name, issue: 'fallback_type', providerBalanceType: current.providerBalanceType })
    }
    if (account.kind !== 'cash' && account.kind !== 'credit') continue
    if (current.currency !== account.currency) {
      balanceFlags.push({ account: account.name, issue: 'currency_mismatch', providerBalanceType: current.providerBalanceType })
      continue
    }
    if (!historyComplete) {
      balanceFlags.push({ account: account.name, issue: 'history_pending' })
      continue
    }
    await postOpeningBalance(LOCAL_TENANT_ID, account, current)
  }

  return {
    accountsSeen: providerAccounts.length,
    unclassifiedAccounts: providerAccounts.filter((acct) => acct.kind === 'other').map((acct) => acct.name),
    balanceFlags,
    transactionsInserted: inserted,
    transactionsSkipped: skipped,
    nextCursor,
  }
}

export { LOCAL_TENANT_ID }
