/** SOURCE OF TRUTH: Hono entrypoint — the only HTTP surface this server exposes.
 * WHAT: wires the Plaid Link enrollment flow (link-token -> widget -> exchange)
 * and ledger-backed read routes, writing to the real double-entry ledger.
 * WHY: the public_token/access_token boundary is load-bearing — apps/web only
 * ever sees link_token and public_token, never access_token. Do not add a
 * route that returns accessToken to the client.
 * WHERE: this file owns HTTP routing only. Plaid calls + normalization live
 * in packages/connectors, ledger writes live in ingest.ts, guardrail
 * enforcement lives in packages/ledger's migrations.
 */
import { Hono } from 'hono'
import { createPlaidLinkToken, exchangePlaidPublicToken } from '@repo/connectors'
import { db, accounts, transactions, postings } from '@repo/ledger'
import { eq, desc } from 'drizzle-orm'
import { saveItem, listItems, updateItemCursor } from './plaid-store.js'
import { ingestPlaidItem, LOCAL_TENANT_ID } from './ingest.js'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/plaid/link-token', async (c) => {
  try {
    const link_token = await createPlaidLinkToken('fluide-local-user')
    return c.json({ link_token })
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
    const { itemId, accessToken } = await exchangePlaidPublicToken(body.public_token)
    saveItem({
      itemId,
      accessToken,
      institutionName: body.institution_name,
      createdAt: new Date().toISOString(),
    })

    // ingest immediately so the ledger has data right after connecting
    const result = await ingestPlaidItem(accessToken)
    if (result.nextCursor) updateItemCursor(itemId, result.nextCursor)

    return c.json({ item_id: itemId, ingest: result })
  } catch (err: any) {
    console.error('exchange error', err?.response?.data ?? err)
    return c.json({ error: 'failed to exchange public token' }, 500)
  }
})

app.post('/plaid/sync', async (c) => {
  const items = listItems()
  if (items.length === 0) {
    return c.json({ error: 'no connected accounts yet' }, 404)
  }
  try {
    const results = []
    for (const item of items) {
      const result = await ingestPlaidItem(item.accessToken, item.cursor)
      if (result.nextCursor) updateItemCursor(item.itemId, result.nextCursor)
      results.push({ item_id: item.itemId, ...result })
    }
    return c.json({ synced: results })
  } catch (err: any) {
    console.error('sync error', err?.response?.data ?? err)
    return c.json({ error: 'failed to sync transactions' }, 500)
  }
})

app.get('/accounts', async (c) => {
  const rows = await db.select().from(accounts).where(eq(accounts.tenantId, LOCAL_TENANT_ID))
  return c.json({ accounts: rows })
})

app.get('/transactions', async (c) => {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      status: transactions.status,
      posting: {
        accountId: postings.accountId,
        amount: postings.amount,
        currency: postings.currency,
      },
    })
    .from(transactions)
    .innerJoin(postings, eq(postings.transactionId, transactions.id))
    .innerJoin(accounts, eq(accounts.id, postings.accountId))
    .where(eq(transactions.tenantId, LOCAL_TENANT_ID))
    .orderBy(desc(transactions.date))
    .limit(100)

  return c.json({ transactions: rows })
})

export default {
  port: 4000,
  fetch: app.fetch,
}
