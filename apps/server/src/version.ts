import { readFileSync } from 'node:fs'

export type VersionStatus = 'ok' | 'no-release' | 'unavailable' | 'disabled'

export type LatestRelease = { version: string; url: string; publishedAt: string | null }

export type VersionInfo = {
  current: string
  checkEnabled: boolean
  latest: LatestRelease | null
  updateAvailable: boolean
  status: VersionStatus
  checkedAt: string | null
}

const RELEASES_URL = 'https://api.github.com/repos/Neautrino/fluide/releases/latest'
const TIMEOUT_MS = 5_000
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000
const FAILURE_TTL_MS = 60 * 60 * 1000

export const CURRENT_VERSION: string = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
).version

export function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!
  }
  return false
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>

type CheckerOptions = {
  current?: string
  fetch?: Fetch
  now?: () => number
  enabled?: () => boolean
}

type Checked = { status: 'ok' | 'no-release' | 'unavailable'; latest: LatestRelease | null }

export function createVersionChecker({
  current = CURRENT_VERSION,
  fetch: doFetch = (input, init) => fetch(input, init),
  now = Date.now,
  enabled = () => process.env.FLUIDE_UPDATE_CHECK?.trim().toLowerCase() !== 'off',
}: CheckerOptions = {}) {
  let cache: { result: Checked; checkedAt: number; expiresAt: number } | null = null
  let inflight: Promise<void> | null = null

  async function check(): Promise<Checked> {
    try {
      const res = await doFetch(RELEASES_URL, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `fluide/${current}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 404) return { status: 'no-release', latest: null }
      if (!res.ok) return { status: 'unavailable', latest: null }
      const body = (await res.json()) as { tag_name?: unknown; html_url?: unknown; published_at?: unknown }
      if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') {
        return { status: 'unavailable', latest: null }
      }
      return {
        status: 'ok',
        latest: {
          version: body.tag_name.replace(/^v/, ''),
          url: body.html_url,
          publishedAt: typeof body.published_at === 'string' ? body.published_at : null,
        },
      }
    } catch {
      return { status: 'unavailable', latest: null }
    }
  }

  async function refresh() {
    const result = await check()
    const checkedAt = now()
    cache = { result, checkedAt, expiresAt: checkedAt + (result.status === 'unavailable' ? FAILURE_TTL_MS : SUCCESS_TTL_MS) }
  }

  return async function getVersionInfo(): Promise<VersionInfo> {
    if (!enabled()) {
      return { current, checkEnabled: false, latest: null, updateAvailable: false, status: 'disabled', checkedAt: null }
    }
    if (!cache || now() >= cache.expiresAt) {
      inflight ??= refresh().finally(() => {
        inflight = null
      })
      await inflight
    }
    const { result, checkedAt } = cache!
    return {
      current,
      checkEnabled: true,
      latest: result.latest,
      updateAvailable: result.latest !== null && isNewer(result.latest.version, current),
      status: result.status,
      checkedAt: new Date(checkedAt).toISOString(),
    }
  }
}

export const getVersionInfo = createVersionChecker()
