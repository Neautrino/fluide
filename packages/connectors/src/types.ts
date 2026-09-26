/* SOURCE OF TRUTH: the provider-agnostic Connector interface and its normalized shapes.
 * Invariant: adapters normalize inside themselves (amount < 0 = money out); callers never re-flip. Enforced by: test/plaid.test.ts, test/enable-banking-normalize.test.ts.
 */

export type NormalizedTransaction = {
  providerTransactionId: string
  accountId: string
  date: string
  description: string
  // NEGATIVE = money left the account, POSITIVE = money entered — opposite
  // of Plaid's raw convention. Every adapter must flip explicitly (see plaid.ts).
  amount: number
  currency: string
  pending: boolean
  // Provider's own category guess — reference/audit only, never write straight
  // into postings.category_id. Must go through categorization_rules first.
  providerCategory?: string
  // true when the provider gave no stable id and the adapter derived one from
  // the transaction's content — ingest tags these so they stay auditable.
  syntheticId?: boolean
}

export type NormalizedAccount = {
  providerAccountId: string
  name: string
  type: string
  subtype?: string
  currency: string
}

export type NormalizedBalance = {
  providerAccountId: string
  available: number | null
  current: number | null
  currency: string
}

export interface Connector {
  readonly provider: string
  listAccounts(accessToken: string): Promise<NormalizedAccount[]>
  getBalances(accessToken: string): Promise<NormalizedBalance[]>
  // cursor: incremental sync (Plaid's transactionsSync model). Adapters
  // without native cursoring may ignore it and return the full window.
  getTransactions(
    accessToken: string,
    cursor?: string,
  ): Promise<{ transactions: NormalizedTransaction[]; nextCursor?: string }>
}
