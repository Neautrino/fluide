import { describe, expect, test } from 'bun:test'
import { createVersionChecker, isNewer } from '../src/version.js'

describe('isNewer', () => {
  test('compares numerically per component', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true)
    expect(isNewer('0.1.0', '0.2.0')).toBe(false)
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('1.0.0', '0.99.99')).toBe(true)
    expect(isNewer('0.1.1', '0.1.0')).toBe(true)
  })

  test('equal versions are not an update', () => {
    expect(isNewer('0.1.0', '0.1.0')).toBe(false)
    expect(isNewer('v0.1.0', '0.1.0')).toBe(false)
  })

  test('pre-release and garbage tags are never an update', () => {
    expect(isNewer('0.2.0-beta.1', '0.1.0')).toBe(false)
    expect(isNewer('latest', '0.1.0')).toBe(false)
    expect(isNewer('1.2', '0.1.0')).toBe(false)
    expect(isNewer('', '0.1.0')).toBe(false)
  })
})

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond()
  }
  return { fetch, calls }
}

const release = (tag: string) =>
  Response.json({
    tag_name: tag,
    html_url: `https://github.com/Neautrino/fluide/releases/tag/${tag}`,
    published_at: '2026-09-30T12:00:00Z',
  })

function checker(respond: () => Response | Promise<Response>, opts: { enabled?: boolean; clock?: { t: number } } = {}) {
  const { fetch, calls } = fakeFetch(respond)
  const clock = opts.clock ?? { t: Date.parse('2026-10-01T00:00:00Z') }
  const get = createVersionChecker({
    current: '0.1.0',
    fetch,
    now: () => clock.t,
    enabled: () => opts.enabled ?? true,
  })
  return { get, calls, clock }
}

describe('version checker', () => {
  test('newer release -> ok with update available', async () => {
    const { get, calls } = checker(() => release('v0.2.0'))
    const info = await get()
    expect(info).toEqual({
      current: '0.1.0',
      checkEnabled: true,
      latest: {
        version: '0.2.0',
        url: 'https://github.com/Neautrino/fluide/releases/tag/v0.2.0',
        publishedAt: '2026-09-30T12:00:00Z',
      },
      updateAvailable: true,
      status: 'ok',
      checkedAt: '2026-10-01T00:00:00.000Z',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.github.com/repos/Neautrino/fluide/releases/latest')
    expect(calls[0]!.init.headers).toEqual({ Accept: 'application/vnd.github+json', 'User-Agent': 'fluide/0.1.0' })
  })

  test('same release -> ok, no update', async () => {
    const info = await checker(() => release('v0.1.0')).get()
    expect(info.status).toBe('ok')
    expect(info.updateAvailable).toBe(false)
  })

  test('pre-release tag -> ok, no update', async () => {
    const info = await checker(() => release('v0.2.0-beta.1')).get()
    expect(info.status).toBe('ok')
    expect(info.updateAvailable).toBe(false)
  })

  test('404 -> no-release', async () => {
    const info = await checker(() => new Response('{"message":"Not Found"}', { status: 404 })).get()
    expect(info.status).toBe('no-release')
    expect(info.latest).toBeNull()
    expect(info.updateAvailable).toBe(false)
  })

  test('403 rate limit -> unavailable', async () => {
    const info = await checker(() => new Response('{"message":"API rate limit exceeded"}', { status: 403 })).get()
    expect(info.status).toBe('unavailable')
    expect(info.latest).toBeNull()
  })

  test('network error -> unavailable', async () => {
    const info = await checker(() => {
      throw new TypeError('fetch failed')
    }).get()
    expect(info.status).toBe('unavailable')
  })

  test('bad JSON -> unavailable', async () => {
    const info = await checker(() => new Response('not json', { status: 200 })).get()
    expect(info.status).toBe('unavailable')
  })

  test('success is cached for 24h', async () => {
    const { get, calls, clock } = checker(() => release('v0.2.0'))
    await get()
    clock.t += 23 * 60 * 60 * 1000
    const again = await get()
    expect(calls).toHaveLength(1)
    expect(again.checkedAt).toBe('2026-10-01T00:00:00.000Z')
    clock.t += 60 * 60 * 1000
    await get()
    expect(calls).toHaveLength(2)
  })

  test('failure is cached for 1h', async () => {
    const { get, calls, clock } = checker(() => new Response('', { status: 403 }))
    await get()
    clock.t += 59 * 60 * 1000
    await get()
    expect(calls).toHaveLength(1)
    clock.t += 60 * 1000
    await get()
    expect(calls).toHaveLength(2)
  })

  test('concurrent calls share one request', async () => {
    const { get, calls } = checker(() => release('v0.2.0'))
    await Promise.all([get(), get(), get()])
    expect(calls).toHaveLength(1)
  })

  test('disabled -> no fetch, status disabled', async () => {
    const { get, calls } = checker(() => release('v0.2.0'), { enabled: false })
    expect(await get()).toEqual({
      current: '0.1.0',
      checkEnabled: false,
      latest: null,
      updateAvailable: false,
      status: 'disabled',
      checkedAt: null,
    })
    expect(calls).toHaveLength(0)
  })

  test('FLUIDE_UPDATE_CHECK=off disables the default checker', async () => {
    const { fetch, calls } = fakeFetch(() => release('v0.2.0'))
    const previous = process.env.FLUIDE_UPDATE_CHECK
    process.env.FLUIDE_UPDATE_CHECK = 'off'
    try {
      const info = await createVersionChecker({ current: '0.1.0', fetch })()
      expect(info.status).toBe('disabled')
      expect(info.checkEnabled).toBe(false)
      expect(calls).toHaveLength(0)
    } finally {
      if (previous === undefined) delete process.env.FLUIDE_UPDATE_CHECK
      else process.env.FLUIDE_UPDATE_CHECK = previous
    }
  })
})
