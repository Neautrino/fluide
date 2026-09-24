/** SOURCE OF TRUTH: connected-bank registry (TEMPORARY, pre-connectors-table).
 * WHAT: flat-file store of { id, provider, credential, institutionName,
 * cursor, validUntil } per connected bank, for every provider. `credential`
 * is Plaid's access_token or Enable Banking's session_id; `cursor` is
 * Plaid's sync pagination token; `validUntil` is the PSD2 consent expiry.
 * WHY: credentials are the one real secret a provider hands back after
 * enrollment. This file is the only place that reads/writes them, and none
 * of them is ever returned to apps/web. Stands in for the `connectors` table
 * (PLAN.md §2) until a vault for credentials_ref is decided.
 * WHERE: owns "which connections/credentials/cursors exist" only. Once the
 * `connectors` table exists, this whole file is deleted, not extended.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(import.meta.dir, '..', '.data')
const STORE_PATH = join(DATA_DIR, 'connections.json')

export type ConnectionProvider = 'plaid' | 'enable-banking'

export type Connection = {
  id: string
  provider: ConnectionProvider
  credential: string
  institutionName?: string
  createdAt: string
  cursor?: string
  validUntil?: string
}

function readStore(): Connection[] {
  if (!existsSync(STORE_PATH)) return []
  return JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
}

function writeStore(connections: Connection[]) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(connections, null, 2), { mode: 0o600 })
}

export function saveConnection(connection: Connection) {
  const connections = readStore()
  connections.push(connection)
  writeStore(connections)
}

export function listConnections(provider?: ConnectionProvider): Connection[] {
  const connections = readStore()
  return provider ? connections.filter((c) => c.provider === provider) : connections
}

export function updateConnectionCursor(id: string, cursor: string) {
  const connections = readStore()
  const connection = connections.find((c) => c.id === id)
  if (connection) {
    connection.cursor = cursor
    writeStore(connections)
  }
}
