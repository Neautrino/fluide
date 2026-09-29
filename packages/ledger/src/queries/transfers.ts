/* SOURCE OF TRUTH: transfer detection and user transfer decisions; sole writer of transfer_marks.
 * Invariant: user marks are never changed by detection; provider-tag transfers are suggestions, not exclusions. Enforced by: detectTransferMarks, isExcludedMark tests.
 * See: ADR 018 — why transfers and card payments are left out of cash flow
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../db.js'
import { accounts, postings, transactions, transferMarks } from '../schema/index.js'
import { bankPostingsFilter } from './period.js'
import { isTransferPairCandidate, matchTransferPairs, pairTransferKind, taggedTransferKind } from './transfer-match.js'

type NewMark = typeof transferMarks.$inferInsert
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const WRITE_BATCH = 1000

/** Re-derives every detected transfer mark for the tenant from its live bank
 * legs and replaces the stored derived set with it: unique opposite-amount
 * pairs first, then provider tags on the legs left unpaired. Legs the user
 * has decided on are neither marked nor paired, and their marks are left as
 * they are. An existing pair whose legs are both live and still pair by
 * amount/currency/date/account stays paired even if a newer leg made the
 * match ambiguous; any other derived mark the run no longer derives is
 * deleted. Idempotent. Serialized per tenant. `marked` counts the derived
 * marks after the run, `paired` the pairs among them. */
export async function detectTransferMarks(tenantId: string): Promise<{ marked: number; paired: number }> {
  return db.transaction((tx) => rederiveMarks(tx, tenantId))
}

export class TransferDecisionNotFoundError extends Error {
  constructor(readonly transactionId: string) {
    super(`no live bank transaction ${transactionId} for this tenant`)
    this.name = 'TransferDecisionNotFoundError'
  }
}

/** Records the user's call on one bank leg: 'mine' = a move between their
 * own accounts (left out of cash flow), 'payment' = counted and never
 * suggested again. Replaces any detected mark on the leg, then re-derives
 * the rest so a former pair partner is re-evaluated alone. Repeating the
 * leg's current decision changes nothing and skips the re-derive. */
export async function decideTransfer(tenantId: string, transactionId: string, decision: 'mine' | 'payment'): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}))`)
    const [leg] = await tx
      .select({ transactionId: postings.transactionId })
      .from(postings)
      .innerJoin(transactions, eq(transactions.id, postings.transactionId))
      .innerJoin(accounts, eq(accounts.id, postings.accountId))
      .where(and(bankPostingsFilter(tenantId, 'all_time'), eq(transactions.id, transactionId)))
      .limit(1)
    if (!leg) throw new TransferDecisionNotFoundError(transactionId)
    const kind = decision === 'mine' ? 'transfer' : 'not_transfer'
    const [current] = await tx
      .select({ kind: transferMarks.kind, method: transferMarks.method })
      .from(transferMarks)
      .where(and(eq(transferMarks.tenantId, tenantId), eq(transferMarks.transactionId, transactionId)))
    if (current?.method === 'user' && current.kind === kind) return
    await tx
      .insert(transferMarks)
      .values({ tenantId, transactionId, pairTransactionId: null, kind, method: 'user' })
      .onConflictDoUpdate({
        target: transferMarks.transactionId,
        set: { kind, method: 'user', pairTransactionId: null, updatedAt: sql`now()` },
      })
    await rederiveMarks(tx, tenantId)
  })
}

async function rederiveMarks(tx: Tx, tenantId: string): Promise<{ marked: number; paired: number }> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}))`)
  const rows = await tx
    .select({
      transactionId: postings.transactionId,
      accountId: postings.accountId,
      accountKind: accounts.kind,
      amount: postings.amount,
      currency: postings.currency,
      date: transactions.date,
      tags: postings.tags,
    })
    .from(postings)
    .innerJoin(transactions, eq(transactions.id, postings.transactionId))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(bankPostingsFilter(tenantId, 'all_time'))
  const existing = await tx
    .select({ transactionId: transferMarks.transactionId, pairTransactionId: transferMarks.pairTransactionId, method: transferMarks.method })
    .from(transferMarks)
    .where(eq(transferMarks.tenantId, tenantId))
  const decided = new Set(existing.flatMap((mark) => (mark.method === 'user' ? [mark.transactionId] : [])))
  const legs = rows.flatMap((row) => (decided.has(row.transactionId) ? [] : [{ ...row, amount: Number(row.amount) }]))
  const legByTransaction = new Map(legs.map((leg) => [leg.transactionId, leg]))

  const marks = new Map<string, NewMark>()
  let paired = 0
  const markPair = (outTransactionId: string, inTransactionId: string) => {
    const kind = pairTransferKind(legByTransaction.get(outTransactionId)!.accountKind, legByTransaction.get(inTransactionId)!.accountKind)
    marks.set(outTransactionId, { tenantId, transactionId: outTransactionId, pairTransactionId: inTransactionId, kind, method: 'pair_match' })
    marks.set(inTransactionId, { tenantId, transactionId: inTransactionId, pairTransactionId: outTransactionId, kind, method: 'pair_match' })
    paired++
  }

  for (const { outTransactionId, inTransactionId } of matchTransferPairs(legs)) markPair(outTransactionId, inTransactionId)
  for (const mark of existing) {
    if (mark.method !== 'pair_match' || !mark.pairTransactionId) continue
    const leg = legByTransaction.get(mark.transactionId)
    const partner = legByTransaction.get(mark.pairTransactionId)
    if (!leg || !partner || leg.amount >= 0 || marks.has(leg.transactionId) || marks.has(partner.transactionId)) continue
    if (isTransferPairCandidate(leg, partner)) markPair(leg.transactionId, partner.transactionId)
  }
  for (const leg of legs) {
    if (marks.has(leg.transactionId)) continue
    const kind = taggedTransferKind(leg.accountKind, leg.amount, leg.tags)
    if (kind) marks.set(leg.transactionId, { tenantId, transactionId: leg.transactionId, pairTransactionId: null, kind, method: 'provider_tag' })
  }

  const stale = existing.flatMap((mark) => (mark.method === 'user' || marks.has(mark.transactionId) ? [] : [mark.transactionId]))
  for (let i = 0; i < stale.length; i += WRITE_BATCH) {
    await tx
      .delete(transferMarks)
      .where(
        and(
          eq(transferMarks.tenantId, tenantId),
          ne(transferMarks.method, 'user'),
          inArray(transferMarks.transactionId, stale.slice(i, i + WRITE_BATCH)),
        ),
      )
  }
  const values = [...marks.values()]
  for (let i = 0; i < values.length; i += WRITE_BATCH) {
    await tx
      .insert(transferMarks)
      .values(values.slice(i, i + WRITE_BATCH))
      .onConflictDoUpdate({
        target: transferMarks.transactionId,
        set: {
          kind: sql`excluded.kind`,
          method: sql`excluded.method`,
          pairTransactionId: sql`excluded.pair_transaction_id`,
          updatedAt: sql`now()`,
        },
        setWhere: sql`${transferMarks.method} <> 'user' AND (${transferMarks.kind}, ${transferMarks.method}, ${transferMarks.pairTransactionId})
          IS DISTINCT FROM (excluded.kind, excluded.method, excluded.pair_transaction_id)`,
      })
  }
  return { marked: values.length, paired }
}
