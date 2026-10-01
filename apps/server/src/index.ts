import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { errorHandler, httpGuard, isApiPath } from './http-guard.js'
import { providerRoutes } from './routes/providers.js'
import { ledgerRoutes } from './routes/ledger.js'
import { assistantRoutes } from './routes/assistant.js'
import { settingsRoutes } from './routes/settings.js'

const app = new Hono()
app.onError(errorHandler)
app.use(httpGuard())

const api = new Hono()
api.get('/health', (c) => c.json({ status: 'ok' }))
api.route('/providers', providerRoutes)
api.route('/ledger', ledgerRoutes)
api.route('/assistant', assistantRoutes)
api.route('/settings', settingsRoutes)

app.route('/api', api)

const webDist = process.env.FLUIDE_WEB_DIST
if (webDist) {
  const assets = serveStatic({ root: webDist })
  const spaIndex = serveStatic({ root: webDist, path: 'index.html' })
  app.get('*', (c, next) => (isApiPath(c.req.path) ? next() : assets(c, next)))
  app.get('*', (c, next) => (isApiPath(c.req.path) ? next() : spaIndex(c, next)))
}

export default {
  hostname: process.env.FLUIDE_HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  idleTimeout: 90,
  fetch: app.fetch,
}
