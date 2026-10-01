/* SOURCE OF TRUTH: which Host/Origin may reach the API, which writes are refused, what errors expose.
 * Never: add CORS, wildcard the Host allowlist, or put error details/params in a response or log line.
 */
import type { ErrorHandler, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { DrizzleQueryError } from 'drizzle-orm'

const ALWAYS_ALLOWED = new Set(['localhost', '127.0.0.1', '::1'])
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const MAX_LOG_MESSAGE = 200

/** Lowercased hostname of a Host header value, port and IPv6 brackets stripped. */
function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : value.slice(1, end)
  }
  const colon = value.indexOf(':')
  const name = colon === -1 || value.includes(':', colon + 1) ? value : value.slice(0, colon)
  return name.endsWith('.') ? name.slice(0, -1) : name
}

function originHostname(origin: string): string {
  try {
    return hostnameOf(new URL(origin).host)
  } catch {
    return ''
  }
}

export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/')
}

/** Reads FLUIDE_ALLOWED_HOSTS when called, not per request. */
export function httpGuard(): MiddlewareHandler {
  const extra = new Set(
    (process.env.FLUIDE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map(hostnameOf)
      .filter((name) => name !== ''),
  )
  const isAllowed = (name: string) =>
    name !== '' && (ALWAYS_ALLOWED.has(name) || name.endsWith('.localhost') || extra.has(name))

  return async (c, next) => {
    const host = c.req.header('host')?.trim()
    if (!host) return c.json({ error: 'missing host header' }, 400)
    if (!isAllowed(hostnameOf(host))) return c.json({ error: 'misdirected request' }, 421)

    if (WRITE_METHODS.has(c.req.method) && isApiPath(c.req.path)) {
      const site = c.req.header('sec-fetch-site')
      if (site !== undefined && site !== 'same-origin' && site !== 'none') {
        return c.json({ error: 'cross-site request refused' }, 403)
      }
      const origin = c.req.header('origin')
      if (origin !== undefined && !isAllowed(originHostname(origin))) {
        return c.json({ error: 'cross-site request refused' }, 403)
      }
      const contentLength = c.req.header('content-length')
      const hasBody = (contentLength !== undefined && Number(contentLength) > 0) || c.req.header('transfer-encoding') !== undefined
      const mediaType = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
      if (hasBody && mediaType !== 'application/json') {
        return c.json({ error: 'content-type must be application/json' }, 415)
      }
    }
    await next()
  }
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  const requestId = crypto.randomUUID()
  // DrizzleQueryError.message embeds the query's bound params; only its driver cause is safe to log.
  const cause = err instanceof DrizzleQueryError ? err.cause : err
  const message = cause instanceof Error ? `${cause === err ? '' : `${cause.name}: `}${cause.message}` : ''
  const safeMessage = (message.split('\n')[0] ?? '').slice(0, MAX_LOG_MESSAGE)
  console.error(`[${requestId}] ${c.req.method} ${new URL(c.req.url).pathname} ${err.name}: ${safeMessage}`)
  return c.json({ error: 'internal error', requestId }, 500)
}
