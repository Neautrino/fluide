/* SOURCE OF TRUTH: the one error type every connector adapter throws.
 * Invariant: message built from safe fields only, no `cause`. Enforced by: test/plaid.test.ts (expectNoSecrets), test/enable-banking-http.test.ts.
 * Never: attach the SDK/HTTP error (a Plaid AxiosError holds PLAID-SECRET and the access_token).
 * See: ADR 012 — the kinds and the provider -> kind mapping
 */

export type ConnectorErrorKind =
  | 'invalid_credentials'
  | 'reauth_required'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'invalid_input'
  | 'bad_response'

export class ConnectorError extends Error {
  override readonly name = 'ConnectorError'

  constructor(
    readonly provider: string,
    readonly kind: ConnectorErrorKind,
    message: string,
    readonly details: { status?: number; providerCode?: string } = {},
  ) {
    super(message)
  }
}
