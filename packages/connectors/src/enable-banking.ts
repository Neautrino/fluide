/* SOURCE OF TRUTH: the Enable Banking (EU PSD2) adapter.
 * Invariant: only BOOK transactions; id = identification_hash:entry_reference, else a flagged content hash. Enforced by: test/enable-banking-{normalize,http}.test.ts.
 * Never: add a non-read endpoint to ALLOWED_CALLS (sandbox apps have payments on). Enforced by: 'refuses %s %s' test.
 * See: ADR 008 — the id/pending rules from Enable Banking's FAQ
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ConnectorError, type ConnectorErrorKind } from './errors.js'
import type { Connector, NormalizedAccount, NormalizedBalance, NormalizedTransaction } from './types.js'

const PROVIDER = 'enable-banking'
const API_BASE = 'https://api.enablebanking.com'
const JWT_LIFETIME_SECONDS = 3600
const MAX_TRANSACTION_PAGES = 500
const REQUEST_TIMEOUT_MS = 30_000

export type EnableBankingCredentials = { appId: string; keyPath: string }

// Read endpoints only. Anything else (notably /payments) is refused locally.
const ALLOWED_CALLS: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: 'GET', path: /^\/aspsps$/ },
  { method: 'POST', path: /^\/auth$/ },
  { method: 'POST', path: /^\/sessions$/ },
  { method: 'GET', path: /^\/sessions\/[^/]+$/ },
  { method: 'DELETE', path: /^\/sessions\/[^/]+$/ },
  { method: 'GET', path: /^\/accounts\/[^/]+\/(details|balances|transactions)$/ },
]

export function assertAllowedEnableBankingCall(method: string, path: string) {
  if (!ALLOWED_CALLS.some((call) => call.method === method && call.path.test(path))) {
    throw new Error(`Enable Banking call refused: ${method} ${path} is not a read-only endpoint`)
  }
}

// ---------------------------------------------------------------- raw shapes

type Amount = { currency: string; amount: string }
type Party = { name?: string }

type EbAccount = {
  uid: string
  identification_hash: string
  name?: string
  product?: string
  details?: string
  currency?: string
  cash_account_type?: string
  account_id?: { iban?: string }
}

export type EbTransaction = {
  entry_reference?: string | null
  transaction_amount: Amount
  credit_debit_indicator: 'CRDT' | 'DBIT'
  status: string
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  creditor?: Party | null
  debtor?: Party | null
  remittance_information?: string[] | null
  balance_after_transaction?: Amount | null
  bank_transaction_code?: { description?: string; code?: string } | null
  merchant_category_code?: string | null
}

type EbBalance = { balance_amount: Amount; balance_type: string }

export type EnableBankingAspsp = {
  name: string
  country: string
  logo?: string
  beta?: boolean
  psu_types?: string[]
  maximum_consent_validity?: number
}

// ---------------------------------------------------------------- auth + http

const cachedKeys = new Map<string, CryptoKey>()
const cachedJwts = new Map<string, { token: string; expiresAt: number }>()

function base64url(input: string | ArrayBuffer) {
  return Buffer.from(typeof input === 'string' ? Buffer.from(input) : new Uint8Array(input)).toString('base64url')
}

/** Reads and imports the app's PKCS#8 signing key; also used by apps/server
 * to reject a bad key path at save time. A failed load is not cached, so a
 * fixed file works on the next call without a restart. */
export async function loadEnableBankingKey(keyPath: string) {
  const cached = cachedKeys.get(keyPath)
  if (cached) return cached
  let pem: string
  try {
    pem = readFileSync(keyPath, 'utf-8')
  } catch (err) {
    const code = (err as { code?: unknown }).code
    throw new ConnectorError(
      PROVIDER,
      'invalid_credentials',
      `Enable Banking private key at ${keyPath} is not readable (${typeof code === 'string' ? code : 'read failed'})`,
    )
  }
  let key: CryptoKey
  try {
    const der = Buffer.from(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, ''), 'base64')
    key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  } catch {
    throw new ConnectorError(
      PROVIDER,
      'invalid_credentials',
      `Enable Banking private key at ${keyPath} is not an unencrypted PKCS#8 RSA key (expected "-----BEGIN PRIVATE KEY-----")`,
    )
  }
  cachedKeys.set(keyPath, key)
  return key
}

