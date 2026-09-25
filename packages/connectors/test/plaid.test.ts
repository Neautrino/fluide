import { afterEach, beforeAll, describe, expect, spyOn, test, type Mock } from 'bun:test'
import { Configuration, PlaidApi } from 'plaid'
import { ConnectorError } from '../src/errors.ts'
import { createPlaidConnector, createPlaidLinkToken, exchangePlaidPublicToken } from '../src/plaid.ts'

const SECRET = 'secret-SHOULD-NOT-LEAK'
const ACCESS_TOKEN = 'access-sandbox-SHOULD-NOT-LEAK'
const credentials = { clientId: 'client-id', secret: SECRET }

const spies: Mock<(...args: never[]) => unknown>[] = []
function stub<K extends 'accountsGet' | 'accountsBalanceGet' | 'transactionsSync' | 'itemPublicTokenExchange' | 'linkTokenCreate'>(
  method: K,
  impl: () => Promise<unknown>,
) {
  const spy = spyOn(PlaidApi.prototype, method).mockImplementation(impl as never)
  spies.push(spy as never)
  return spy
}

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore()
})

/** A real AxiosError from the real SDK, produced locally: a request to a
 * closed port with the secret header and access_token body set, so the test
 * sees exactly what the SDK would have thrown. */
let networkError: unknown
beforeAll(async () => {
  const client = new PlaidApi(
    new Configuration({ basePath: 'http://127.0.0.1:9', baseOptions: { headers: { 'PLAID-SECRET': SECRET } } }),
  )
  networkError = await client.accountsGet({ access_token: ACCESS_TOKEN }).then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(JSON.stringify((networkError as { config: unknown }).config)).toContain(SECRET)
})

function plaidHttpError(status: number, data: { error_type: string; error_code: string; error_message: string }) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config: { headers: { 'PLAID-SECRET': SECRET }, data: JSON.stringify({ access_token: ACCESS_TOKEN }) },
    response: { status, data },
  })
}

async function rejection(promise: Promise<unknown>): Promise<ConnectorError> {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ConnectorError)
  return err as ConnectorError
}

function expectNoSecrets(err: ConnectorError) {
  for (const rendered of [err.message, JSON.stringify(err), Bun.inspect(err), String(err.stack)]) {
    expect(rendered).not.toContain(SECRET)
    expect(rendered).not.toContain(ACCESS_TOKEN)
  }
  expect(err.cause).toBeUndefined()
}

const account = (balances: Record<string, unknown>) => ({
  account_id: 'acct-1',
  name: 'Checking',
  type: 'depository',
  subtype: 'checking',
  balances: { available: 90, current: 100, iso_currency_code: 'USD', unofficial_currency_code: null, ...balances },
})

