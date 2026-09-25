import { Hono } from 'hono'
import { providerRoutes } from './routes/providers.js'
import { ledgerRoutes } from './routes/ledger.js'
import { assistantRoutes } from './routes/assistant.js'
import { settingsRoutes } from './routes/settings.js'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const api = new Hono()
api.route('/providers', providerRoutes)
api.route('/ledger', ledgerRoutes)
api.route('/assistant', assistantRoutes)
api.route('/settings', settingsRoutes)

app.route('/api', api)

export default {
  port: 4000,
  idleTimeout: 90,
  fetch: app.fetch,
}
