/** SOURCE OF TRUTH: Hono entrypoint — the only HTTP surface this server exposes.
 * WHAT: wires the Plaid Link enrollment flow (link-token -> widget -> exchange)
 * and a read-only /plaid/transactions proof route. Prototype stage: reads/
 * writes go through plaid-store.ts, not packages/ledger (doesn't exist yet).
 * WHY: this is Slice 0's walking skeleton (PLAN.md §4) — prove one real bank
 * connection end-to-end before any ledger/categorization code exists. The
 * public_token/access_token boundary is load-bearing: apps/web only ever
 * sees link_token and public_token, never access_token (Plaid's own secret
 * hand-off contract) — do not add a route that returns accessToken to the client.
 * WHERE: this file owns HTTP routing only. Plaid API calls belong in
 * plaid-client.ts, persistence belongs in plaid-store.ts — keep business
 * logic out of route handlers as packages/connectors gets built.
 */
import { Hono } from 'hono'
import { plaidClient } from './plaid-client'
import { saveItem, listItems } from './plaid-store'
import { CountryCode, Products } from 'plaid'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/plaid/link-token', async (c) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'fluide-local-user' }, // single self-hosted user for now
      client_name: 'Fluide',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    return c.json({ link_token: response.data.link_token })
  } catch (err: any) {
    console.error('link-token error', err?.response?.data ?? err)
    return c.json({ error: 'failed to create link token' }, 500)
  }
})

app.post('/plaid/exchange', async (c) => {
  const body = await c.req.json<{ public_token: string; institution_name?: string }>()
  if (!body?.public_token) {
    return c.json({ error: 'public_token required' }, 400)
  }
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: body.public_token,
    })
    saveItem({
      itemId: response.data.item_id,
      accessToken: response.data.access_token,
      institutionName: body.institution_name,
      createdAt: new Date().toISOString(),
    })
    return c.json({ item_id: response.data.item_id })
  } catch (err: any) {
    console.error('exchange error', err?.response?.data ?? err)
    return c.json({ error: 'failed to exchange public token' }, 500)
  }
})

app.get('/plaid/transactions', async (c) => {
  const items = listItems()
  const latest = items[items.length - 1]
  if (!latest) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  try {
    const response = await plaidClient.transactionsSync({
      access_token: latest.accessToken,
    })
    return c.json({
      item_id: latest.itemId,
      added: response.data.added,
      accounts: response.data.accounts,
    })
  } catch (err: any) {
    console.error('transactions/sync error', err?.response?.data ?? err)
    return c.json({ error: 'failed to fetch transactions' }, 500)
  }
})

export default {
  port: 4000,
  fetch: app.fetch,
}