describe('Plaid SDK errors become ConnectorError without secrets', () => {
  test('a network failure is provider_unavailable and carries neither the secret nor the access token', async () => {
    stub('accountsGet', () => Promise.reject(networkError))
    const err = await rejection(createPlaidConnector(credentials).listAccounts(ACCESS_TOKEN))
    expect(err.kind).toBe('provider_unavailable')
    expect(err.message).toContain('accountsGet')
    expectNoSecrets(err)
  })

  test.each([
    ['ITEM_LOGIN_REQUIRED', 400, 'ITEM_ERROR', 'reauth_required'],
    ['INVALID_API_KEYS', 400, 'INVALID_INPUT', 'invalid_credentials'],
    ['TRANSACTIONS_LIMIT', 429, 'RATE_LIMIT_EXCEEDED', 'rate_limited'],
    ['INSTITUTION_DOWN', 400, 'INSTITUTION_ERROR', 'provider_unavailable'],
    ['INTERNAL_SERVER_ERROR', 500, 'API_ERROR', 'provider_unavailable'],
    ['INVALID_FIELD', 400, 'INVALID_REQUEST', 'invalid_input'],
  ] as const)('%s -> %s', async (code, status, type, kind) => {
    stub('transactionsSync', () =>
      Promise.reject(plaidHttpError(status, { error_type: type, error_code: code, error_message: 'plaid says no' })),
    )
    const err = await rejection(createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN))
    expect(err.kind).toBe(kind)
    expect(err.details).toEqual({ status, providerCode: code })
    expect(err.message).toContain(code)
    expectNoSecrets(err)
  })

  test('a bad public token on exchange is invalid_input, not a server error', async () => {
    stub('itemPublicTokenExchange', () =>
      Promise.reject(
        plaidHttpError(400, { error_type: 'INVALID_INPUT', error_code: 'INVALID_PUBLIC_TOKEN', error_message: 'bad token' }),
      ),
    )
    const err = await rejection(exchangePlaidPublicToken(credentials, 'public-sandbox-bogus'))
    expect(err.kind).toBe('invalid_input')
    expectNoSecrets(err)
  })

  test('link token creation failures are translated too', async () => {
    stub('linkTokenCreate', () => Promise.reject(networkError))
    const err = await rejection(createPlaidLinkToken(credentials, 'user-1'))
    expect(err.kind).toBe('provider_unavailable')
    expectNoSecrets(err)
  })
})

describe('Plaid normalization', () => {
  test('Plaid positive-for-spent amounts are flipped to Fluide negative-for-spent', async () => {
    stub('transactionsSync', async () => ({
      data: {
        added: [
          {
            transaction_id: 'tx-1',
            account_id: 'acct-1',
            date: '2026-09-01',
            name: 'UBER TRIP',
            merchant_name: 'Uber',
            amount: 5.4,
            iso_currency_code: 'USD',
            unofficial_currency_code: null,
            pending: false,
            personal_finance_category: { primary: 'TRANSPORTATION' },
          },
          {
            transaction_id: 'tx-2',
            account_id: 'acct-1',
            date: '2026-09-02',
            name: 'Payroll',
            merchant_name: null,
            amount: -1200,
            iso_currency_code: 'USD',
            unofficial_currency_code: null,
            pending: false,
          },
        ],
        modified: [],
        removed: [],
        has_more: false,
        next_cursor: 'cursor-1',
      },
    }))
    const { transactions } = await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN)
    expect(transactions.map((t) => [t.description, t.amount])).toEqual([
      ['Uber', -5.4],
      ['Payroll', 1200],
    ])
  })

  test('a non-ISO currency uses unofficial_currency_code', async () => {
    stub('accountsGet', async () => ({
      data: { accounts: [account({ iso_currency_code: null, unofficial_currency_code: 'BTC' })] },
    }))
    const [only] = await createPlaidConnector(credentials).listAccounts(ACCESS_TOKEN)
    expect(only?.currency).toBe('BTC')
  })

  test('no currency at all is refused instead of guessed as USD', async () => {
    stub('accountsBalanceGet', async () => ({
      data: { accounts: [account({ iso_currency_code: null, unofficial_currency_code: null })] },
    }))
    const err = await rejection(createPlaidConnector(credentials).getBalances(ACCESS_TOKEN))
    expect(err.kind).toBe('bad_response')
    expect(err.message).toContain('acct-1')
  })
})

describe('PLAID_ENV', () => {
  const original = process.env.PLAID_ENV
  afterEach(() => {
    if (original === undefined) delete process.env.PLAID_ENV
    else process.env.PLAID_ENV = original
  })

  test.each(['development', 'prod', 'Sandbox'])('%s is refused instead of silently picking an environment', (value) => {
    process.env.PLAID_ENV = value
    expect(() => createPlaidConnector(credentials)).toThrow('PLAID_ENV must be "sandbox" or "production"')
  })

  test.each(['sandbox', 'production'])('%s is accepted', (value) => {
    process.env.PLAID_ENV = value
    expect(() => createPlaidConnector(credentials)).not.toThrow()
  })
})
