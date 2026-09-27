export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity'

export type Account = {
  id: string
  tenantId: string
  type: AccountType
  name: string
  path: string
  currency: string
  externalRef: string | null
  openedAt: string | null
  closedAt: string | null
}

export type LedgerRow = {
  id: string
  date: string
  description: string
  status: string
  posting: {
    id?: string
    accountId: string
    amount: string
    currency: string
    categoryId: string | null
    counterpartyRaw?: string | null
  }
  account?: { name: string; type: AccountType }
  category: { label: string | null; detailed: string | null } | null
}

export type Category = {
  id: string
  tenantId: string | null
  primary: string
  detailed: string
  label: string
  isSystem: boolean
  createdAt: string
}

export type AuditAction = 'auto_applied' | 'queued_for_review' | 'approved' | 'rejected' | 'recategorized'

export type AuditEntry = {
  id: string
  postingId: string
  action: AuditAction
  categoryId: string | null
  source: string | null
  confidence: string | null
  reason: string | null
  actor: 'system' | 'human'
  createdAt: string
}

export type ConfidenceBand = 'high' | 'medium' | 'low'

export type ReviewItem = {
  id: string
  postingId: string
  suggestedCategoryId: string | null
  confidenceBand: ConfidenceBand
  source: string
  confidence: string
  reason: string
  status: string
  createdAt: string
  posting?: {
    amount: string
    currency: string
    counterpartyRaw: string | null
    description: string | null
    date: string
  }
}

export type RuleStatus = 'proposed' | 'active' | 'rejected'

export type Rule = {
  id: string
  tenantId: string
  pattern: string
  categoryId: string
  isUserCustom: boolean
  confidenceLearned: string | null
  timesMatched: number
  status: RuleStatus
  createdAt: string
  updatedAt: string
}

export type GateSettings = {
  highConfidence: number
  lowConfidence: number
  minVendorOccurrences: number
  amountRangeTolerance: number
  updatedAt: string | null
}

export type ProviderCredentialsStatus = { configured: boolean; updatedAt?: string }

export type Period = 'this_week' | 'this_month' | 'last_30_days' | 'this_year' | 'all_time'

export type AccountKind = 'cash' | 'investment' | 'credit' | 'loan' | 'other'

export type AccountBalance = {
  id: string
  name: string
  currency: string
  kind: AccountKind | null
  /** null = unknown: no bank balance and no opening-balance anchor. */
  balance: number | null
  bankBalance: number | null
  bankBalanceAt: string | null
  bankBalanceIsFallback: boolean
  ledgerBalance: number
  pendingBalance: number
  bankCountsPending: boolean | null
  mismatch: boolean
}

export type Summary = {
  period: Period
  incomeVsExpense: { income: number; expense: number; net: number }
  topCategories: { category: string; total: number }[]
  topMerchants: { merchant: string; total: number; count: number }[]
  balances: AccountBalance[]
}

export type ConnectionStatus = 'active' | 'reauth_required' | 'error' | 'disconnected'

export type ConnectionSummary = {
  id: string
  provider: 'plaid' | 'enable-banking'
  institutionName: string | null
  status: ConnectionStatus
  statusReason: string | null
  statusChangedAt: string
  lastSyncedAt: string | null
  validUntil: string | null
  createdAt: string
  accounts: { name: string; mask: string | null; kind: AccountKind | null }[]
}

export type BalanceFlag = {
  account: string
  issue: 'no_bank_balance' | 'fallback_type' | 'currency_mismatch' | 'history_pending' | 'no_transactions' | 'pending_rows'
  providerBalanceType?: string
}

export type IngestResult = {
  accountsSeen: number
  unclassifiedAccounts: string[]
  balanceFlags: BalanceFlag[]
  transactionsInserted: number
  transactionsSkipped: number
  transactionsUnknownAccount: number
  transactionsVoided: number
  transactionsUpdated: number
}

/** `background`: an Enable Banking fetch without the user's PSU headers, which many banks allow about 4 times a day. */
export type BankFetch = 'user-present' | 'background'

export type SyncOutcome =
  | { connectionId: string; institutionName: string | null; ok: true; ingest: IngestResult; bankFetch?: BankFetch }
  | { connectionId: string; institutionName: string | null; ok: false; status: 'reauth_required' | 'error'; error: string }

export type CategorizeResult = {
  checked: number
  categorized: number
  queuedForReview: number
  uncategorized: number
  byTier: { rule: number; jev: number }
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown = undefined
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }
  if (!res.ok) {
    const serverMessage =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : null
    const fallback =
      res.status === 404
        ? 'This endpoint is not available on the server (404).'
        : `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ''}).`
    throw new ApiError(res.status, serverMessage ?? fallback)
  }
  if (body === undefined) throw new ApiError(res.status, 'The server returned an unreadable response.')
  return body as T
}

/** Default request deadline: a hung server shows an error state instead of spinning forever. */
export const DEFAULT_TIMEOUT_MS = 15_000

async function request(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const deadline = AbortSignal.timeout(timeoutMs)
  try {
    return await fetch(path, { ...init, signal: signal ? AbortSignal.any([signal, deadline]) : deadline })
  } catch (e) {
    // The caller's own abort (unmount, superseded request) propagates untouched.
    if (signal?.aborted) throw e
    if (deadline.aborted) {
      throw new ApiError(0, `The server didn't respond within ${Math.round(timeoutMs / 1000)} seconds.`)
    }
    throw new ApiError(0, 'Could not reach the Fluide server.')
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return parse<T>(await request(path, {}, timeoutMs, signal))
}

export async function sendJson<T>(
  method: 'POST' | 'PUT',
  path: string,
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  return parse<T>(await request(path, init, timeoutMs))
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Something went wrong.'
}
