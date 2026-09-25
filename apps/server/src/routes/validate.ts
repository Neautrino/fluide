import type { MiddlewareHandler } from 'hono'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

/** Rejects a malformed id with a 400 before the handler runs; without it the
 * id reaches Postgres, which fails the uuid cast and the route returns 500. */
export const uuidParam =
  (name: string): MiddlewareHandler =>
  async (c, next) => {
    if (!isUuid(c.req.param(name))) return c.json({ error: `${name} must be a UUID` }, 400)
    await next()
  }