async function jwt(credentials: EnableBankingCredentials) {
  const now = Math.floor(Date.now() / 1000)
  const cached = cachedJwts.get(credentials.appId)
  if (cached && cached.expiresAt - 60 > now) return cached.token
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: credentials.appId }))
  const payload = base64url(
    JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + JWT_LIFETIME_SECONDS }),
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await loadEnableBankingKey(credentials.keyPath),
    Buffer.from(`${header}.${payload}`),
  )
  const token = `${header}.${payload}.${base64url(signature)}`
  cachedJwts.set(credentials.appId, { token, expiresAt: now + JWT_LIFETIME_SECONDS })
  return token
}

/** Error codes (ErrorResponse.error) that mean the user's consent/session is
 * gone and only a new bank authorization fixes it. */
const REAUTH_CODES = new Set([
  'EXPIRED_SESSION',
  'CLOSED_SESSION',
  'REVOKED_SESSION',
  'SESSION_DOES_NOT_EXIST',
  'ASPSP_PSU_ACTION_REQUIRED',
])

function enableBankingErrorKind(status: number, code: string | undefined): ConnectorErrorKind {
  if (code && REAUTH_CODES.has(code)) return 'reauth_required'
  if (code === 'ASPSP_RATE_LIMIT_EXCEEDED' || status === 429) return 'rate_limited'
  if (code === 'ASPSP_ERROR' || code === 'ASPSP_TIMEOUT' || status === 408 || status >= 500) return 'provider_unavailable'
  if (status === 401 || status === 403) return 'invalid_credentials'
  return 'invalid_input'
}

/** Session ids and account uids are credentials-adjacent; keep them out of messages. */
function redactPath(path: string) {
  return path.replace(/^\/(sessions|accounts)\/[^/]+/, '/$1/{id}')
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

type EbErrorResponse = { message?: unknown; error?: unknown; detail?: unknown }

async function call<T>(
  credentials: EnableBankingCredentials,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  assertAllowedEnableBankingCall(method, path)
  const where = `${method} ${redactPath(path)}`
  const url = new URL(path, API_BASE)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  const token = await jwt(credentials)

  let status: number
  let text: string
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    status = response.status
    text = await response.text()
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code
    const reason =
      err instanceof Error && err.name === 'TimeoutError'
        ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        : `network error${typeof code === 'string' ? ` (${code})` : ''}`
    throw new ConnectorError(PROVIDER, 'provider_unavailable', `Enable Banking ${where} failed: ${reason}`)
  }

  const body = parseJson(text)
  if (status < 200 || status >= 300) {
    const error = (typeof body === 'object' && body !== null ? body : {}) as EbErrorResponse
    const code = typeof error.error === 'string' ? error.error : undefined
    const detail =
      body === undefined
        ? text.slice(0, 200)
        : [code, error.message, error.detail].filter((part) => typeof part === 'string' && part).join(': ').slice(0, 300)
    throw new ConnectorError(
      PROVIDER,
      enableBankingErrorKind(status, code),
      `Enable Banking ${where} failed: ${status}${detail ? ` ${detail}` : ''}`,
      { status, providerCode: code },
    )
  }
  if (body === undefined) {
    throw new ConnectorError(PROVIDER, 'bad_response', `Enable Banking ${where} returned a non-JSON body`, { status })
  }
  return body as T
}

// ---------------------------------------------------------------- normalization

function badResponse(message: string) {
  return new ConnectorError(PROVIDER, 'bad_response', message)
}

/** Exact decimal string + ISO 4217 code; anything else is refused, not coerced
 * (Number('') is 0, which would post a zero-value transaction). */
function parseAmount(subject: string, amount: Amount | null | undefined) {
  const raw: unknown = amount?.amount
  if (typeof raw !== 'string' || raw.trim() === '' || !Number.isFinite(Number(raw))) {
    throw badResponse(`${subject} has a non-numeric amount: ${JSON.stringify(raw)}`)
  }
  const currency: unknown = amount?.currency
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw badResponse(`${subject} has no ISO 4217 currency: ${JSON.stringify(currency)}`)
  }
  return { value: Number(raw), currency }
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

