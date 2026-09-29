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

export type AccountKind = 'cash' | 'investment' | 'property' | 'vehicle' | 'crypto' | 'credit' | 'loan' | 'other'

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
  mask: string | null
  subtype: string | null
  officialName: string | null
  excludeFromNetWorth: boolean
  institutionName: string | null
  connectionStatus: ConnectionStatus | null
  lastSyncedAt: string | null
  availableBalance: number | null
  creditLimit: number | null
}

/** Every figure is in `currency`; the other currencies present are never added in. */
export type Summary = {
  period: Period
  currency: string
  /** Currencies with movements in the period, most-used first; the picker's options. */
  currencies: string[]
  /** `expense` = `spending` + `debtPayments`; own-account transfers, card payments and investments are excluded. */
  incomeVsExpense: { income: number; expense: number; net: number; spending: number; debtPayments: number }
  topCategories: { category: string; total: number }[]
  topMerchants: { merchant: string; total: number; count: number }[]
  /** Every account, each in its own currency. */
  balances: AccountBalance[]
  /** Movements left out of cash flow; only kinds with count > 0. `total` is positive; a matched pair counts once. */
  notCounted: { kind: NotCountedKind; count: number; total: number }[]
  otherCurrencies: { currency: string; count: number; moneyIn: number; moneyOut: number }[]
  /** Bank-tagged transfers with no matching leg: still counted in cash flow until the user decides. `total` is positive. */
  possibleTransfers: { count: number; total: number }
}

/** An unpaired bank-tagged transfer awaiting the user's decision. `amount` is signed (negative = money out). */
export type PossibleTransfer = {
  transactionId: string
  date: string
  description: string
  accountName: string
  amount: number
  currency: string
}

/** `mine`: moved to one of the user's own accounts (left out of cash flow); `payment`: real income/spending. */
export type TransferDecision = 'mine' | 'payment'

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

export async function listPossibleTransfers(period: Period, signal?: AbortSignal): Promise<PossibleTransfer[]> {
  const { transactions } = await getJson<{ transactions: PossibleTransfer[] }>(
    `/api/ledger/possible-transfers?period=${period}`,
    signal,
  )
  return transactions
}

export async function decideTransfer(transactionId: string, decision: TransferDecision): Promise<void> {
  await sendJson<{ ok: true }>('POST', `/api/ledger/transfers/${encodeURIComponent(transactionId)}/decision`, { decision })
}

export type CashFlowCompare = 'average' | 'previous' | 'last_year'

/** `change` = (value − baseline) / |baseline|; null when there is no baseline or it is 0. */
export type CashFlowDelta = { baseline: number | null; change: number | null }

export type NotCountedKind = 'between_accounts' | 'card_payoffs' | 'invested' | 'savings'

/** One counted leg behind a cash-flow figure. `amount` is signed (negative = money out). */
export type DrillRow = {
  transactionId: string
  date: string
  description: string
  accountName: string
  amount: number
  currency: string
  category: string
  fromBank: boolean
  pending: boolean
}

/** Amounts are positive magnitudes in `currency` unless noted; currencies are never summed together. */
export type CashFlow = {
  month: string
  currency: string
  currencies: string[]
  partial: boolean
  daysElapsed: number
  daysInMonth: number
  compare: CashFlowCompare
  baselineMonths: number
  accounts: { id: string; name: string; kind: string | null; mask: string | null; connectorId: string | null }[]
  totals: {
    moneyIn: number
    moneyOut: number
    spending: number
    debtPayments: number
    /** Signed. */
    kept: number
    /** 0..1, signed; null when nothing came in. */
    savingsRate: number | null
    invested: number
    movedToSavings: number
    vs: { moneyIn: CashFlowDelta; moneyOut: CashFlowDelta; kept: CashFlowDelta; savingsRate: CashFlowDelta }
  }
  notCounted: { kind: NotCountedKind; count: number; total: number }[]
  otherCurrencies: { currency: string; count: number; moneyIn: number; moneyOut: number }[]
  possibleTransfers: { count: number; total: number }
  sankey: {
    sources: { id: string; label: string; amount: number; kind: 'payer' | 'refunds' | 'other_income' | 'from_balance' }[]
    targets: {
      id: string
      label: string
      amount: number
      group: 'spending' | 'debt' | 'kept'
      kind: 'category' | 'other_categories' | 'debt_payments' | 'invested' | 'savings' | 'stayed_in_cash'
      fromBank?: boolean
      otherCount?: number
    }[]
    moneyIn: number
  }
  transfers: {
    kind: 'invested' | 'savings' | 'card_payoffs' | 'between_accounts' | 'debt_payments'
    total: number
    count: number
    accounts: string[]
  }[]
  months: { month: string; moneyIn: number; moneyOut: number; net: number; partial: boolean }[]
  averages: { moneyIn: number | null; moneyOut: number | null }
  /** Cumulative money out per day; `current` is null after `daysElapsed`. */
  pace: { day: number; current: number | null; baseline: number | null }[]
  categories: {
    label: string
    amount: number
    shareOfSpending: number
    shareOfIncome: number | null
    baseline: number | null
    change: number | null
    fromBank: boolean
  }[]
  merchants: { name: string; amount: number; count: number; average: number; isNew: boolean }[]
  sources: { name: string; amount: number; share: number; regularity: 'monthly' | 'irregular' | null; kind: 'payer' | 'refunds' }[]
  largest: DrillRow[]
}

export type CashFlowParams = { month: string; compare: CashFlowCompare; accounts: string[]; currency: string | null }

/** Filter tokens accepted by `/api/ledger/cashflow/transactions`; the response total equals the figure the page shows. */
export type CashFlowFilter =
  | 'in'
  | 'out'
  | 'spending'
  | 'debt'
  | 'refunds'
  | 'other_income'
  | 'other_categories'
  | 'possible'
  | 'largest'
  | `category:${string}`
  | `merchant:${string}`
  | `source:${string}`
  | `notcounted:${NotCountedKind}`
  | `day:${number}`

function cashFlowQuery(params: CashFlowParams): URLSearchParams {
  const q = new URLSearchParams({ month: params.month })
  if (params.accounts.length > 0) q.set('accounts', params.accounts.join(','))
  if (params.currency) q.set('currency', params.currency)
  return q
}

export function getCashFlow(params: CashFlowParams, signal?: AbortSignal): Promise<CashFlow> {
  const q = cashFlowQuery(params)
  q.set('compare', params.compare)
  return getJson<CashFlow>(`/api/ledger/cashflow?${q}`, signal)
}

export function getCashFlowTransactions(
  params: CashFlowParams,
  filter: CashFlowFilter,
  signal?: AbortSignal,
): Promise<{ rows: DrillRow[]; total: number; count: number }> {
  const q = cashFlowQuery(params)
  q.set('filter', filter)
  return getJson(`/api/ledger/cashflow/transactions?${q}`, signal)
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Something went wrong.'
}
