/** SOURCE OF TRUTH: the Enable Banking (EU PSD2) implementation of the Connector interface.
 * WHAT: signs every API call with an RS256 JWT built from the application's
 * private key, runs the bank-authorization handshake (POST /auth -> bank ->
 * POST /sessions), and normalizes accounts/balances/booked transactions into
 * Fluide's shapes (types.ts).
 * WHY: three Enable Banking rules drive the non-obvious parts (docs/faq):
 * - `transaction_id` "should not be used as a unique reference" (it can change
 *   between fetches); `entry_reference` is the matching key, unique only per
 *   account, and often missing -> key = account hash + entry_reference, else a
 *   content hash flagged as synthetic.
 * - pending (PDNG) items can change or vanish before booking and postings are
 *   immutable, so only BOOK transactions leave this file.
 * - account `uid` is per session; `identification_hash` is stable across
 *   sessions, so it is the providerAccountId (re-consent must not fork accounts).
 * Sandbox applications get payment initiation switched on automatically; the
 * ALLOWED_CALLS list makes any non-read endpoint throw before a request is
 * sent (PLAN.md principle #1: read-only forever).
 * WHERE: owns Enable Banking HTTP + translation only. The private key and
 * session_id never leave the server (AGENTS.md); where session ids are
 * stored is apps/server's connection-store.ts. Balance-type fallback
 * (CLBD->ITBD->CLAV->ITAV->XPCD, flagged) is deliberately NOT here yet (S2-3).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Connector, NormalizedAccount, NormalizedBalance, NormalizedTransaction } from './types.js'

const API_BASE = 'https://api.enablebanking.com'
const JWT_LIFETIME_SECONDS = 3600
const MAX_TRANSACTION_PAGES = 500

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

let cachedKey: CryptoKey | undefined
let cachedJwt: { token: string; expiresAt: number } | undefined

function config() {
  const appId = process.env.ENABLE_BANKING_APP_ID
  const keyPath = process.env.ENABLE_BANKING_KEY_PATH
  if (!appId || !keyPath) {
    throw new Error('ENABLE_BANKING_APP_ID and ENABLE_BANKING_KEY_PATH must be set to use Enable Banking')
  }
  return { appId, keyPath }
}

function base64url(input: string | ArrayBuffer) {
  return Buffer.from(typeof input === 'string' ? Buffer.from(input) : new Uint8Array(input)).toString('base64url')
}

async function signingKey(keyPath: string) {
  if (cachedKey) return cachedKey
  const pem = readFileSync(keyPath, 'utf-8')
  const der = Buffer.from(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, ''), 'base64')
  cachedKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return cachedKey
}

async function jwt() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt && cachedJwt.expiresAt - 60 > now) return cachedJwt.token
  const { appId, keyPath } = config()
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }))
  const payload = base64url(
    JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + JWT_LIFETIME_SECONDS }),
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await signingKey(keyPath),
    Buffer.from(`${header}.${payload}`),
  )
  cachedJwt = { token: `${header}.${payload}.${base64url(signature)}`, expiresAt: now + JWT_LIFETIME_SECONDS }
  return cachedJwt.token
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  assertAllowedEnableBankingCall(method, path)
  const url = new URL(path, API_BASE)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await jwt()}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Enable Banking ${method} ${path} failed: ${response.status} ${detail.slice(0, 300)}`)
  }
  return (await response.json()) as T
}

// ---------------------------------------------------------------- normalization

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
  const magnitude = Math.abs(Number(tx.transaction_amount.amount))
  if (!Number.isFinite(magnitude)) {
    throw new Error(`Enable Banking transaction has a non-numeric amount: ${tx.transaction_amount.amount}`)
  }
  const date = tx.booking_date ?? tx.value_date ?? tx.transaction_date
  if (!date) throw new Error('Enable Banking transaction has no booking, value or transaction date')

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
    currency: tx.transaction_amount.currency,
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

async function sessionAccounts(sessionId: string) {
  const session = await call<{ accounts_data?: { uid: string; identification_hash: string }[] }>(
    'GET',
    `/sessions/${encodeURIComponent(sessionId)}`,
  )
  return session.accounts_data ?? []
}

async function bookedTransactions(accountUid: string) {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  for (let page = 0; page < MAX_TRANSACTION_PAGES; page++) {
    const result = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      'GET',
      `/accounts/${encodeURIComponent(accountUid)}/transactions`,
      { query: { strategy: 'longest', transaction_status: 'BOOK', continuation_key: continuationKey } },
    )
    all.push(...result.transactions)
    if (!result.continuation_key) return all
    continuationKey = result.continuation_key
  }
  throw new Error(`Enable Banking returned more than ${MAX_TRANSACTION_PAGES} transaction pages for one account`)
}

// ---------------------------------------------------------------- connector

export const enableBankingConnector: Connector = {
  provider: 'enable-banking',

  // `accessToken` is the Enable Banking session_id.
  async listAccounts(sessionId) {
    const accounts: NormalizedAccount[] = []
    for (const { uid, identification_hash } of await sessionAccounts(sessionId)) {
      const details = await call<EbAccount>('GET', `/accounts/${encodeURIComponent(uid)}/details`)
      if (!details.currency) throw new Error(`Enable Banking account ${uid} has no currency`)
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
    for (const { uid, identification_hash } of await sessionAccounts(sessionId)) {
      const { balances: raw } = await call<{ balances: EbBalance[] }>(
        'GET',
        `/accounts/${encodeURIComponent(uid)}/balances`,
      )
      const booked = raw.find((b) => b.balance_type === 'CLBD')
      const available = raw.find((b) => b.balance_type === 'CLAV')
      const currency = (booked ?? available ?? raw[0])?.balance_amount.currency
      if (!currency) continue
      balances.push({
        providerAccountId: identification_hash,
        current: booked ? Number(booked.balance_amount.amount) : null,
        available: available ? Number(available.balance_amount.amount) : null,
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
    for (const { uid, identification_hash } of await sessionAccounts(sessionId)) {
      const booked = (await bookedTransactions(uid)).filter((tx) => tx.status === 'BOOK')
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

// ---------------------------------------------------------------- handshake (not part of Connector)

export async function listEnableBankingAspsps(country: string) {
  const result = await call<{ aspsps: EnableBankingAspsp[] }>('GET', '/aspsps', {
    query: { country, psu_type: 'personal', service: 'AIS' },
  })
  return result.aspsps
}

/** Starts bank authorization; the user is sent to the returned url. */
export async function startEnableBankingAuth(input: {
  aspspName: string
  country: string
  redirectUrl: string
  state: string
  validUntil: Date
}) {
  const result = await call<{ url: string; authorization_id: string }>('POST', '/auth', {
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
export async function createEnableBankingSession(code: string) {
  const result = await call<{
    session_id: string
    aspsp: { name: string; country: string }
    access: { valid_until: string }
    accounts: EbAccount[]
  }>('POST', '/sessions', { body: { code } })
  return {
    sessionId: result.session_id,
    aspspName: result.aspsp.name,
    country: result.aspsp.country,
    validUntil: result.access.valid_until,
    accountCount: result.accounts.length,
  }
}
