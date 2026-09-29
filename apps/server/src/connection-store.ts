/* SOURCE OF TRUTH: the connectors table (per-connection Plaid access_token / EB session_id).
 * Invariant: the token is vault.ts ciphertext bound to `${tenantId}:${provider}:${id}`; never a plain column.
 * Never: return a credential to apps/web or an LLM tool call.
 * See: ADR 017 — why connection tokens live in Postgres, not a file
 */
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, ne, notExists, sql } from 'drizzle-orm'
import { db, accounts, connectors, type AccountKind, type ConnectorProvider, type ConnectorStatus } from '@repo/ledger'
import { encrypt, decrypt } from './vault.js'

export type Connection = {
  id: string
  provider: ConnectorProvider
  credential: string
  externalId?: string
  /** Plaid institution_id, or `<country>:<ASPSP name>` for Enable Banking. */
  institutionId?: string
  institutionName?: string
  cursor?: string
  validUntil?: Date
  createdAt: Date
}

export type NewConnection = {
  provider: ConnectorProvider
  credential: string
  externalId?: string
  institutionId?: string
  institutionName?: string
  validUntil?: string
  createdAt?: Date
}

/** What apps/web may see about a connection: never the credential. */

/** What the web is offered when a link would create a second login at a bank
 * the tenant already has: never the credential. */
export type LoginAtInstitution = {
  id: string
  institutionName: string | null
  status: ConnectorStatus
  lastSyncedAt: string | null
  createdAt: string
}

export type ConnectionSummary = {
  id: string
  provider: ConnectorProvider
  institutionName: string | null
  status: ConnectorStatus
  statusReason: string | null
  statusChangedAt: string
  lastSyncedAt: string | null
  validUntil: string | null
  createdAt: string
  accounts: { name: string; mask: string | null; kind: AccountKind | null }[]
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
    institutionId: connection.institutionId,
    institutionName: connection.institutionName,
    credentialCiphertext: ciphertext,
    credentialNonce: nonce,
    validUntil: connection.validUntil ? parseTimestamp(connection.validUntil) : undefined,
    createdAt: connection.createdAt,
  })
  return id
}

function toConnection(tenantId: string, row: typeof connectors.$inferSelect): Connection {
  return {
    id: row.id,
    provider: row.provider,
    credential: decrypt({ ciphertext: row.credentialCiphertext!, nonce: row.credentialNonce! }, aad(tenantId, row.provider, row.id)),
    externalId: row.externalId ?? undefined,
    institutionId: row.institutionId ?? undefined,
    institutionName: row.institutionName ?? undefined,
    cursor: row.cursor ?? undefined,
    validUntil: row.validUntil ?? undefined,
    createdAt: row.createdAt,
  }
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
  return rows.map((row) => toConnection(tenantId, row))
}

/** A connection that still holds a credential; undefined once disconnected. */
export async function getConnection(tenantId: string, id: string): Promise<Connection | undefined> {
  const [row] = await db
    .select()
    .from(connectors)
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id), ne(connectors.status, 'disconnected')))
  return row ? toConnection(tenantId, row) : undefined
}

export async function listConnectionSummaries(tenantId: string): Promise<ConnectionSummary[]> {
  const rows = await db
    .select({
      id: connectors.id,
      provider: connectors.provider,
      institutionName: connectors.institutionName,
      status: connectors.status,
      statusReason: connectors.statusReason,
      statusChangedAt: connectors.statusChangedAt,
      lastSyncedAt: connectors.lastSyncedAt,
      validUntil: connectors.validUntil,
      createdAt: connectors.createdAt,
    })
    .from(connectors)
    .where(eq(connectors.tenantId, tenantId))
    .orderBy(connectors.createdAt)
  const linked = rows.length
    ? await db
        .select({ connectorId: accounts.connectorId, name: accounts.name, mask: accounts.mask, kind: accounts.kind })
        .from(accounts)
        .where(inArray(accounts.connectorId, rows.map((r) => r.id)))
        .orderBy(accounts.name)
    : []
  return rows.map((r) => ({
    ...r,
    statusChangedAt: r.statusChangedAt.toISOString(),
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    validUntil: r.validUntil?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    accounts: linked.filter((a) => a.connectorId === r.id).map(({ name, mask, kind }) => ({ name, mask, kind })),
  }))
}

export async function updateConnectionCursor(tenantId: string, id: string, cursor: string) {
  await db
    .update(connectors)
    .set({ cursor })
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)))
}

export async function setConnectionInstitution(
  tenantId: string,
  id: string,
  institution: { institutionId: string | null; institutionName: string | null },
) {
  await db
    .update(connectors)
    .set(institution)
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)))
}

/** A successful sync sets last_synced_at and makes the connection active again. */
export async function recordConnectionStatus(
  tenantId: string,
  id: string,
  outcome: { status: 'active' } | { status: 'reauth_required' | 'error'; reason: string },
) {
  await db
    .update(connectors)
    .set({
      status: outcome.status,
      statusReason: outcome.status === 'active' ? null : outcome.reason,
      statusChangedAt: sql`case when ${connectors.status} = ${outcome.status}::connector_status then ${connectors.statusChangedAt} else now() end`,
      ...(outcome.status === 'active' ? { lastSyncedAt: new Date() } : {}),
    })
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id), ne(connectors.status, 'disconnected')))
}

/** Drops the credential for good; the connection's accounts and ledger history stay. */

/** Every login at one institution that has not itself been replaced, whatever
 * its status — matched on the provider's institution id only, never on a bank
 * name. A login already replaced by another one is never offered again: making
 * it a predecessor a second time would leave its first successor counting in
 * full. */
export async function listLoginsAtInstitution(
  tenantId: string,
  provider: ConnectorProvider,
  institutionId: string,
): Promise<LoginAtInstitution[]> {
  const rows = await db
    .select({
      id: connectors.id,
      institutionName: connectors.institutionName,
      status: connectors.status,
      lastSyncedAt: connectors.lastSyncedAt,
      createdAt: connectors.createdAt,
    })
    .from(connectors)
    .where(
      and(
        eq(connectors.tenantId, tenantId),
        eq(connectors.provider, provider),
        eq(connectors.institutionId, institutionId),
        isNull(connectors.replacedByConnectorId),
      ),
    )
    .orderBy(connectors.createdAt)
  return rows.map((r) => ({
    ...r,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function disconnectConnection(tenantId: string, id: string) {
  await db
    .update(connectors)
    .set({
      status: 'disconnected',
      statusReason: null,
      statusChangedAt: new Date(),
      credentialCiphertext: null,
      credentialNonce: null,
      cursor: null,
    })
    .where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)))
}

/** Disconnects the other live logins at the same institution that own no
 * account any more: a new login took their accounts (matched by the bank's
 * stable account id), and the bank usually expired their session. */
export async function retireReplacedConnections(tenantId: string, keepId: string, provider: ConnectorProvider, institutionId: string) {
  const retired = await db
    .update(connectors)
    .set({
      status: 'disconnected',
      statusReason: 'replaced by a newer login to the same bank',
      statusChangedAt: new Date(),
      credentialCiphertext: null,
      credentialNonce: null,
      cursor: null,
    })
    .where(
      and(
        eq(connectors.tenantId, tenantId),
        eq(connectors.provider, provider),
        eq(connectors.institutionId, institutionId),
        ne(connectors.id, keepId),
        ne(connectors.status, 'disconnected'),
        notExists(db.select({ id: accounts.id }).from(accounts).where(eq(accounts.connectorId, connectors.id))),
      ),
    )
    .returning({ id: connectors.id })
  return retired.map((r) => r.id)
}
