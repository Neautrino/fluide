export function redactKey(message: string, apiKey: string | null): string {
  if (!apiKey) return message
  return message.split(apiKey).join('[key]')
}

type Bag = Record<string, unknown>
const asBag = (value: unknown): Bag | undefined => (value && typeof value === 'object' ? (value as Bag) : undefined)

/** Provider detail from a JSON error body (or its text): error.message | error | message | detail | detail.message (TypeSafe). */
function bodyDetail(body: unknown): string {
  if (typeof body === 'string') {
    try {
      return bodyDetail(JSON.parse(body))
    } catch {
      return ''
    }
  }
  const b = asBag(body)
  if (!b) return ''
  const inner = b.error
  if (typeof inner === 'string') return inner
  const innerBag = asBag(inner)
  if (innerBag) {
    if (typeof innerBag.message === 'string') return innerBag.message
    const nested = bodyDetail(innerBag) // Anthropic SDK: err.error is the whole body {type, error: {message}}
    if (nested) return nested
  }
  if (typeof b.message === 'string') return b.message
  if (typeof b.detail === 'string') return b.detail
  const detailBag = asBag(b.detail)
  if (typeof detailBag?.message === 'string') return detailBag.message
  return ''
}

/** Bun fetch, Node and the OpenAI/Anthropic SDKs (APIConnectionError) all surface a
 * refused/unresolvable host as an error with no HTTP status and a system `code`. */
function isNetworkError(err: Bag, cause: Bag | undefined): boolean {
  if (typeof err.code === 'string' || typeof cause?.code === 'string') return true
  if ((err as object).constructor?.name === 'APIConnectionError') return true
  return typeof err.message === 'string' && /Unable to connect|fetch failed|Error fetching from/.test(err.message)
}

/** The one place a provider failure becomes user-facing text. Always redacts the key. */
export function mapAiError(
  error: unknown,
  endpoint: string,
  apiKey: string | null,
  timeout?: { signal: AbortSignal; seconds: number },
): string {
  const err = asBag(error) ?? {}
  const cause = asBag(err.cause)
  const response = asBag(err.response)
  const rawMessage = typeof err.message === 'string' ? err.message : ''

  let status = typeof err.status === 'number' ? err.status : typeof response?.status === 'number' ? response.status : undefined
  let detail = bodyDetail(response?.json ?? response?.data ?? err.body ?? err.error)
  const bracketed = rawMessage.match(/\[(\d{3})[^\]]*\]\s*(.*)$/s) // Google SDK: "... [403 Forbidden] <detail>"
  if (bracketed) {
    status ??= Number(bracketed[1])
    if (!detail) detail = bracketed[2]?.trim() ?? ''
  }

  let message: string
  if (timeout?.signal.aborted || err.name === 'TimeoutError' || cause?.name === 'TimeoutError') {
    message = `No answer within ${timeout?.seconds ?? 30} s`
  } else if (status) {
    if (status === 401) message = 'Key rejected (401)'
    else if (status === 402) message = 'Out of credit (402)'
    else if (status === 403) message = 'Refused (403)'
    else if (status === 404) message = 'Not found (404): check the endpoint and model'
    else if (status === 429) message = 'Rate limited or out of quota (429)'
    else if (status >= 500 && status < 600) message = `Provider error (${status})`
    else message = `Request rejected (${status})`
    if (detail) message += `: ${detail.slice(0, 200)}`
  } else if (isNetworkError(err, cause)) {
    let host = 'the provider'
    try {
      host = new URL(endpoint).host
    } catch {}
    message = `Can't reach ${host}`
  } else {
    message = (rawMessage || 'Unknown error').slice(0, 200)
  }

  return redactKey(message, apiKey)
}
