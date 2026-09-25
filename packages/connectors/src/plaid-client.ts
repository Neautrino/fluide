/** SOURCE OF TRUTH: builds a Plaid API client from explicit credentials.
 * WHAT: createPlaidClient({clientId, secret}) -> PlaidApi. PLAID_ENV
 * (sandbox/development/production) still selects the base path — that's
 * an environment choice, not a secret, so it stays an env var.
 * WHY: client_id/secret are entered via the Settings screen and stored
 * encrypted (apps/server's provider-credentials.ts + vault.ts), not in
 * process.env anymore. This file never reads them from the environment,
 * so there is exactly one place a caller supplies them.
 * WHERE: owns "how do we build a Plaid client" only. Which credentials to
 * use, and where they come from, is apps/server's job.
 */
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

export type PlaidCredentials = { clientId: string; secret: string }

const env = process.env.PLAID_ENV ?? 'sandbox'

const basePath =
  env === 'production'
    ? PlaidEnvironments.production
    : env === 'development'
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox

export function createPlaidClient(credentials: PlaidCredentials): PlaidApi {
  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': credentials.clientId,
          'PLAID-SECRET': credentials.secret,
        },
      },
    }),
  )
}
