/** SOURCE OF TRUTH: the one Postgres connection for the ledger.
 * WHAT: builds a drizzle client from DATABASE_URL, wired to schema.ts.
 * WHY: every service that touches the ledger imports `db` from here rather
 * than opening its own connection — one pool, one place connection config
 * (SSL, max connections, etc.) ever changes.
 * WHERE: owns "how do we talk to Postgres." Table shape lives in schema.ts,
 * guardrail SQL lives in migrations/, read queries live in queries.ts —
 * this file is deliberately thin.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. packages/ledger refuses to silently default to a ' +
      'connection string — set it explicitly (see docker-compose.yml for local dev).',
  )
}

const client = postgres(connectionString)
export const db = drizzle(client, { schema })
