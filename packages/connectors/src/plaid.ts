/** SOURCE OF TRUTH: the Plaid implementation of the Connector interface.
 * WHAT: createPlaidConnector(credentials) returns listAccounts/getBalances/
 * getTransactions against Plaid's API, normalized into Fluide's internal
 * shapes (types.ts). createPlaidLinkToken/exchangePlaidPublicToken take the
 * same credentials for the enrollment handshake. PLAID_ENV
 * (sandbox/development/production) selects the base path — that's an
 * environment choice, not a secret, so it stays an env var.
 * WHY: this is the ONE place Plaid's raw conventions get translated. Plaid's
 * amount is positive-for-spent (confirmed live: Uber +5.40) — the opposite
 * of Fluide's convention — so it's negated here, not assumed elsewhere.
 * providerCategory is reference-only; it must never be written straight into
 * postings.category_id (that needs the categorization_rules engine, later).
 * `PlaidCredentials` (client_id/secret) is a parameter everywhere, never read
 * from process.env — it's entered via Settings and stored encrypted
 * (apps/server's provider-credentials.ts + vault.ts).
 * WHERE: owns Plaid HTTP + translation only. Interface shape lives in
 * types.ts; which credentials to use, and where they come from, is
 * apps/server's job.
 */
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid'
import type {
  Connector,
  NormalizedAccount,
  NormalizedBalance,
  NormalizedTransaction,
} from './types.js'

export type PlaidCredentials = { clientId: string; secret: string }

const env = process.env.PLAID_ENV ?? 'sandbox'

const basePath =
  env === 'production'
    ? PlaidEnvironments.production
    : env === 'development'
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox

function plaidClient(credentials: PlaidCredentials): PlaidApi {
  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': credentials.clientId,
          'PLAID-SECRET': credentials.secret,
        },
      },
    }),
  )
}

export function createPlaidConnector(credentials: PlaidCredentials): Connector {
  const client = plaidClient(credentials)
  return {
    provider: 'plaid',

    async listAccounts(accessToken) {
      const response = await client.accountsGet({ access_token: accessToken })
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
      const response = await client.accountsBalanceGet({ access_token: accessToken })
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
      const response = await client.transactionsSync({
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
}

// Not part of Connector — link tokens have no provider-agnostic equivalent
// (Teller uses a static app_id + widget, not a per-session token).
export async function createPlaidLinkToken(credentials: PlaidCredentials, clientUserId: string) {
  const response = await plaidClient(credentials).linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: 'Fluide',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return response.data.link_token
}

export async function exchangePlaidPublicToken(credentials: PlaidCredentials, publicToken: string) {
  const response = await plaidClient(credentials).itemPublicTokenExchange({ public_token: publicToken })
  return { itemId: response.data.item_id, accessToken: response.data.access_token }
}
