/* SOURCE OF TRUTH: the Plaid adapter; the only place Plaid's raw conventions are translated.
 * Invariant: amount negated; currency iso ?? unofficial ?? throw; PLAID_ENV sandbox|production only. Enforced by: test/plaid.test.ts.
 * Never: let an SDK error escape; every call goes through plaidCall.
 * See: ADR 011 — one module that takes credentials
 */
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  TransactionsUpdateStatus,
  type Transaction as PlaidTransaction,
} from 'plaid'
import { ConnectorError, type ConnectorErrorKind } from './errors.js'
import type {
  Connector,
  NormalizedAccount,
  NormalizedAccountKind,
  NormalizedBalance,
  NormalizedTransaction,
  TransactionChanges,
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

export function plaidAccountKind(type: string): NormalizedAccountKind {
  switch (type) {
    case 'depository':
      return 'cash'
    case 'investment':
    case 'brokerage':
      return 'investment'
    case 'credit':
      return 'credit'
    case 'loan':
      return 'loan'
    default:
      return 'other'
  }
}

const SYNC_PAGE_SIZE = 500
const MAX_SYNC_PAGES = 200
const MAX_SYNC_RESTARTS = 3

function normalizeTransaction(tx: PlaidTransaction): NormalizedTransaction {
  return {
    providerTransactionId: tx.transaction_id,
    accountId: tx.account_id,
    date: tx.date,
    description: tx.merchant_name ?? tx.name,
    amount: -tx.amount, // sign flip — see file header
    currency: currencyOf(`transaction ${tx.transaction_id}`, tx.iso_currency_code, tx.unofficial_currency_code),
    pending: tx.pending,
    providerCategory: tx.personal_finance_category?.primary,
    pendingTransactionId: tx.pending_transaction_id ?? undefined,
  }
}

/** Pulls every page from `cursor`. Plaid requires restarting from the
 * original cursor when the data changes mid-pagination. */
async function syncAllPages(client: PlaidApi, accessToken: string, cursor: string | undefined): Promise<TransactionChanges> {
  for (let restart = 0; restart < MAX_SYNC_RESTARTS; restart++) {
    const changes: TransactionChanges = { added: [], modified: [], removed: [], nextCursor: cursor, historyComplete: false }
    try {
      for (let page = 0; page < MAX_SYNC_PAGES; page++) {
        const data = await plaidCall('transactionsSync', () =>
          client.transactionsSync({ access_token: accessToken, cursor: changes.nextCursor, count: SYNC_PAGE_SIZE }),
        )
        changes.added.push(...data.added.map(normalizeTransaction))
        changes.modified.push(...data.modified.map(normalizeTransaction))
        changes.removed.push(...data.removed.map((r) => ({ providerTransactionId: r.transaction_id, accountId: r.account_id })))
        changes.nextCursor = data.next_cursor
        if (!data.has_more) {
          changes.historyComplete = data.transactions_update_status === TransactionsUpdateStatus.HistoricalUpdateComplete
          return changes
        }
      }
      throw new ConnectorError(PROVIDER, 'bad_response', `Plaid transactionsSync returned more than ${MAX_SYNC_PAGES} pages`)
    } catch (err) {
      if (err instanceof ConnectorError && err.details.providerCode === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') continue
      throw err
    }
  }
  throw new ConnectorError(PROVIDER, 'provider_unavailable', 'Plaid transactions kept changing during pagination; sync again later')
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
          officialName: acct.official_name ?? undefined,
          mask: acct.mask ?? undefined,
          type: acct.type,
          subtype: acct.subtype ?? undefined,
          kind: plaidAccountKind(acct.type),
          currency: currencyOf(`account ${acct.account_id}`, acct.balances.iso_currency_code, acct.balances.unofficial_currency_code),
        }),
      )
    },

    async getBalances(accessToken) {
      const data = await plaidCall('accountsGet', () => client.accountsGet({ access_token: accessToken }))
      const balances: NormalizedBalance[] = []
      for (const acct of data.accounts) {
        const kind = plaidAccountKind(acct.type)
        if (kind === 'other') continue
        const owed = kind === 'credit' || kind === 'loan'
        const base = {
          providerAccountId: acct.account_id,
          currency: currencyOf(`balance for account ${acct.account_id}`, acct.balances.iso_currency_code, acct.balances.unofficial_currency_code),
          isFallback: false,
          asOf: acct.balances.last_updated_datetime ?? undefined,
        }
        const { current, available, limit } = acct.balances
        if (current !== null) {
          balances.push({ ...base, balanceType: 'current', providerBalanceType: 'current', amount: owed ? -current : current })
        }
        if (kind === 'cash' && available !== null) {
          balances.push({ ...base, balanceType: 'available', providerBalanceType: 'available', amount: available })
        }
        if (owed && limit !== null) {
          balances.push({ ...base, balanceType: 'limit', providerBalanceType: 'limit', amount: limit })
        }
      }
      return balances
    },

    getTransactions: (accessToken, cursor) => syncAllPages(client, accessToken, cursor),
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
      transactions: { days_requested: 730 },
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
