/** SOURCE OF TRUTH: Plaid connected-item registry (TEMPORARY, pre-connectors-table).
 * WHAT: flat-file store of { itemId, accessToken, institutionName, cursor }
 * per connected bank. Stands in for the `connectors` table (PLAN.md §2),
 * not built yet. `cursor` is Plaid's sync pagination token — without it,
 * every sync re-fetches full history.
 * WHY: accessToken is the one real secret Plaid hands back after enrollment.
 * This file is the only place that reads/writes it.
 * WHERE: owns "which access tokens/cursors exist" only. Once a real
 * `connectors` table exists, this whole file is deleted, not extended.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(import.meta.dir, '..', '.data')
const STORE_PATH = join(DATA_DIR, 'plaid-items.json')

type PlaidItem = {
  itemId: string
  accessToken: string
  institutionName?: string
  createdAt: string
  cursor?: string
}

function readStore(): PlaidItem[] {
  if (!existsSync(STORE_PATH)) return []
  return JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
}

function writeStore(items: PlaidItem[]) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(items, null, 2))
}

export function saveItem(item: PlaidItem) {
  const items = readStore()
  items.push(item)
  writeStore(items)
}

export function listItems(): PlaidItem[] {
  return readStore()
}

export function updateItemCursor(itemId: string, cursor: string) {
  const items = readStore()
  const item = items.find((i) => i.itemId === itemId)
  if (item) {
    item.cursor = cursor
    writeStore(items)
  }
}
