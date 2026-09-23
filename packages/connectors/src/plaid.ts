/** SOURCE OF TRUTH: the Plaid implementation of the Connector interface.
 * WHAT: listAccounts/getBalances/getTransactions against Plaid's API,
 * normalized into Fluide's internal shapes (types.ts).
 * WHY: this is the ONE place Plaid's raw conventions get translated. Plaid's
 * amount is positive-for-spent (confirmed live: Uber +5.40) — the opposite
 * of Fluide's convention — so it's negated here, not assumed elsewhere.
 * providerCategory is reference-only; it must never be written straight into
 * postings.category_id (that needs the categorization_rules engine, later).
 * WHERE: owns Plaid-specific translation only. Interface shape lives in
 * types.ts; the shared client lives in plaid-client.ts.
 */
import { CountryCode, Products } from 'plaid'
import { plaidClient } from './plaid-client.js'
import type {
  Connector,
  NormalizedAccount,
  NormalizedBalance,
  NormalizedTransaction,
} from './types.js'

export const plaidConnector: Connector = {
  provider: 'plaid',

  async listAccounts(accessToken) {
    const response = await plaidClient.accountsGet({ access_token: accessToken })
    return response.data.accounts.map(
      (acct): NormalizedAccount => ({
        providerAccountId: acct.account_id,
        name: acct.name,
        type: acct.type,
        subtype: acct.subtype ?? undefined,
        currency: acct.balances.iso_currency_code ?? 'USD',
      }),
    )
  },

  async getBalances(accessToken) {
    const response = await plaidClient.accountsBalanceGet({ access_token: accessToken })
    return response.data.accounts.map(
      (acct): NormalizedBalance => ({
        providerAccountId: acct.account_id,
        available: acct.balances.available,
        current: acct.balances.current,
        currency: acct.balances.iso_currency_code ?? 'USD',
      }),
    )
  },

  async getTransactions(accessToken, cursor) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    })

    const transactions: NormalizedTransaction[] = response.data.added.map((tx) => ({
      providerTransactionId: tx.transaction_id,
      accountId: tx.account_id,
      date: tx.date,
      description: tx.merchant_name ?? tx.name,
      amount: -tx.amount, // sign flip — see file header
      currency: tx.iso_currency_code ?? 'USD',
      pending: tx.pending,
      providerCategory: tx.personal_finance_category?.primary,
    }))

    return {
      transactions,
      nextCursor: response.data.has_more ? response.data.next_cursor : undefined,
    }
  },
}

// Not part of Connector — link tokens have no provider-agnostic equivalent
// (Teller uses a static app_id + widget, not a per-session token).
export async function createPlaidLinkToken(clientUserId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: 'Fluide',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return response.data.link_token
}

export async function exchangePlaidPublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
  return { itemId: response.data.item_id, accessToken: response.data.access_token }
}
