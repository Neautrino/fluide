/* SOURCE OF TRUTH: per-connection bank credentials (Plaid access_token, Enable Banking session_id).
 * Never: return a credential to apps/web or an LLM tool call.
 * See: ADR 009 — why this is a flat file, not PLAN.md's connectors table
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
