import { afterEach, beforeAll, describe, expect, spyOn, test, type Mock } from 'bun:test'
import { Configuration, PlaidApi } from 'plaid'
import { ConnectorError } from '../src/errors.ts'
import { createPlaidConnector, createPlaidLinkToken, exchangePlaidPublicToken, getPlaidInstitution, plaidAccountKind, plaidEnvironment } from '../src/plaid.ts'

const SECRET = 'secret-SHOULD-NOT-LEAK'
const ACCESS_TOKEN = 'access-sandbox-SHOULD-NOT-LEAK'
const credentials = { clientId: 'client-id', secret: SECRET }

const spies: Mock<(...args: never[]) => unknown>[] = []
function stub<
  K extends 'accountsGet' | 'accountsBalanceGet' | 'transactionsSync' | 'itemPublicTokenExchange' | 'linkTokenCreate' | 'itemGet' | 'institutionsGetById',
>(
  method: K,
  impl: (request: { cursor?: string } & Record<string, unknown>) => Promise<unknown>,
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

describe('Plaid Link and Item metadata', () => {
  test('a new link asks for Transactions with 730 days; update mode sends only the access token', async () => {
    const requests: Record<string, unknown>[] = []
    stub('linkTokenCreate', async (request) => {
      requests.push(request)
      return { data: { link_token: 'link-1' } }
    })
    await createPlaidLinkToken(credentials, 'user-1')
    await createPlaidLinkToken(credentials, 'user-1', ACCESS_TOKEN)
    expect(requests[0]).toMatchObject({ products: ['transactions'], transactions: { days_requested: 730 } })
    expect(requests[0]).not.toHaveProperty('access_token')
    expect(requests[1]).toMatchObject({ access_token: ACCESS_TOKEN })
    expect(requests[1]).not.toHaveProperty('products')
    expect(requests[1]).not.toHaveProperty('transactions')
  })

  test('institution name comes from the Item, or from the institution lookup when the Item has none', async () => {
    const lookup = stub('institutionsGetById', async () => ({ data: { institution: { name: 'First Platypus Bank' } } }))
    stub('itemGet', async () => ({ data: { item: { institution_id: 'ins_109508', institution_name: null } } }))
    expect(await getPlaidInstitution(credentials, ACCESS_TOKEN)).toEqual({ institutionId: 'ins_109508', institutionName: 'First Platypus Bank' })
    expect(lookup).toHaveBeenCalledTimes(1)
    for (const spy of spies.splice(0)) spy.mockRestore()
    const unused = stub('institutionsGetById', async () => ({ data: { institution: { name: 'unused' } } }))
    stub('itemGet', async () => ({ data: { item: { institution_id: 'ins_1', institution_name: 'Named Bank' } } }))
    expect(await getPlaidInstitution(credentials, ACCESS_TOKEN)).toEqual({ institutionId: 'ins_1', institutionName: 'Named Bank' })
    expect(unused).not.toHaveBeenCalled()
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
    const { added } = await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN)
    expect(added.map((t) => [t.description, t.amount])).toEqual([
      ['Uber', -5.4],
      ['Payroll', 1200],
    ])
  })

  const page = (overrides: Record<string, unknown>) => ({
    data: { added: [], modified: [], removed: [], has_more: false, next_cursor: 'c', transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE', ...overrides },
  })
  const plaidTx = (id: string, extra: Record<string, unknown> = {}) => ({
    transaction_id: id, account_id: 'acct-1', date: '2026-09-01', name: id, merchant_name: null, amount: 1,
    iso_currency_code: 'USD', unofficial_currency_code: null, pending: false, ...extra,
  })

  test('pulls every page, returns all three lists and the final cursor', async () => {
    const cursors: (string | undefined)[] = []
    const pages = [
      page({ added: [plaidTx('p1')], has_more: true, next_cursor: 'c1' }),
      page({ added: [plaidTx('posted', { pending_transaction_id: 'p0' })], removed: [{ transaction_id: 'p0', account_id: 'acct-1' }], modified: [plaidTx('m1')], next_cursor: 'c2' }),
    ]
    stub('transactionsSync', async ({ cursor }) => {
      cursors.push(cursor)
      return pages[cursors.length - 1]
    })
    const changes = await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN, 'c0')
    expect(cursors).toEqual(['c0', 'c1'])
    expect(changes.added.map((t) => [t.providerTransactionId, t.pendingTransactionId])).toEqual([['p1', undefined], ['posted', 'p0']])
    expect(changes.modified.map((t) => t.providerTransactionId)).toEqual(['m1'])
    expect(changes.removed).toEqual([{ providerTransactionId: 'p0', accountId: 'acct-1' }])
    expect(changes.nextCursor).toBe('c2')
    expect(changes.historyComplete).toBe(true)
  })

  test('an id seen on several pages ends in the list of its last event', async () => {
    const pages = [
      page({ added: [plaidTx('x', { pending: true }), plaidTx('y', { amount: 5 })], modified: [plaidTx('z')], has_more: true, next_cursor: 'c1' }),
      page({ modified: [plaidTx('y', { amount: 7 }), plaidTx('w')], removed: [{ transaction_id: 'x', account_id: 'acct-1' }, { transaction_id: 'z', account_id: 'acct-1' }], next_cursor: 'c2' }),
    ]
    let calls = 0
    stub('transactionsSync', async () => pages[calls++])
    const changes = await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN, 'c0')
    expect(changes.added.map((t) => [t.providerTransactionId, t.amount])).toEqual([['y', -7]])
    expect(changes.modified.map((t) => t.providerTransactionId)).toEqual(['w'])
    expect(changes.removed.map((r) => r.providerTransactionId).sort()).toEqual(['x', 'z'])
  })

  test('history is incomplete until the historical pull finishes', async () => {
    stub('transactionsSync', async () => page({ transactions_update_status: 'INITIAL_UPDATE_COMPLETE' }))
    expect((await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN)).historyComplete).toBe(false)
  })

  test('a mutation during pagination restarts from the original cursor without duplicating rows', async () => {
    const cursors: (string | undefined)[] = []
    stub('transactionsSync', async ({ cursor }) => {
      cursors.push(cursor)
      if (cursors.length === 1) return page({ added: [plaidTx('a')], has_more: true, next_cursor: 'c1' })
      if (cursors.length === 2) {
        throw plaidHttpError(400, { error_type: 'TRANSACTIONS_ERROR', error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION', error_message: 'retry' })
      }
      if (cursors.length === 3) return page({ added: [plaidTx('a')], has_more: true, next_cursor: 'c1' })
      return page({ added: [plaidTx('b')], next_cursor: 'c2' })
    })
    const changes = await createPlaidConnector(credentials).getTransactions(ACCESS_TOKEN, 'c0')
    expect(cursors).toEqual(['c0', 'c1', 'c0', 'c1'])
    expect(changes.added.map((t) => t.providerTransactionId)).toEqual(['a', 'b'])
  })

  test('a non-ISO currency uses unofficial_currency_code', async () => {
    stub('accountsGet', async () => ({
      data: { accounts: [account({ iso_currency_code: null, unofficial_currency_code: 'BTC' })] },
    }))
    const [only] = await createPlaidConnector(credentials).listAccounts(ACCESS_TOKEN)
    expect(only?.currency).toBe('BTC')
  })

  test('no currency at all is refused instead of guessed as USD', async () => {
    stub('accountsGet', async () => ({
      data: { accounts: [account({ iso_currency_code: null, unofficial_currency_code: null })] },
    }))
    const err = await rejection(createPlaidConnector(credentials).getBalances(ACCESS_TOKEN))
    expect(err.kind).toBe('bad_response')
    expect(err.message).toContain('acct-1')
  })

  test('balances come from the free accountsGet, never the billed accountsBalanceGet', async () => {
    stub('accountsGet', async () => ({ data: { accounts: [account({})] } }))
    const billed = stub('accountsBalanceGet', async () => ({ data: { accounts: [] } }))
    await createPlaidConnector(credentials).getBalances(ACCESS_TOKEN)
    expect(billed).not.toHaveBeenCalled()
  })

  test('money owed is negative; available only for cash, limit only for debts; other types get no balance', async () => {
    const acct = (id: string, type: string, balances: Record<string, unknown>) => ({ ...account(balances), account_id: id, type })
    stub('accountsGet', async () => ({
      data: {
        accounts: [
          acct('cash', 'depository', { current: 110, available: 100, limit: 500 }),
          acct('card', 'credit', { current: 410, available: 1590, limit: 2000 }),
          acct('heloc', 'loan', { current: 13500.5, available: 47647.5, limit: 61148 }),
          acct('ira', 'investment', { current: 320.76, available: null }),
          acct('mystery', 'other', { current: 50, available: 50 }),
        ],
      },
    }))
    const rows = await createPlaidConnector(credentials).getBalances(ACCESS_TOKEN)
    expect(rows.map((b) => [b.providerAccountId, b.balanceType, b.amount])).toEqual([
      ['cash', 'current', 110],
      ['cash', 'available', 100],
      ['card', 'current', -410],
      ['card', 'limit', 2000],
      ['heloc', 'current', -13500.5],
      ['heloc', 'limit', 61148],
      ['ira', 'current', 320.76],
    ])
  })
})

describe('plaidAccountKind', () => {
  test.each([
    ['depository', 'cash'],
    ['investment', 'investment'],
    ['brokerage', 'investment'],
    ['credit', 'credit'],
    ['loan', 'loan'],
    ['other', 'other'],
    ['payroll', 'other'],
    ['some-future-type', 'other'],
  ] as const)('%s -> %s', (type, kind) => {
    expect(plaidAccountKind(type)).toBe(kind)
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

  test.each([undefined, ''])('unset or empty (%p) selects production', (value) => {
    if (value === undefined) delete process.env.PLAID_ENV
    else process.env.PLAID_ENV = value
    expect(plaidEnvironment()).toBe('production')
  })
})
