import type { ConnectionSummary } from './api'

const DAY_MS = 86_400_000
const WARN_DAYS = 14

export const HTTPS_REASON =
  'Needs https — banks only redirect back to https addresses. Open Fluide over https (WEB_TLS_CERT_PATH and WEB_TLS_KEY_PATH in apps/web/.env).'

export const isHttps = () => window.location.protocol === 'https:'

type ConnectionLike = Pick<ConnectionSummary, 'status' | 'validUntil' | 'replacedByConnectorId'> & {
  provider?: ConnectionSummary['provider']
}

export type HealthState = 'ok' | 'warn' | 'reauth' | 'expired' | 'error' | 'disconnected'
export type Severity = 'ok' | 'warning' | 'broken'

export type Health = {
  state: HealthState
  severity: Severity
  /** Whole days of access left, rounded up; null when the bank gave no expiry. Zero or less once expired. */
  daysLeft: number | null
  /** The chip text ("reconnect", "access ends in 3 days"); null when nothing needs saying. */
  label: string | null
  actions: {
    sync: boolean
    reconnect: 'Reconnect' | 'Renew' | null
    primary: 'sync' | 'reconnect' | null
  }
}

/** A replaced or disconnected login is history: it never counts, and never shows a chip or a sync stamp. */
export const isLiveConnection = (c: Pick<ConnectionSummary, 'status' | 'replacedByConnectorId'>) =>
  c.status !== 'disconnected' && !c.replacedByConnectorId

function daysUntil(validUntil: string | null, now: number): number | null {
  if (!validUntil) return null
  const until = new Date(validUntil).getTime()
  if (Number.isNaN(until)) return null
  return Math.ceil((until - now) / DAY_MS) + 0
}

const NONE: Health['actions'] = { sync: false, reconnect: null, primary: null }

export function connectionHealth(c: ConnectionLike, now: number): Health {
  if (!isLiveConnection(c)) return { state: 'disconnected', severity: 'ok', daysLeft: null, label: null, actions: NONE }

  const daysLeft = daysUntil(c.validUntil, now)
  const renewable = c.provider === 'enable-banking'
  const reconnectFirst = (reconnect: 'Reconnect' | 'Renew'): Health['actions'] => ({ sync: false, reconnect, primary: 'reconnect' })

  if (c.status === 'reauth_required') {
    return { state: 'reauth', severity: 'broken', daysLeft, label: 'reconnect', actions: reconnectFirst('Reconnect') }
  }
  if (daysLeft !== null && daysLeft <= 0) {
    return { state: 'expired', severity: 'broken', daysLeft, label: 'access expired', actions: reconnectFirst(renewable ? 'Renew' : 'Reconnect') }
  }
  if (c.status === 'error') {
    return { state: 'error', severity: 'broken', daysLeft, label: 'sync failed', actions: { sync: true, reconnect: 'Reconnect', primary: 'sync' } }
  }
  if (daysLeft !== null && daysLeft > 0 && daysLeft <= WARN_DAYS) {
    return {
      state: 'warn',
      severity: 'warning',
      daysLeft,
      label: `access ends in ${daysLeft === 1 ? '1 day' : `${daysLeft} days`}`,
      actions: { sync: true, reconnect: renewable ? 'Renew' : 'Reconnect', primary: 'reconnect' },
    }
  }
  return { state: 'ok', severity: 'ok', daysLeft, label: null, actions: { sync: true, reconnect: 'Reconnect', primary: null } }
}

export type Attention = { connection: ConnectionSummary; health: Health }

/** Counts over live connections only. `oldestSync` is the stalest lastSyncedAt among them: the whole picture is at least that fresh. */
export function summarizeConnections(connections: ConnectionSummary[], now: number) {
  const live = connections.filter(isLiveConnection)
  const rated: Attention[] = live.map((connection) => ({ connection, health: connectionHealth(connection, now) }))
  const broken = rated.filter((r) => r.health.severity === 'broken')
  const warning = rated.filter((r) => r.health.severity === 'warning')
  let oldestSync: string | null = null
  let neverSynced = 0
  let oldest = Infinity
  for (const c of live) {
    if (!c.lastSyncedAt) neverSynced += 1
    const at = c.lastSyncedAt ? new Date(c.lastSyncedAt).getTime() : Number.NaN
    if (!Number.isNaN(at) && at < oldest) {
      oldest = at
      oldestSync = c.lastSyncedAt
    }
  }
  return {
    live,
    broken,
    warning,
    attention: [...broken, ...warning],
    ok: rated.length - broken.length - warning.length,
    accounts: live.reduce((n, c) => n + c.accounts.length, 0),
    oldestSync,
    neverSynced,
    syncStamp: syncStamp(oldestSync, neverSynced, now),
  }
}

/** "ING (NL)" → "ING": the country suffix is noise in a chip. */
export function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '') || name
}

export function chipText(c: Pick<ConnectionSummary, 'institutionName'>, health: Health): string {
  return `${shortName(c.institutionName ?? 'Bank')} · ${health.label}`
}

export const allOkText = (n: number) => `All ${n} connection${n === 1 ? '' : 's'} OK`

export const othersConnectedText = (n: number) => `${n} other${n === 1 ? '' : 's'} connected`

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const UNITS = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
] as const

export function timeAgo(iso: string, now: number): string {
  const seconds = (new Date(iso).getTime() - now) / 1000
  if (Number.isNaN(seconds)) return iso
  for (const [unit, size] of UNITS) {
    if (seconds <= -size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export const syncedText = (iso: string, now: number) => `synced ${timeAgo(iso, now)}`

/** The oldest live sync, plus any live connection that has never synced: a stamp must not read fresher than the stalest source. */
function syncStamp(oldestSync: string | null, neverSynced: number, now: number): string | null {
  const parts = [oldestSync && syncedText(oldestSync, now), neverSynced > 0 && `${neverSynced} never synced`].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}
