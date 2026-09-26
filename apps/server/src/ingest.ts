/* SOURCE OF TRUTH: connector -> ledger ingest; the only inserter of transactions and postings.
 * Invariant: each transaction is a balanced bank + suspense posting pair; re-ingest never duplicates. Enforced by: migration 0001 postings_must_balance, transactions_external_ref_unique_idx.
 * See: ADR 008 — provider-agnostic ingest and the externalRef format
 */
import { db, accounts, transactions, postings } from '@repo/ledger'
import type { Connector, NormalizedAccount, NormalizedTransaction } from '@repo/connectors'
import { eq, and, sql } from 'drizzle-orm'

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
  unclassifiedAccounts: string[]
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
  const accountByProviderId = new Map<string, typeof accounts.$inferSelect>()
  for (const acct of providerAccounts) {
    accountByProviderId.set(
      acct.providerAccountId,
      await upsertConnectorAccount(LOCAL_TENANT_ID, connector.provider, connectorId, acct),
    )
  }

  const { transactions: normalizedTxs, nextCursor } = await connector.getTransactions(credential, cursor)
  let inserted = 0
  let skipped = 0

  for (const tx of normalizedTxs) {
    const bankAccount = accountByProviderId.get(tx.accountId)
    if (!bankAccount) {
      skipped++ // account listAccounts didn't return — skip, don't guess
      continue
    }

    const suspenseAccount = await findOrCreateSuspenseAccount(LOCAL_TENANT_ID, tx.currency)
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

  return {
    accountsSeen: providerAccounts.length,
    unclassifiedAccounts: providerAccounts.filter((acct) => acct.kind === 'other').map((acct) => acct.name),
    transactionsInserted: inserted,
    transactionsSkipped: skipped,
    nextCursor,
  }
}

export { LOCAL_TENANT_ID }
