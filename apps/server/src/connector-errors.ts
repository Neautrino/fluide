/** SOURCE OF TRUTH: how a failed connector call becomes an HTTP response.
 * WHAT: maps ConnectorError.kind to a status and a fixed, user-readable
 * message; logs the adapter's message (safe fields only, see
 * @repo/connectors' errors.ts). Anything that isn't a ConnectorError stays a
 * generic 500.
 * WHY: apps/web gets only the fixed text per kind — never the provider's
 * message, which can name key paths or provider request details. The kind is
 * what the user can act on: fix Settings, reconnect the bank, or wait.
 * WHERE: owns the kind -> response mapping only. Which provider errors map to
 * which kind lives in each adapter.
 */
import type { Context } from 'hono'
import { ConnectorError, type ConnectorErrorKind } from '@repo/connectors'

const RESPONSES: Record<ConnectorErrorKind, { status: 400 | 409 | 429 | 502; reason: string }> = {
  invalid_credentials: { status: 409, reason: 'the provider rejected the app credentials — check them in Settings' },
  reauth_required: { status: 409, reason: 'the bank connection has expired or was revoked — connect the bank again' },
  rate_limited: { status: 429, reason: 'the provider is rate-limiting requests — try again later' },
  provider_unavailable: { status: 502, reason: 'the provider or bank did not respond — try again later' },
  invalid_input: { status: 400, reason: 'the provider rejected the request' },
  bad_response: { status: 502, reason: 'the provider returned data Fluide could not read' },
}

export function connectorErrorResponse(c: Context, label: string, err: unknown, failure: string) {
  if (err instanceof ConnectorError) {
    console.error(label, `${err.provider}/${err.kind}`, err.message)
    const { status, reason } = RESPONSES[err.kind]
    return c.json({ error: `${failure}: ${reason}` }, status)
  }
  console.error(label, err)
  return c.json({ error: failure }, 500)
}