/** A normalized booked transaction before its id is assigned. */
export type UnidentifiedEbTransaction = Omit<NormalizedTransaction, 'providerTransactionId'> & {
  entryReference?: string
  fingerprint: string
}

/** Fluide's sign convention: negative = money left the account. */
export function normalizeEnableBankingTransaction(
  tx: EbTransaction,
  accountHash: string,
): UnidentifiedEbTransaction {
  if (tx.credit_debit_indicator !== 'DBIT' && tx.credit_debit_indicator !== 'CRDT') {
    throw badResponse(
      `Enable Banking transaction has an unknown credit_debit_indicator: ${JSON.stringify(tx.credit_debit_indicator)}`,
    )
  }
  const { value, currency } = parseAmount('Enable Banking transaction', tx.transaction_amount)
  const magnitude = Math.abs(value)
  const date = tx.booking_date ?? tx.value_date ?? tx.transaction_date
  if (!date) throw badResponse('Enable Banking transaction has no booking, value or transaction date')
  if (!isIsoDate(date)) throw badResponse(`Enable Banking transaction has an invalid date: ${JSON.stringify(date)}`)

  const counterparty = tx.credit_debit_indicator === 'DBIT' ? tx.creditor?.name : tx.debtor?.name
  const remittance = (tx.remittance_information ?? []).join(' ').trim()
  const description = counterparty?.trim() || remittance || tx.bank_transaction_code?.description || '(no description)'
  const amount = tx.credit_debit_indicator === 'DBIT' ? -magnitude : magnitude

  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        accountHash,
        date,
        tx.transaction_amount.amount,
        tx.transaction_amount.currency,
        tx.credit_debit_indicator,
        remittance,
        tx.balance_after_transaction?.amount ?? null,
      ]),
    )
    .digest('hex')
    .slice(0, 32)

  return {
    accountId: accountHash,
    date,
    description,
    amount,
    currency,
    pending: false,
    providerCategory: tx.merchant_category_code ?? tx.bank_transaction_code?.code ?? undefined,
    entryReference: tx.entry_reference ?? undefined,
    fingerprint,
  }
}

/** Assigns ids: `<accountHash>:<entry_reference>`, else `<accountHash>:h:<fingerprint>`.
 * Identical fingerprints in one fetch (same-day, same-amount, no running
 * balance) get an occurrence suffix instead of being collapsed into one. */
export function assignEnableBankingIds(
  accountHash: string,
  transactions: UnidentifiedEbTransaction[],
): NormalizedTransaction[] {
  const seen = new Map<string, number>()
  return transactions.map(({ entryReference, fingerprint, ...tx }) => {
    if (entryReference) return { ...tx, providerTransactionId: `${accountHash}:${entryReference}` }
    const occurrence = (seen.get(fingerprint) ?? 0) + 1
    seen.set(fingerprint, occurrence)
    const suffix = occurrence > 1 ? `#${occurrence}` : ''
    return { ...tx, providerTransactionId: `${accountHash}:h:${fingerprint}${suffix}`, syntheticId: true }
  })
}

// ---------------------------------------------------------------- session helpers

async function sessionAccounts(credentials: EnableBankingCredentials, sessionId: string) {
  const session = await call<{ accounts_data?: { uid: string; identification_hash: string }[] }>(
    credentials,
    'GET',
    `/sessions/${encodeURIComponent(sessionId)}`,
  )
  return session.accounts_data ?? []
}

async function bookedTransactions(credentials: EnableBankingCredentials, accountUid: string) {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  for (let page = 0; page < MAX_TRANSACTION_PAGES; page++) {
    const result = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      credentials,
      'GET',
      `/accounts/${encodeURIComponent(accountUid)}/transactions`,
      { query: { strategy: 'longest', transaction_status: 'BOOK', continuation_key: continuationKey } },
    )
    all.push(...result.transactions)
    if (!result.continuation_key) return all
    continuationKey = result.continuation_key
  }
  throw badResponse(`Enable Banking returned more than ${MAX_TRANSACTION_PAGES} transaction pages for one account`)
}

// ---------------------------------------------------------------- connector

/** `credentials` are captured in a closure so the returned Connector still
 * matches the provider-agnostic shape (accessToken/cursor only) — ingest.ts
 * never needs to know Enable Banking has app-level credentials at all. */
