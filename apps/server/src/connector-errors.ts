/* SOURCE OF TRUTH: ConnectorError.kind -> HTTP status + fixed user-facing message.
 * Never: put the adapter's error message in a response body; it is logged only.
 * See: ADR 012 — kind -> status table
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

/** The connection status and user-facing reason a failed sync leaves behind. */
export function connectorFailure(label: string, err: unknown): { status: 'reauth_required' | 'error'; reason: string } {
  if (err instanceof ConnectorError) {
    console.error(label, `${err.provider}/${err.kind}`, err.message)
    return { status: err.kind === 'reauth_required' ? 'reauth_required' : 'error', reason: RESPONSES[err.kind].reason }
  }
  console.error(label, err)
  return { status: 'error', reason: 'unexpected server error — see the server log' }
}
