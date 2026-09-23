/** SOURCE OF TRUTH: the one Plaid API client instance for this server.
 * WHAT: builds a configured PlaidApi client from PLAID_ENV/PLAID_CLIENT_ID/
 * PLAID_SECRET (apps/server/.env — never read directly by any other file).
 * WHY: client_id/secret authenticate this *deployment* to Plaid, not any one
 * user — same shape as Teller's mTLS cert being app-level, not per-connection
 * (see PLAN.md connector research). Centralizing construction here means
 * there is exactly one place that ever touches PLAID_SECRET.
 * WHERE: this module owns "how do we talk to Plaid." It does not own token
 * storage (plaid-store.ts) or routing (index.ts) — import plaidClient,
 * never re-instantiate PlaidApi/Configuration elsewhere.
 */
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

const env = process.env.PLAID_ENV ?? 'sandbox'

const basePath =
  env === 'production'
    ? PlaidEnvironments.production
    : env === 'development'
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox

const configuration = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
      'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
    },
  },
})

export const plaidClient = new PlaidApi(configuration)