export function createEnableBankingConnector(credentials: EnableBankingCredentials): Connector {
  return {
    provider: PROVIDER,

    // `accessToken` is the Enable Banking session_id.
    async listAccounts(sessionId) {
      const accounts: NormalizedAccount[] = []
      for (const { uid, identification_hash } of await sessionAccounts(credentials, sessionId)) {
        const details = await call<EbAccount>(credentials, 'GET', `/accounts/${encodeURIComponent(uid)}/details`)
        if (!details.currency) throw badResponse(`Enable Banking account ${identification_hash} has no currency`)
        accounts.push({
          providerAccountId: identification_hash,
          name: details.name ?? details.product ?? details.details ?? 'Bank account',
          type: details.cash_account_type ?? 'OTHR',
          subtype: details.product,
          currency: details.currency,
        })
      }
      return accounts
    },

    // Exact types only: CLBD (booked) -> current, CLAV (available) -> available,
    // null when the bank did not report that type. No fallback guessing (S2-3).
    async getBalances(sessionId) {
      const balances: NormalizedBalance[] = []
      for (const { uid, identification_hash } of await sessionAccounts(credentials, sessionId)) {
        const { balances: raw } = await call<{ balances: EbBalance[] }>(
          credentials,
          'GET',
          `/accounts/${encodeURIComponent(uid)}/balances`,
        )
        const booked = raw.find((b) => b.balance_type === 'CLBD')
        const available = raw.find((b) => b.balance_type === 'CLAV')
        const currency = (booked ?? available ?? raw[0])?.balance_amount.currency
        if (!currency) continue
        balances.push({
          providerAccountId: identification_hash,
          current: booked ? parseAmount('Enable Banking CLBD balance', booked.balance_amount).value : null,
          available: available ? parseAmount('Enable Banking CLAV balance', available.balance_amount).value : null,
          currency,
        })
      }
      return balances
    },

    // Full booked history on every call (strategy=longest); no cursor. Only
    // BOOK transactions are requested, and non-BOOK rows are dropped if a bank
    // returns them anyway.
    async getTransactions(sessionId) {
      const transactions: NormalizedTransaction[] = []
      for (const { uid, identification_hash } of await sessionAccounts(credentials, sessionId)) {
        const booked = (await bookedTransactions(credentials, uid)).filter((tx) => tx.status === 'BOOK')
        transactions.push(
          ...assignEnableBankingIds(
            identification_hash,
            booked.map((tx) => normalizeEnableBankingTransaction(tx, identification_hash)),
          ),
        )
      }
      return { transactions }
    },
  }
}

// ---------------------------------------------------------------- handshake (not part of Connector)

export async function listEnableBankingAspsps(credentials: EnableBankingCredentials, country: string) {
  const result = await call<{ aspsps: EnableBankingAspsp[] }>(credentials, 'GET', '/aspsps', {
    query: { country, psu_type: 'personal', service: 'AIS' },
  })
  return result.aspsps
}

/** Starts bank authorization; the user is sent to the returned url. */
export async function startEnableBankingAuth(
  credentials: EnableBankingCredentials,
  input: {
    aspspName: string
    country: string
    redirectUrl: string
    state: string
    validUntil: Date
  },
) {
  const result = await call<{ url: string; authorization_id: string }>(credentials, 'POST', '/auth', {
    body: {
      access: { valid_until: input.validUntil.toISOString() },
      aspsp: { name: input.aspspName, country: input.country },
      state: input.state,
      redirect_url: input.redirectUrl,
      psu_type: 'personal',
    },
  })
  return result.url
}

/** Exchanges the one-time callback code for a session. */
export async function createEnableBankingSession(credentials: EnableBankingCredentials, code: string) {
  const result = await call<{
    session_id: string
    aspsp: { name: string; country: string }
    access: { valid_until: string }
    accounts: EbAccount[]
  }>(credentials, 'POST', '/sessions', { body: { code } })
  return {
    sessionId: result.session_id,
    aspspName: result.aspsp.name,
    country: result.aspsp.country,
    validUntil: result.access.valid_until,
    accountCount: result.accounts.length,
  }
}
