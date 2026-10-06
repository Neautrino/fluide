import type { LedgerRow } from '../../types'

const SHOWN = 8

export type LatestRow = LedgerRow & { key: string; accountName: string; merchant: string }
export type Latest = { rows: LatestRow[]; total: number; uncategorized: number }

/** The ledger is newest first; only the top rows are kept, the rest are counted. */
export function toLatest(transactions: LedgerRow[]): Latest {
  return {
    rows: transactions.slice(0, SHOWN).map((row) => ({
      ...row,
      key: row.posting.id ?? `${row.id}:${row.posting.accountId}`,
      accountName: row.account?.name ?? 'Unknown account',
      merchant: row.posting.counterpartyRaw || row.description,
    })),
    total: transactions.length,
    uncategorized: transactions.filter((row) => row.posting.categoryId == null).length,
  }
}
