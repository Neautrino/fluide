/** SOURCE OF TRUTH: the one Plaid API client for connector-level data calls.
 * WHAT: builds a configured PlaidApi client from PLAID_ENV/PLAID_CLIENT_ID/
 * PLAID_SECRET. Shared by enrollment routes (apps/server) and the
 * data-fetching adapter (plaid.ts, this package).
 * WHY: centralizing construction means there is exactly one place
 * PLAID_SECRET is ever read, regardless of which app touches Plaid.
 * WHERE: owns "how do we talk to Plaid" only. Normalization lives in
 * plaid.ts; enrollment routing lives in apps/server/src/index.ts.
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
