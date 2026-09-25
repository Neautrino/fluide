import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test, type Mock } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createEnableBankingConnector,
  listEnableBankingAspsps,
  loadEnableBankingKey,
  type EnableBankingCredentials,
} from '../src/enable-banking.ts'
import { ConnectorError } from '../src/errors.ts'

let dir: string
let credentials: EnableBankingCredentials

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'fluide-eb-test-'))
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  const keyPath = join(dir, 'app.pem')
  writeFileSync(keyPath, privateKey)
  credentials = { appId: 'test-app-http', keyPath }
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

// ---------------------------------------------------------------- fetch stub

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>
let fetchSpy: Mock<typeof fetch> | undefined

/** Routes `${METHOD} ${pathname}` to a handler; an unrouted call fails the test. */
function stubFetch(routes: Record<string, Handler>) {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const handler = routes[`${init.method ?? 'GET'} ${url.pathname}`]
    if (!handler) throw new Error(`unexpected fetch ${init.method} ${url.pathname}`)
    return handler(url, init)
  }) as typeof fetch)
  return fetchSpy
}

afterEach(() => {
  fetchSpy?.mockRestore()
  fetchSpy = undefined
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function rejection(promise: Promise<unknown>): Promise<ConnectorError> {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ConnectorError)
  return err as ConnectorError
}

const SESSION_ID = 'session-id-SECRET-123'
const session = () => json({ accounts_data: [{ uid: 'uid-1', identification_hash: 'hash-1' }] })
const booked = (entry: string, status = 'BOOK') => ({
  entry_reference: entry,
  transaction_amount: { amount: '1.00', currency: 'EUR' },
  credit_debit_indicator: 'DBIT',
  status,
  booking_date: '2026-09-23',
})

// ---------------------------------------------------------------- error mapping

describe('Enable Banking API failures become ConnectorError kinds', () => {
  test.each([
    ['401 with no body code', () => json({ message: 'bad jwt' }, 401), 'invalid_credentials'],
    ['403 ACCESS_DENIED', () => json({ message: 'denied', error: 'ACCESS_DENIED' }, 403), 'invalid_credentials'],
    ['EXPIRED_SESSION wins over the status', () => json({ message: 'Session is expired', error: 'EXPIRED_SESSION' }, 422), 'reauth_required'],
    ['REVOKED_SESSION', () => json({ message: 'revoked', error: 'REVOKED_SESSION' }, 400), 'reauth_required'],
    ['429 with no body code', () => json({}, 429), 'rate_limited'],
    ['ASPSP_RATE_LIMIT_EXCEEDED', () => json({ error: 'ASPSP_RATE_LIMIT_EXCEEDED' }, 400), 'rate_limited'],
    ['503 with an HTML body', () => new Response('<html>down</html>', { status: 503 }), 'provider_unavailable'],
    ['ASPSP_TIMEOUT', () => json({ error: 'ASPSP_TIMEOUT' }, 400), 'provider_unavailable'],
    ['other 4xx', () => json({ error: 'WRONG_REQUEST_PARAMETERS' }, 400), 'invalid_input'],
    ['2xx that is not JSON', () => new Response('surprise', { status: 200 }), 'bad_response'],
  ] as const)('%s -> %s', async (_label, respond, kind) => {
    stubFetch({ 'GET /aspsps': respond })
    const err = await rejection(listEnableBankingAspsps(credentials, 'FI'))
    expect(err.kind).toBe(kind)
    expect(err.provider).toBe('enable-banking')
  })

  test('status and the provider error code are kept for the caller', async () => {
    stubFetch({ 'GET /aspsps': () => json({ message: 'Session is expired', error: 'EXPIRED_SESSION' }, 422) })
    const err = await rejection(listEnableBankingAspsps(credentials, 'FI'))
    expect(err.details).toEqual({ status: 422, providerCode: 'EXPIRED_SESSION' })
  })

  test('a network failure is provider_unavailable with method and path', async () => {
    stubFetch({ 'GET /aspsps': () => Promise.reject(new TypeError('fetch failed')) })
    const err = await rejection(listEnableBankingAspsps(credentials, 'FI'))
    expect(err.kind).toBe('provider_unavailable')
    expect(err.message).toContain('GET /aspsps')
  })

  test('an aborted-by-timeout request is provider_unavailable and says so', async () => {
    stubFetch({ 'GET /aspsps': () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')) })
    const err = await rejection(listEnableBankingAspsps(credentials, 'FI'))
    expect(err.kind).toBe('provider_unavailable')
    expect(err.message).toContain('timed out')
  })

  test('the session id never appears in the error message', async () => {
    stubFetch({ [`GET /sessions/${SESSION_ID}`]: () => json({ message: 'Session is expired', error: 'EXPIRED_SESSION' }, 422) })
    const err = await rejection(createEnableBankingConnector(credentials).listAccounts(SESSION_ID))
    expect(err.kind).toBe('reauth_required')
    expect(err.message).toContain('/sessions/{id}')
    expect(err.message).not.toContain(SESSION_ID)
  })
})

// ---------------------------------------------------------------- connector reads

describe('getTransactions', () => {
  test('follows continuation_key across pages and drops non-BOOK rows the bank returns anyway', async () => {
    const seenKeys: (string | null)[] = []
    stubFetch({
      [`GET /sessions/${SESSION_ID}`]: session,
      'GET /accounts/uid-1/transactions': (url) => {
        const key = url.searchParams.get('continuation_key')
        seenKeys.push(key)
        return key === null
          ? json({ transactions: [booked('R1')], continuation_key: 'page-2' })
          : json({ transactions: [booked('R2'), booked('P1', 'PDNG')], continuation_key: null })
      },
    })
    const { transactions } = await createEnableBankingConnector(credentials).getTransactions(SESSION_ID)
    expect(seenKeys).toEqual([null, 'page-2'])
    expect(transactions.map((t) => t.providerTransactionId)).toEqual(['hash-1:R1', 'hash-1:R2'])
  })

  test('a bank that never stops paging is refused instead of looping forever', async () => {
    stubFetch({
      [`GET /sessions/${SESSION_ID}`]: session,
      'GET /accounts/uid-1/transactions': () => json({ transactions: [], continuation_key: 'again' }),
    })
    const err = await rejection(createEnableBankingConnector(credentials).getTransactions(SESSION_ID))
    expect(err.kind).toBe('bad_response')
    expect(err.message).toContain('transaction pages')
  })
})

describe('getBalances', () => {
  test('CLBD is current and CLAV is available, exact types only', async () => {
    stubFetch({
      [`GET /sessions/${SESSION_ID}`]: session,
      'GET /accounts/uid-1/balances': () =>
        json({
          balances: [
            { balance_type: 'ITAV', balance_amount: { amount: '1.00', currency: 'EUR' } },
            { balance_type: 'CLBD', balance_amount: { amount: '10.50', currency: 'EUR' } },
            { balance_type: 'CLAV', balance_amount: { amount: '9.00', currency: 'EUR' } },
          ],
        }),
    })
    expect(await createEnableBankingConnector(credentials).getBalances(SESSION_ID)).toEqual([
      { providerAccountId: 'hash-1', current: 10.5, available: 9, currency: 'EUR' },
    ])
  })

  test('a non-numeric balance amount is refused, not reported as NaN', async () => {
    stubFetch({
      [`GET /sessions/${SESSION_ID}`]: session,
      'GET /accounts/uid-1/balances': () =>
        json({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: 'n/a', currency: 'EUR' } }] }),
    })
    expect((await rejection(createEnableBankingConnector(credentials).getBalances(SESSION_ID))).kind).toBe('bad_response')
  })
})

