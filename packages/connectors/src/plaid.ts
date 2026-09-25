/** SOURCE OF TRUTH: the Plaid implementation of the Connector interface.
 * WHAT: createPlaidConnector(credentials) returns listAccounts/getBalances/
 * getTransactions against Plaid's API, normalized into Fluide's internal
 * shapes (types.ts). createPlaidLinkToken/exchangePlaidPublicToken take the
 * same credentials for the enrollment handshake. PLAID_ENV (sandbox or
 * production) selects the base path — that's an environment choice, not a
 * secret, so it stays an env var; any other value throws, because the SDK
 * sends a request with no base path to production.
 * WHY: this is the ONE place Plaid's raw conventions get translated. Plaid's
 * amount is positive-for-spent (confirmed live: Uber +5.40) — the opposite
 * of Fluide's convention — so it's negated here, not assumed elsewhere.
 * Currency is iso_currency_code, else unofficial_currency_code, else the
 * call fails — never a guessed 'USD'.
 * providerCategory is reference-only; it must never be written straight into
 * postings.category_id (that needs the categorization_rules engine, later).
 * `PlaidCredentials` (client_id/secret) is a parameter everywhere, never read
 * from process.env — it's entered via Settings and stored encrypted
 * (apps/server's provider-credentials.ts + vault.ts). Every SDK call goes
 * through plaidCall, which replaces the SDK's AxiosError (it holds the
 * PLAID-SECRET header and the access_token body) with a ConnectorError.
 * WHERE: owns Plaid HTTP + translation only. Interface shape lives in
 * types.ts, the error shape in errors.ts; which credentials to use, and
 * where they come from, is apps/server's job.
 */
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid'
import { ConnectorError, type ConnectorErrorKind } from './errors.js'
import type {
  Connector,
  NormalizedAccount,
  NormalizedBalance,
  NormalizedTransaction,
} from './types.js'

export type PlaidCredentials = { clientId: string; secret: string }

const PROVIDER = 'plaid'

function plaidClient(credentials: PlaidCredentials): PlaidApi {
  const env = process.env.PLAID_ENV ?? 'sandbox'
  const basePath = env === 'sandbox' || env === 'production' ? PlaidEnvironments[env] : undefined
  if (!basePath) throw new Error(`PLAID_ENV must be "sandbox" or "production", got "${env}"`)
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

// ---------------------------------------------------------------- errors

type PlaidErrorBody = { error_type?: string; error_code?: string; error_message?: string }
type SdkError = { isAxiosError?: boolean; code?: string; response?: { status?: number; data?: PlaidErrorBody } }

function plaidErrorKind(body: PlaidErrorBody | undefined): ConnectorErrorKind {
  if (body?.error_code === 'ITEM_LOGIN_REQUIRED') return 'reauth_required'
  if (body?.error_code === 'INVALID_API_KEYS') return 'invalid_credentials'
  switch (body?.error_type) {
    case 'RATE_LIMIT_EXCEEDED':
      return 'rate_limited'
    case 'API_ERROR':
    case 'INSTITUTION_ERROR':
      return 'provider_unavailable'
    case 'INVALID_REQUEST':
    case 'INVALID_INPUT':
    case 'ITEM_ERROR':
      return 'invalid_input'
    default:
      return 'bad_response'
  }
}

/** Builds the error from safe fields only; the SDK error is dropped, not
 * attached as `cause`. */
function toConnectorError(operation: string, err: unknown): ConnectorError {
  if (err instanceof ConnectorError) return err
  const sdk = (typeof err === 'object' && err !== null ? err : {}) as SdkError
  if (!sdk.isAxiosError) {
    return new ConnectorError(PROVIDER, 'bad_response', `Plaid ${operation} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!sdk.response) {
    return new ConnectorError(PROVIDER, 'provider_unavailable', `Plaid ${operation} failed: no response (${sdk.code ?? 'network error'})`)
  }
  const { status, data } = sdk.response
  const detail = [data?.error_code, data?.error_message].filter(Boolean).join(': ')
  return new ConnectorError(PROVIDER, plaidErrorKind(data), `Plaid ${operation} failed: ${status}${detail ? ` ${detail}` : ''}`, {
    status,
    providerCode: data?.error_code,
  })
}

async function plaidCall<T>(operation: string, request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data
  } catch (err) {
    throw toConnectorError(operation, err)
  }
}

function currencyOf(subject: string, iso: string | null | undefined, unofficial: string | null | undefined) {
  const currency = iso ?? unofficial
  if (!currency) {
    throw new ConnectorError(PROVIDER, 'bad_response', `Plaid ${subject} has neither iso_currency_code nor unofficial_currency_code`)
  }
  return currency
}

// ---------------------------------------------------------------- connector

export function createPlaidConnector(credentials: PlaidCredentials): Connector {
  const client = plaidClient(credentials)
  return {
    provider: PROVIDER,

    async listAccounts(accessToken) {
      const data = await plaidCall('accountsGet', () => client.accountsGet({ access_token: accessToken }))
      return data.accounts.map(
        (acct): NormalizedAccount => ({
          providerAccountId: acct.account_id,
          name: acct.name,
          type: acct.type,
          subtype: acct.subtype ?? undefined,
          currency: currencyOf(`account ${acct.account_id}`, acct.balances.iso_currency_code, acct.balances.unofficial_currency_code),
        }),
      )
    },

    async getBalances(accessToken) {
      const data = await plaidCall('accountsBalanceGet', () => client.accountsBalanceGet({ access_token: accessToken }))
      return data.accounts.map(
        (acct): NormalizedBalance => ({
          providerAccountId: acct.account_id,
          available: acct.balances.available,
          current: acct.balances.current,
          currency: currencyOf(`balance for account ${acct.account_id}`, acct.balances.iso_currency_code, acct.balances.unofficial_currency_code),
        }),
      )
    },

    async getTransactions(accessToken, cursor) {
      const data = await plaidCall('transactionsSync', () => client.transactionsSync({ access_token: accessToken, cursor }))

      const transactions: NormalizedTransaction[] = data.added.map((tx) => ({
        providerTransactionId: tx.transaction_id,
        accountId: tx.account_id,
        date: tx.date,
        description: tx.merchant_name ?? tx.name,
        amount: -tx.amount, // sign flip — see file header
        currency: currencyOf(`transaction ${tx.transaction_id}`, tx.iso_currency_code, tx.unofficial_currency_code),
        pending: tx.pending,
        providerCategory: tx.personal_finance_category?.primary,
      }))

      return {
        transactions,
        nextCursor: data.has_more ? data.next_cursor : undefined,
      }
    },
  }
}

// Not part of Connector — link tokens have no provider-agnostic equivalent
// (Teller uses a static app_id + widget, not a per-session token).
export async function createPlaidLinkToken(credentials: PlaidCredentials, clientUserId: string) {
  const client = plaidClient(credentials)
  const data = await plaidCall('linkTokenCreate', () =>
    client.linkTokenCreate({
      user: { client_user_id: clientUserId },
      client_name: 'Fluide',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    }),
  )
  return data.link_token
}

export async function exchangePlaidPublicToken(credentials: PlaidCredentials, publicToken: string) {
  const client = plaidClient(credentials)
  const data = await plaidCall('itemPublicTokenExchange', () =>
    client.itemPublicTokenExchange({ public_token: publicToken }),
  )
  return { itemId: data.item_id, accessToken: data.access_token }
}
