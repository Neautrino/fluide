/* SOURCE OF TRUTH: the connectors table (per-connection Plaid access_token / EB session_id).
 * Invariant: the token is vault.ts ciphertext bound to `${tenantId}:${provider}:${id}`; never a plain column.
 * Never: return a credential to apps/web or an LLM tool call.
 * See: ADR 017 — why connection tokens live in Postgres, not a file
 */
import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { db, connectors, type ConnectorProvider } from '@repo/ledger'
import { encrypt, decrypt } from './vault.js'

export type Connection = {
  id: string
  provider: ConnectorProvider
  credential: string
  externalId?: string
  institutionName?: string
  cursor?: string
  validUntil?: Date
  createdAt: Date
}

export type NewConnection = {
  provider: ConnectorProvider
  credential: string
  externalId?: string
  institutionName?: string
  validUntil?: string
  createdAt?: Date
}

function aad(tenantId: string, provider: ConnectorProvider, id: string) {
  return `${tenantId}:${provider}:${id}`
}

function parseTimestamp(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`invalid timestamp: ${value}`)
  return date
}

/** Encrypts the token and inserts the row; returns the new connection id. */
export async function saveConnection(tenantId: string, connection: NewConnection): Promise<string> {
  const id = randomUUID()
  const { ciphertext, nonce } = encrypt(connection.credential, aad(tenantId, connection.provider, id))
  await db.insert(connectors).values({
    id,
    tenantId,
    provider: connection.provider,
    externalId: connection.externalId,
    institutionName: connection.institutionName,
    credentialCiphertext: ciphertext,
    credentialNonce: nonce,
    validUntil: connection.validUntil ? parseTimestamp(connection.validUntil) : undefined,
    createdAt: connection.createdAt,
  })
  return id
}

export async function listConnections(tenantId: string, provider?: ConnectorProvider): Promise<Connection[]> {
  const rows = await db
    .select()
    .from(connectors)
    .where(
      and(
        eq(connectors.tenantId, tenantId),
        ne(connectors.status, 'disconnected'),
        provider ? eq(connectors.provider, provider) : undefined,
      ),
    )
    .orderBy(connectors.createdAt)
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    credential: decrypt({ ciphertext: row.credentialCiphertext!, nonce: row.credentialNonce! }, aad(tenantId, row.provider, row.id)),
    externalId: row.externalId ?? undefined,
    institutionName: row.institutionName ?? undefined,
    cursor: row.cursor ?? undefined,
    validUntil: row.validUntil ?? undefined,
    createdAt: row.createdAt,
  }))
}

export async function updateConnectionCursor(tenantId: string, id: string, cursor: string) {
  await db
    .update(connectors)
    .set({ cursor })
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)))
}
