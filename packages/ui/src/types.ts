/* The shapes the Fluide server sends. Components in this package read them; the fetch layer that
   produces them lives in the consuming app (apps/web/src/lib/api.ts). */

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
  /** false = the row belongs to a replaced login and the successor already counts it. */
  countsTowardTotals: boolean
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
  amountRangeTolerance: number
  updatedAt: string | null
}

export type GeneralSettings = { displayCurrency: string }

export type VersionInfo = {
  current: string
  checkEnabled: boolean
  latest: { version: string; url: string; publishedAt: string | null } | null
  updateAvailable: boolean
  status: 'ok' | 'no-release' | 'unavailable' | 'disabled'
  checkedAt: string | null
}

export type ProviderCredentialsStatus = { configured: boolean; updatedAt?: string }

export type Period = 'this_week' | 'this_month' | 'last_month' | 'last_30_days' | 'this_year' | 'last_year' | 'all_time'

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
  /** false = its login was disconnected or replaced, or the user excluded it: never added into a total. */
  countsTowardTotals: boolean
  replacedByConnectorId: string | null
  countedUntil: string | null
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

/** Every unpaired transfer in one currency; currencies are never summed together. */
export type TransferGroup = { currency: string; rows: PossibleTransfer[] }

/** The ledger account a review item's posting belongs to. */
export type PostingAccount = { accountId: string; name: string }

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
  replacedByConnectorId: string | null
  /** A replaced login's history counts up to this date; the successor covers the rest. */
  countedUntil: string | null
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

/** The logins the tenant already has at the bank a new link landed on; the
 * server refused to ingest it until the user says which of the three cases it is. */
export type DuplicateLink = {
  institutionName: string | null
  logins: { id: string; institutionName: string | null; status: ConnectionStatus; lastSyncedAt: string | null; createdAt: string }[]
}

export type AiRole = 'categorization' | 'chat'
export type AiProvider = 'typesafe' | 'opencode' | 'openrouter' | 'jev-custom' | 'openai' | 'anthropic' | 'gemini' | 'openai-compatible'

export type AiPreset = {
  role: AiRole
  provider: AiProvider
  label: string
  endpoint: string
  defaultModel: string
  keyRequired: boolean
  keyHint: string
  keyUrl: string | null
  endpointChoices?: { label: string; endpoint: string }[]
  note?: string
}

export type AiRoleStatus = {
  provider: AiProvider
  endpoint: string
  model: string
  credentialId: string | null
  updatedAt: string
  lastTest: { ok: boolean; at: string; message: string } | null
}

export type AiCredentialStatus = {
  id: string
  provider: AiProvider
  label: string
  updatedAt: string
  usedBy: AiRole[]
}

export type AiState = {
  presets: AiPreset[]
  sends: Record<AiRole, string>
  roles: { categorization: AiRoleStatus | null; chat: AiRoleStatus | null }
  credentials: AiCredentialStatus[]
}

export type AiKeyChoice =
  | { use: 'existing'; credentialId: string }
  | { use: 'new'; apiKey: string }
  | { use: 'replace'; credentialId: string; apiKey: string }
  | { use: 'none' }

export type AiDraft = {
  provider: AiProvider
  endpoint: string
  model: string
  key: AiKeyChoice
}

export type AiTestResult = {
  ok: boolean
  message: string
  latencyMs: number | null
}

/** A saved assistant conversation; `questions` counts the user's messages in it. */
export type ChatThreadSummary = { id: string; title: string; updatedAt: string; questions: number }

export type ChatThread = {
  id: string
  title: string
  messages: { role: 'user' | 'assistant'; content: string; at: string }[]
}

export type ChatReply = { answer: string; thread: { id: string; title: string } }

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
