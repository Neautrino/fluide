/* SOURCE OF TRUTH: the fluide_app login role and its privileges (DML on public, no DDL).
 * Never: give fluide_app ownership, CREATE, or a role attribute beyond LOGIN.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { secretEnv } from './env.js'

const APP_ROLE = 'fluide_app'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('migrate: DATABASE_URL is not set')
  process.exit(1)
}

const password = secretEnv('DATABASE_PASSWORD')
const client = postgres(connectionString, { max: 1, onnotice: () => {}, ...(password ? { password } : {}) })

async function setUpAppRole(rolePassword: string) {
  await client.begin(async (tx) => {
    const role = tx(APP_ROLE)
    const [existing] = await tx`SELECT 1 FROM pg_roles WHERE rolname = ${APP_ROLE}`
    if (!existing) await tx`CREATE ROLE ${role}`
    const [ddl] = await tx<{ alterRole: string; grantConnect: string }[]>`
      SELECT
        format(
          'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
          ${APP_ROLE}::text, ${rolePassword}::text
        ) AS "alterRole",
        format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), ${APP_ROLE}::text) AS "grantConnect"`
    await tx.unsafe(ddl!.alterRole)
    await tx.unsafe(ddl!.grantConnect)
    await tx`GRANT USAGE ON SCHEMA public TO ${role}`
    await tx`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`
    await tx`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`
    await tx`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
    await tx`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`
  })
}

try {
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
  console.log('migrate: migrations applied')
  const rolePasswordFile = process.env.FLUIDE_APP_ROLE_PASSWORD_FILE
  if (rolePasswordFile) {
    const rolePassword = readFileSync(rolePasswordFile, 'utf8').trimEnd()
    if (!rolePassword) throw new Error('FLUIDE_APP_ROLE_PASSWORD_FILE is empty')
    await setUpAppRole(rolePassword)
    console.log(`migrate: role ${APP_ROLE} ready`)
  }
  await client.end()
} catch (err) {
  const firstLine = (e: unknown) => (e instanceof Error ? e.message.split('\n')[0] : String(e))
  const cause = err instanceof Error && err.cause !== undefined ? ` (${firstLine(err.cause)})` : ''
  console.error(`migrate: failed: ${firstLine(err)}${cause}`)
  await client.end({ timeout: 1 })
  process.exit(1)
}
