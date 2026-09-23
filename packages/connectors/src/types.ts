/** SOURCE OF TRUTH: the provider-agnostic connector interface.
 * WHAT: one shape every regional bank-data provider (Plaid, Teller, Enable
 * Banking, Mono, Pluggy) implements — listAccounts / getBalances /
 * getTransactions — plus the normalized types they all return.
 * WHY: PLAN.md's whole regional-expansion strategy (§6/§8) depends on the
 * ingest pipeline not caring which provider it's talking to. Normalization
 * (sign, category, etc.) happens INSIDE each adapter, never assumed by a caller.
 * WHERE: this file owns the interface shape only. Adapters (plaid.ts, and
 * future teller.ts/enable-banking.ts/etc.) own the actual provider calls.
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
