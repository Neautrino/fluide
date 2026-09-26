import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. packages/ledger refuses to silently default to a ' +
      'connection string — set it explicitly (see docker-compose.yml for local dev).',
  )
}

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

/** Either the pool or an open transaction handle. Write helpers that must
 * commit together with other writes (e.g. a category change + its audit_log
 * row) take this, so the caller decides the transaction boundary. */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
