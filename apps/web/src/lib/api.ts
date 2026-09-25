/** SOURCE OF TRUTH: the web ↔ server wire types and the one fetch wrapper.
 * WHAT: typed shapes for every endpoint apps/web calls, plus getJson/sendJson
 * which turn non-2xx responses into ApiError carrying the server's `error`.
 * WHY: numeric ledger columns arrive as strings and several endpoints are
 * still landing server-side — one wrapper keeps error messages consistent so
 * every view can render a clean error state instead of crashing.
 * WHERE: transport + types only. No caching, no React.
 */

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

export type Summary = {
  period: Period
  incomeVsExpense: { income: number; expense: number; net: number }
  topCategories: { category: string; total: number }[]
  topMerchants: { merchant: string; total: number; count: number }[]
  balances: { name: string; currency: string; balance: number }[]
}

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