// ---------------------------------------------------------------- signing key

describe('loadEnableBankingKey', () => {
  test('a PKCS#8 RSA key loads', async () => {
    const key = await loadEnableBankingKey(credentials.keyPath)
    expect(key.type).toBe('private')
    expect(key.usages).toEqual(['sign'])
  })

  test.each([
    ['a missing file', () => join(dir, 'missing.pem'), 'not readable (ENOENT)'],
    ['a directory', () => dir, 'not readable (EISDIR)'],
    ['a file that is not a key', () => writeTemp('not-a-key.pem', 'hello\n'), 'not an unencrypted PKCS#8 RSA key'],
    [
      'a PKCS#1 key',
      () =>
        writeTemp(
          'pkcs1.pem',
          generateKeyPairSync('rsa', {
            modulusLength: 2048,
            privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
          }).privateKey,
        ),
      'not an unencrypted PKCS#8 RSA key',
    ],
  ] as const)('%s is invalid_credentials', async (_label, path, message) => {
    const err = await rejection(loadEnableBankingKey(path()))
    expect(err.kind).toBe('invalid_credentials')
    expect(err.message).toContain(message)
  })

  test('a failed load is not cached: fixing the file works without a restart', async () => {
    const keyPath = join(dir, 'later.pem')
    await rejection(loadEnableBankingKey(keyPath))
    writeFileSync(keyPath, readKey())
    expect((await loadEnableBankingKey(keyPath)).type).toBe('private')
  })

  test('a bad key fails the API call before any request is sent', async () => {
    const spy = stubFetch({})
    const err = await rejection(listEnableBankingAspsps({ appId: 'test-app-badkey', keyPath: join(dir, 'nope.pem') }, 'FI'))
    expect(err.kind).toBe('invalid_credentials')
    expect(spy).not.toHaveBeenCalled()
  })
})

function writeTemp(name: string, content: string) {
  const path = join(dir, name)
  writeFileSync(path, content)
  return path
}

function readKey() {
  return readFileSync(credentials.keyPath, 'utf-8')
}
