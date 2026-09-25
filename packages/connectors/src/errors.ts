/** SOURCE OF TRUTH: how a connector call fails — the one error type every
 * adapter throws for provider, network, credential and bad-data failures.
 * WHAT: ConnectorError carries a provider-agnostic `kind` (what the caller
 * should do about it), the HTTP status and the provider's own error code
 * when there is one, and a message built only from safe fields.
 * WHY: SDK/HTTP errors carry secrets — a Plaid AxiosError holds the
 * PLAID-SECRET header and the access_token request body — and each provider
 * reports "re-authorize", "rate limited" or "down" differently. Adapters
 * translate at the boundary and never attach the original error as `cause`,
 * so nothing secret can reach a log or apps/web through this type.
 * WHERE: owns the error shape only. Which provider codes map to which kind
 * lives in each adapter; which HTTP status a kind becomes is apps/server's job.
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
