import type {
  CashFlow,
  CashFlowFilter,
  CashFlowParams,
  ChatThread,
  ChatThreadSummary,
  DrillRow,
  DuplicateLink,
  GeneralSettings,
  Period,
  PossibleTransfer,
  TransferDecision,
  VersionInfo,
} from '@repo/ui/types'

/** The wire shapes live in @repo/ui/types, next to the components that read them; this module is where app code reaches them. */
export type * from '@repo/ui/types'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function duplicateLinkOf(error: unknown): DuplicateLink | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const duplicate = (error.body as { duplicateOf?: DuplicateLink } | undefined)?.duplicateOf
  return duplicate?.logins?.length ? duplicate : null
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
    throw new ApiError(res.status, serverMessage ?? fallback, body)
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
  method: 'POST' | 'PUT' | 'DELETE',
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

export function getGeneralSettings(signal?: AbortSignal): Promise<GeneralSettings> {
  return getJson<{ settings: GeneralSettings }>('/api/settings/general', signal).then((r) => r.settings)
}

export function putGeneralSettings(settings: GeneralSettings): Promise<GeneralSettings> {
  return sendJson<{ settings: GeneralSettings }>('PUT', '/api/settings/general', settings).then((r) => r.settings)
}

export function getVersionInfo(signal?: AbortSignal): Promise<VersionInfo> {
  return getJson<VersionInfo>('/api/settings/version', signal)
}

export async function listPossibleTransfers(period: Period, currency: string, signal?: AbortSignal): Promise<PossibleTransfer[]> {
  const { transactions } = await getJson<{ transactions: PossibleTransfer[] }>(
    `/api/ledger/possible-transfers?period=${period}&currency=${encodeURIComponent(currency)}`,
    signal,
  )
  return transactions
}

export async function decideTransfer(transactionId: string, decision: TransferDecision): Promise<void> {
  await sendJson<{ ok: true }>('POST', `/api/ledger/transfers/${encodeURIComponent(transactionId)}/decision`, { decision })
}

export async function listChatThreads(signal?: AbortSignal): Promise<ChatThreadSummary[]> {
  const { threads } = await getJson<{ threads: ChatThreadSummary[] }>('/api/assistant/threads', signal)
  return threads
}

export async function getChatThread(id: string): Promise<ChatThread> {
  const { thread } = await getJson<{ thread: ChatThread }>(`/api/assistant/threads/${encodeURIComponent(id)}`)
  return thread
}

export async function deleteChatThread(id: string): Promise<void> {
  await sendJson<{ ok: true }>('DELETE', `/api/assistant/threads/${encodeURIComponent(id)}`)
}

export async function deleteAllChatThreads(): Promise<void> {
  await sendJson<{ ok: true; deleted: number }>('DELETE', '/api/assistant/threads')
}

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
