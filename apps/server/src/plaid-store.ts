/** SOURCE OF TRUTH: Plaid connected-item registry (TEMPORARY, pre-ledger).
 * WHAT: flat-file store of { itemId, accessToken, institutionName } per
 * connected bank, standing in for packages/ledger's Postgres `connectors`
 * table until that schema exists (see PLAN.md §2, Slice 0 board S0-3/S0-5).
 * WHY: accessToken is the one real secret Plaid hands back after enrollment —
 * it must never round-trip to apps/web or be passed to any LLM tool call.
 * This file is the only place that reads/writes it; every caller goes
 * through saveItem/listItems, never the raw JSON file.
 * WHERE: this store owns "which access tokens exist." It does not own
 * transactions/balances (those are fetched live from Plaid, never cached
 * here) and it is not the ledger's source of truth — once packages/ledger
 * exists, this whole file is deleted, not extended.
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
