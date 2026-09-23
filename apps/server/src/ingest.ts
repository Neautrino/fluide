/** SOURCE OF TRUTH: the connector-to-ledger ingest job.
 * WHAT: pulls transactions from a Connector (currently only plaidConnector),
 * finds-or-creates the corresponding ledger `accounts` row, and inserts each
 * transaction as a BALANCED double-entry pair of postings.
 * WHY: a bank feed only tells you one side of the story. Until categorization
 * exists (later slice), the offsetting leg goes to a per-tenant "uncategorized"
 * suspense account — a standard accounting pattern, not a hack. Idempotency
 * is double-enforced: the persisted cursor (plaid-store.ts) limits what Plaid
 * resends, and transactions.external_ref has a partial UNIQUE index so
 * Postgres itself rejects a duplicate insert either way.
 * WHERE: this file owns connector->ledger translation only. Connector calls
 * live in packages/connectors; guardrail enforcement lives in packages/ledger's
 * migrations — never write to postings without a balanced insert here.
 */
import { db, accounts, transactions, postings } from '@repo/ledger'
import { plaidConnector, type NormalizedAccount } from '@repo/connectors'
import { eq, and } from 'drizzle-orm'

// Single self-hosted tenant for now — replaced once a real tenant/user table exists.
const LOCAL_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function findOrCreateAccount(tenantId: string, acct: NormalizedAccount) {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.externalRef, acct.providerAccountId)))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(accounts)
    .values({
      tenantId,
      type: 'asset', // Plaid depository/credit simplified to 'asset' for Slice 0
      name: acct.name,
      path: `assets:bank:plaid:${acct.providerAccountId}`,
      currency: acct.currency,
      externalRef: acct.providerAccountId,
    })
    .returning()

  return created!
}

async function findOrCreateSuspenseAccount(tenantId: string, currency: string) {
  const path = `equity:uncategorized:${currency.toLowerCase()}`
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.path, path)))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(accounts)
    .values({
      tenantId,
      type: 'equity',
      name: `Uncategorized (${currency})`,
      path,
      currency,
    })
    .returning()

  return created!
}

export type IngestResult = {
  accountsSeen: number
  transactionsInserted: number
  transactionsSkipped: number
  nextCursor?: string
}

/** Ingest all new transactions for one connected Plaid item. Safe to call
 * repeatedly — see idempotency notes in the file header. */
export async function ingestPlaidItem(accessToken: string, cursor?: string): Promise<IngestResult> {
  const plaidAccounts = await plaidConnector.listAccounts(accessToken)
  const accountByProviderId = new Map<string, Awaited<ReturnType<typeof findOrCreateAccount>>>()
  for (const acct of plaidAccounts) {
    accountByProviderId.set(acct.providerAccountId, await findOrCreateAccount(LOCAL_TENANT_ID, acct))
  }

  const { transactions: normalizedTxs, nextCursor } = await plaidConnector.getTransactions(
    accessToken,
    cursor,
  )

  let inserted = 0
  let skipped = 0

  for (const tx of normalizedTxs) {
    const bankAccount = accountByProviderId.get(tx.accountId)
    if (!bankAccount) {
      skipped++ // account listAccounts didn't return — skip, don't guess
      continue
    }

    const suspenseAccount = await findOrCreateSuspenseAccount(LOCAL_TENANT_ID, tx.currency)
    const externalRef = `plaid:${tx.providerTransactionId}`

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
          tags: tx.providerCategory ? [`plaid:${tx.providerCategory}`] : undefined,
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

  return {
    accountsSeen: plaidAccounts.length,
    transactionsInserted: inserted,
    transactionsSkipped: skipped,
    nextCursor,
  }
}

export { LOCAL_TENANT_ID }
