/* SOURCE OF TRUTH: connector -> ledger ingest; the only inserter of transactions and postings.
 * Invariant: each transaction is a balanced bank + equity (suspense or opening-balance) posting pair; re-ingest never duplicates. Enforced by: migration 0001 postings_must_balance, transactions_external_ref_unique_idx.
 * See: ADR 008 — provider-agnostic ingest and the externalRef format
 */
import { db, accounts, transactions, postings, balanceAssertions, reviewQueue, settledTransaction, liveTransaction, type DbExecutor } from '@repo/ledger'
import type { Connector, NormalizedAccount, NormalizedBalance, NormalizedTransaction } from '@repo/connectors'
import { eq, and, sql, inArray, isNull, desc, lte } from 'drizzle-orm'
import { writeAuditLog } from './audit.js'
import { updateConnectionCursor } from './connection-store.js'

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
 * Later differences are real discrepancies and are never re-anchored.
 * The bank balance is compared with settled, same-currency postings dated on or before its asOf. */
async function postOpeningBalance(tenantId: string, account: Account, current: NormalizedBalance): Promise<'anchored' | 'no_transactions'> {
  const externalRef = `opening:${account.id}`
  return db.transaction(async (tx_db) => {
    const [existing] = await tx_db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.externalRef, externalRef))
      .limit(1)
    if (existing) return 'anchored'

    const [ledger] = await tx_db
      .select({
        liveCount: sql<number>`count(*) filter (where ${liveTransaction})::int`,
        difference: sql<string>`${current.amount.toFixed(8)}::numeric - coalesce(sum(${postings.amount}) filter (where ${and(
          settledTransaction,
          eq(postings.currency, account.currency),
          current.asOf ? lte(transactions.date, new Date(current.asOf)) : undefined,
        )}), 0)`,
        earliest: sql<string | null>`min(${transactions.date})`,
      })
      .from(postings)
      .innerJoin(transactions, eq(transactions.id, postings.transactionId))
      .where(eq(postings.accountId, account.id))
    if (!ledger || ledger.liveCount === 0 || !ledger.earliest) return 'no_transactions'

    const [row] = await tx_db
      .insert(transactions)
      .values({
        tenantId,
        date: new Date(new Date(ledger.earliest).getTime() - 24 * 60 * 60 * 1000),
        description: `Opening balance: ${account.name}`,
        source: 'opening-balance',
        status: 'cleared',
        createdBy: 'connector',
        externalRef,
      })
      .returning()

    const difference = ledger.difference
    if (Number(difference) === 0) return 'anchored'
    const equity = await findOrCreateEquityAccount(
      tenantId,
      `equity:opening-balances:${account.currency.toLowerCase()}`,
      `Opening balances (${account.currency})`,
      account.currency,
    )
    await tx_db.insert(postings).values([
      { transactionId: row!.id, accountId: account.id, amount: difference, currency: account.currency },
      { transactionId: row!.id, accountId: equity.id, amount: sql`-(${difference}::numeric)`, currency: account.currency },
    ])
    return 'anchored'
  })
}

export type BalanceFlag = {
  account: string
  issue: 'no_bank_balance' | 'fallback_type' | 'currency_mismatch' | 'history_pending' | 'no_transactions'
  providerBalanceType?: string
}

export type IngestResult = {
  accountsSeen: number
  unclassifiedAccounts: string[]
  balanceFlags: BalanceFlag[]
  transactionsInserted: number
  transactionsSkipped: number
  transactionsVoided: number
  transactionsUpdated: number
  transactionsUnknownAccount: number
}

function postingTags(provider: string, tx: NormalizedTransaction) {
  const tags = [
    ...(tx.providerCategory ? [`${provider}:${tx.providerCategory}`] : []),
    ...(tx.syntheticId ? [`${provider}:synthetic-id`] : []),
  ]
  return tags.length > 0 ? tags : undefined
}

type VoidReason = NonNullable<(typeof transactions.$inferSelect)['voidReason']>
type Carried = { source: string; reason: string } & (
  | { categoryId: string }
  | { rejection: typeof reviewQueue.$inferSelect }
)

/** With liveOnly false, returns the newest version of the external ref. */
async function findBankPosting(executor: DbExecutor, externalRef: string, liveOnly: boolean) {
  const [row] = await executor
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      description: transactions.description,
      status: transactions.status,
      voidedAt: transactions.voidedAt,
      postingId: postings.id,
      accountId: postings.accountId,
      amount: postings.amount,
      categoryId: postings.categoryId,
    })
    .from(transactions)
    .innerJoin(postings, eq(postings.transactionId, transactions.id))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(
      and(
        eq(transactions.externalRef, externalRef),
        inArray(accounts.type, ['asset', 'liability']),
        liveOnly ? isNull(transactions.voidedAt) : undefined,
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1)
  return row
}

async function decisionToCarry(
  executor: DbExecutor,
  previous: { postingId: string; categoryId: string | null },
  source: string,
  reason: string,
): Promise<Carried | undefined> {
  if (previous.categoryId) return { categoryId: previous.categoryId, source, reason }
  const [rejection] = await executor
    .select()
    .from(reviewQueue)
    .where(and(eq(reviewQueue.postingId, previous.postingId), eq(reviewQueue.status, 'rejected')))
    .orderBy(desc(reviewQueue.resolvedAt))
    .limit(1)
  return rejection ? { rejection, source, reason } : undefined
}

