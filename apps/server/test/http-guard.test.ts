import { afterEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { DrizzleQueryError } from 'drizzle-orm'
import { errorHandler, httpGuard } from '../src/http-guard.js'

function guardedApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.use(httpGuard())
  app.get('/api/health', (c) => c.json({ status: 'ok' }))
  app.post('/api/things', (c) => c.json({ ok: true }))
  app.get('/api/boom', () => {
    throw new Error('db exploded\nparams: secret-value')
  })
  app.get('/api/query-boom', () => {
    throw new DrizzleQueryError('insert into secrets values ($1)', ['plaid-access-token'], new Error('duplicate key value'))
  })
  return app
}

const JSON_BODY = { 'Content-Type': 'application/json', 'Content-Length': '2' }

afterEach(() => {
  delete process.env.FLUIDE_ALLOWED_HOSTS
})

describe('Host allowlist', () => {
  test('foreign Host is refused with 421', async () => {
    const res = await guardedApp().request('/api/health', { headers: { Host: 'evil.example' } })
    expect(res.status).toBe(421)
    expect(await res.json()).toEqual({ error: 'misdirected request' })
  })

  test.each([undefined, '', '  '])('missing Host %p is refused with 400', async (host) => {
    const headers: Record<string, string> = host === undefined ? {} : { Host: host }
    const res = await guardedApp().request('/api/health', { headers })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'missing host header' })
  })

  test.each(['localhost', 'localhost:8080', '127.0.0.1:4000', '[::1]:8080', 'app.localhost:3000', 'LOCALHOST'])(
    'Host %s is allowed',
    async (host) => {
      const res = await guardedApp().request('/api/health', { headers: { Host: host } })
      expect(res.status).toBe(200)
    },
  )

  test('a lookalike suffix is not *.localhost', async () => {
    const res = await guardedApp().request('/api/health', { headers: { Host: 'evillocalhost' } })
    expect(res.status).toBe(421)
  })

  test('FLUIDE_ALLOWED_HOSTS adds hostnames, port ignored', async () => {
    process.env.FLUIDE_ALLOWED_HOSTS = 'nas.lan, Fluide.Home'
    const app = guardedApp()
    expect((await app.request('/api/health', { headers: { Host: 'nas.lan:8080' } })).status).toBe(200)
    expect((await app.request('/api/health', { headers: { Host: 'fluide.home' } })).status).toBe(200)
    expect((await app.request('/api/health', { headers: { Host: 'other.lan' } })).status).toBe(421)
  })

  test('FLUIDE_ALLOWED_HOSTS also governs Origin on writes', async () => {
    process.env.FLUIDE_ALLOWED_HOSTS = 'nas.lan'
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'nas.lan:8080', Origin: 'http://nas.lan:8080', ...JSON_BODY },
      body: '{}',
    })
    expect(res.status).toBe(200)
  })
})

describe('write guard', () => {
  test('cross-site POST is refused with 403', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Sec-Fetch-Site': 'cross-site', ...JSON_BODY },
      body: '{}',
    })
    expect(res.status).toBe(403)
  })

  test('same-site (not same-origin) POST is refused', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Sec-Fetch-Site': 'same-site', ...JSON_BODY },
      body: '{}',
    })
    expect(res.status).toBe(403)
  })

  test('same-origin JSON POST passes', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost:3000', 'Sec-Fetch-Site': 'same-origin', Origin: 'http://localhost:3000', ...JSON_BODY },
      body: '{}',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test('JSON with charset parameter passes', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': '2' },
      body: '{}',
    })
    expect(res.status).toBe(200)
  })

  test('text/plain body is refused with 415', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Content-Type': 'text/plain', 'Content-Length': '2' },
      body: '{}',
    })
    expect(res.status).toBe(415)
  })

  test('chunked body without Content-Type is refused with 415', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Transfer-Encoding': 'chunked' },
    })
    expect(res.status).toBe(415)
  })

  test('bodyless POST without Content-Type passes', async () => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(res.status).toBe(200)
  })

  test('GET with cross-site Sec-Fetch-Site passes', async () => {
    const res = await guardedApp().request('/api/health', {
      headers: { Host: 'localhost', 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(res.status).toBe(200)
  })

  test.each(['http://evil.example', 'null', 'http://localhost.evil.example'])('Origin %s on POST is refused', async (origin) => {
    const res = await guardedApp().request('/api/things', {
      method: 'POST',
      headers: { Host: 'localhost', Origin: origin, ...JSON_BODY },
      body: '{}',
    })
    expect(res.status).toBe(403)
  })
})

describe('error handler', () => {
  test('returns a redacted 500 with a request id and logs one safe line', async () => {
    const logged: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))
    try {
      const res = await guardedApp().request('/api/boom', { headers: { Host: 'localhost' } })
      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: string; requestId: string }
      expect(body.error).toBe('internal error')
      expect(Object.keys(body).sort()).toEqual(['error', 'requestId'])
      expect(logged).toHaveLength(1)
      expect(logged[0]).toBe(`[${body.requestId}] GET /api/boom Error: db exploded`)
    } finally {
      console.error = original
    }
  })

  test('a failed Drizzle query logs its driver cause, never the query params', async () => {
    const logged: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))
    try {
      const res = await guardedApp().request('/api/query-boom', { headers: { Host: 'localhost' } })
      expect(res.status).toBe(500)
      expect(logged).toHaveLength(1)
      expect(logged[0]).toContain('Error: duplicate key value')
      expect(logged[0]).not.toContain('plaid-access-token')
      expect(await res.text()).not.toContain('plaid-access-token')
    } finally {
      console.error = original
    }
  })

  test('logs the full request path for a mounted sub-app', async () => {
    const logged: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))
    try {
      const api = new Hono()
      api.onError(errorHandler)
      api.get('/health', () => {
        throw new Error('boom')
      })
      const app = new Hono()
      app.onError(errorHandler)
      app.route('/api', api)
      const res = await app.request('/api/health', { headers: { Host: 'localhost' } })
      expect(res.status).toBe(500)
      expect(logged).toHaveLength(1)
      expect(logged[0]).toContain(' GET /api/health Error: boom')
    } finally {
      console.error = original
    }
  })
})