/** Postings are append-only: a void is a reversing transaction that negates
 * every leg, plus voided_at/void_reason on the original. */
async function voidTransaction(executor: DbExecutor, transactionId: string, reason: VoidReason) {
  const [original] = await executor
    .select({ tenantId: transactions.tenantId, date: transactions.date, description: transactions.description })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
  const legs = await executor
    .select({ accountId: postings.accountId, amount: postings.amount, currency: postings.currency })
    .from(postings)
    .where(eq(postings.transactionId, transactionId))

  const [reversal] = await executor
    .insert(transactions)
    .values({
      tenantId: original!.tenantId,
      date: original!.date,
      description: `Reversal: ${original!.description}`,
      source: 'import',
      status: 'cleared',
      createdBy: 'connector',
      reversesTransactionId: transactionId,
    })
    .returning({ id: transactions.id })
  if (legs.length > 0) {
    await executor.insert(postings).values(
      legs.map((leg) => ({
        transactionId: reversal!.id,
        accountId: leg.accountId,
        amount: sql`-(${leg.amount}::numeric)`,
        currency: leg.currency,
      })),
    )
  }
  await executor.update(transactions).set({ voidedAt: new Date(), voidReason: reason }).where(eq(transactions.id, transactionId))
}

async function insertProviderTransaction(
  executor: DbExecutor,
  provider: string,
  bankAccount: Account,
  suspenseAccount: Account,
  tx: NormalizedTransaction,
  carried?: Carried,
) {
  const [row] = await executor
    .insert(transactions)
    .values({
      tenantId: LOCAL_TENANT_ID,
      date: new Date(tx.date),
      description: tx.description,
      source: 'import',
      status: tx.pending ? 'pending' : 'cleared',
      createdBy: 'connector',
      externalRef: `${provider}:${tx.providerTransactionId}`,
    })
    .returning({ id: transactions.id })

  const [bankPosting] = await executor
    .insert(postings)
    .values({
      transactionId: row!.id,
      accountId: bankAccount.id,
      amount: tx.amount.toFixed(8),
      currency: tx.currency,
      counterpartyRaw: tx.description,
      categoryId: carried && 'categoryId' in carried ? carried.categoryId : undefined,
      tags: postingTags(provider, tx),
    })
    .returning({ id: postings.id })
  await executor.insert(postings).values({
    transactionId: row!.id,
    accountId: suspenseAccount.id,
    amount: (-tx.amount).toFixed(8),
    currency: tx.currency,
  })

  if (carried && 'categoryId' in carried) {
    await writeAuditLog(
      {
        postingId: bankPosting!.id,
        action: 'auto_applied',
        categoryId: carried.categoryId,
        source: carried.source,
        confidence: null,
        reason: carried.reason,
        actor: 'system',
      },
      executor,
    )
  } else if (carried) {
    const { rejection } = carried
    await executor.insert(reviewQueue).values({
      postingId: bankPosting!.id,
      suggestedCategoryId: rejection.suggestedCategoryId,
      confidenceBand: rejection.confidenceBand,
      source: rejection.source,
      confidence: rejection.confidence,
      reason: `${carried.reason}; rejected review_queue ${rejection.id}`,
      status: 'rejected',
      resolvedAt: new Date(),
    })
    await writeAuditLog(
      {
        postingId: bankPosting!.id,
        action: 'rejected',
        categoryId: rejection.suggestedCategoryId,
        source: carried.source,
        confidence: Number(rejection.confidence),
        reason: `${carried.reason}; rejected review_queue ${rejection.id}`,
        actor: 'system',
      },
      executor,
    )
  }
}

/** Ingest all new transactions for one connection. `credential` is the
 * provider's opaque token (Plaid access_token, Enable Banking session_id).
 * Saves the provider cursor once the transaction phase is written, unless a
 * row referenced an account listAccounts didn't return (the next sync replays it). */
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

  const changes = await connector.getTransactions(credential, cursor)
  const { nextCursor, historyComplete } = changes
  const ref = (providerTransactionId: string) => `${connector.provider}:${providerTransactionId}`
  const counts = { inserted: 0, skipped: 0, unknownAccount: 0, voided: 0, updated: 0 }

  const ledgerAccountsFor = async (tx: NormalizedTransaction) => {
    const bankAccount = accountByProviderId.get(tx.accountId)
    if (!bankAccount) return undefined // account listAccounts didn't return — skip, don't guess
    const suspenseAccount = await findOrCreateEquityAccount(
      LOCAL_TENANT_ID,
      `equity:uncategorized:${tx.currency.toLowerCase()}`,
      `Uncategorized (${tx.currency})`,
      tx.currency,
    )
    return { bankAccount, suspenseAccount }
  }

  const postedPendingIds = new Set(changes.added.flatMap((tx) => (tx.pendingTransactionId ? [tx.pendingTransactionId] : [])))
  for (const removed of changes.removed) {
    const voided = await db.transaction(async (tx_db) => {
      const live = await findBankPosting(tx_db, ref(removed.providerTransactionId), true)
      if (!live) return false
      const reason = postedPendingIds.has(removed.providerTransactionId) ? 'pending_posted' : 'provider_removed'
      await voidTransaction(tx_db, live.transactionId, reason)
      return true
    })
    if (voided) counts.voided++
  }

  for (const tx of changes.added) {
    const ledgerAccounts = await ledgerAccountsFor(tx)
    if (!ledgerAccounts) {
      counts.unknownAccount++
      continue
    }
    const outcome = await db.transaction(async (tx_db) => {
      if (await findBankPosting(tx_db, ref(tx.providerTransactionId), true)) return 'duplicate'
      const pending = tx.pendingTransactionId ? await findBankPosting(tx_db, ref(tx.pendingTransactionId), false) : undefined
      const pendingWasLive = pending !== undefined && pending.voidedAt === null
      if (pendingWasLive) await voidTransaction(tx_db, pending.transactionId, 'pending_posted')
      const carried = pending
        ? await decisionToCarry(tx_db, pending, 'pending-carry', `carried from pending transaction ${ref(tx.pendingTransactionId!)}`)
        : undefined
      await insertProviderTransaction(tx_db, connector.provider, ledgerAccounts.bankAccount, ledgerAccounts.suspenseAccount, tx, carried)
      return pendingWasLive ? 'posted' : 'inserted'
    })
    if (outcome === 'duplicate') counts.skipped++
    else counts.inserted++
    if (outcome === 'posted') counts.voided++
  }

  for (const tx of changes.modified) {
    const ledgerAccounts = await ledgerAccountsFor(tx)
    if (!ledgerAccounts) {
      counts.unknownAccount++
      continue
    }
    const { bankAccount, suspenseAccount } = ledgerAccounts
    const outcome = await db.transaction(async (tx_db) => {
      const live = await findBankPosting(tx_db, ref(tx.providerTransactionId), true)
      if (!live) {
        await insertProviderTransaction(tx_db, connector.provider, bankAccount, suspenseAccount, tx)
        return 'inserted'
      }
      if (live.accountId === bankAccount.id && Number(live.amount) === tx.amount && live.description === tx.description) {
        const next = {
          date: new Date(tx.date),
          status: live.status === 'reconciled' ? live.status : tx.pending ? ('pending' as const) : ('cleared' as const),
        }
        if (live.date.getTime() === next.date.getTime() && live.status === next.status) {
          return 'unchanged'
        }
        await tx_db.update(transactions).set(next).where(eq(transactions.id, live.transactionId))
        return 'updated'
      }
      await voidTransaction(tx_db, live.transactionId, 'provider_modified')
      const carried = await decisionToCarry(
        tx_db,
        live,
        'modified-carry',
        `carried from ${ref(tx.providerTransactionId)} before the provider changed its amount, account or description`,
      )
      await insertProviderTransaction(tx_db, connector.provider, bankAccount, suspenseAccount, tx, carried)
      return 'replaced'
    })
    if (outcome === 'inserted') counts.inserted++
    else if (outcome === 'updated') counts.updated++
    else if (outcome === 'unchanged') counts.skipped++
    else {
      counts.voided++
      counts.inserted++
    }
  }

  if (cursor === undefined) {
    const snapshotRefs = new Set([...changes.added, ...changes.modified].map((tx) => ref(tx.providerTransactionId)))
    const livePending = await db
      .selectDistinct({ externalRef: transactions.externalRef })
      .from(transactions)
      .innerJoin(postings, eq(postings.transactionId, transactions.id))
      .innerJoin(accounts, eq(accounts.id, postings.accountId))
      .where(and(eq(accounts.connectorId, connectorId), eq(transactions.status, 'pending'), isNull(transactions.voidedAt)))
    for (const { externalRef } of livePending) {
      if (!externalRef || snapshotRefs.has(externalRef)) continue
      const voided = await db.transaction(async (tx_db) => {
        const live = await findBankPosting(tx_db, externalRef, true)
        if (!live) return false
        await voidTransaction(tx_db, live.transactionId, 'provider_removed')
        return true
      })
      if (voided) counts.voided++
    }
  }

  if (nextCursor && counts.unknownAccount === 0) await updateConnectionCursor(LOCAL_TENANT_ID, connectorId, nextCursor)

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
      continue
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
    if ((await postOpeningBalance(LOCAL_TENANT_ID, account, current)) === 'no_transactions') {
      balanceFlags.push({ account: account.name, issue: 'no_transactions' })
    }
  }

  return {
    accountsSeen: providerAccounts.length,
    unclassifiedAccounts: providerAccounts.filter((acct) => acct.kind === 'other').map((acct) => acct.name),
    balanceFlags,
    transactionsInserted: counts.inserted,
    transactionsSkipped: counts.skipped,
    transactionsUnknownAccount: counts.unknownAccount,
    transactionsVoided: counts.voided,
    transactionsUpdated: counts.updated,
  }
}

export { LOCAL_TENANT_ID }
