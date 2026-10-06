import { describe, expect, test } from 'bun:test'
import type { ConnectionSummary } from '../src/types.ts'
import { connectionHealth, summarizeConnections, syncedText } from '../src/lib/connection-health.ts'

const DAY = 86_400_000
const now = Date.UTC(2026, 8, 30, 12)

const conn = (over: Partial<ConnectionSummary> = {}): ConnectionSummary => ({
  id: 'c1',
  provider: 'enable-banking',
  institutionName: 'ING (NL)',
  status: 'active',
  statusReason: null,
  statusChangedAt: '2026-09-01T00:00:00Z',
  lastSyncedAt: null,
  validUntil: null,
  createdAt: '2026-01-01T00:00:00Z',
  replacedByConnectorId: null,
  countedUntil: null,
  accounts: [],
  ...over,
})
const until = (ms: number) => new Date(now + ms).toISOString()

describe('connectionHealth validity window', () => {
  test('no expiry info is ok with no days', () => {
    const h = connectionHealth(conn(), now)
    expect(h).toMatchObject({ state: 'ok', severity: 'ok', daysLeft: null, label: null })
  })

  test('an expiry in the past is expired', () => {
    const h = connectionHealth(conn({ validUntil: until(-3 * DAY) }), now)
    expect(h).toMatchObject({ state: 'expired', severity: 'broken', label: 'access expired' })
    expect(h.daysLeft).toBeLessThanOrEqual(0)
  })

  test('an expiry exactly now is already expired', () => {
    const h = connectionHealth(conn({ validUntil: until(0) }), now)
    expect(h).toMatchObject({ state: 'expired', daysLeft: 0 })
  })

  test('one millisecond left is a warning with 1 day', () => {
    const h = connectionHealth(conn({ validUntil: until(1) }), now)
    expect(h).toMatchObject({ state: 'warn', severity: 'warning', daysLeft: 1, label: 'access ends in 1 day' })
  })

  test('14 days left warns', () => {
    const h = connectionHealth(conn({ validUntil: until(14 * DAY) }), now)
    expect(h).toMatchObject({ state: 'warn', daysLeft: 14, label: 'access ends in 14 days' })
  })

  test('14 days and 1 ms rounds up to 15 and is ok', () => {
    const h = connectionHealth(conn({ validUntil: until(14 * DAY + 1) }), now)
    expect(h).toMatchObject({ state: 'ok', daysLeft: 15 })
  })

  test('15 days left is ok', () => {
    expect(connectionHealth(conn({ validUntil: until(15 * DAY) }), now).state).toBe('ok')
  })

  test('an unparseable expiry counts as no expiry info', () => {
    expect(connectionHealth(conn({ validUntil: 'soon' }), now)).toMatchObject({ state: 'ok', daysLeft: null })
  })
})

describe('connectionHealth precedence', () => {
  test('reauth_required wins over an expired consent', () => {
    const h = connectionHealth(conn({ status: 'reauth_required', validUntil: until(-DAY) }), now)
    expect(h).toMatchObject({ state: 'reauth', label: 'reconnect' })
  })

  test('an expired consent wins over a sync error', () => {
    const h = connectionHealth(conn({ status: 'error', validUntil: until(-DAY) }), now)
    expect(h.state).toBe('expired')
  })

  test('a sync error wins over an ending consent', () => {
    const h = connectionHealth(conn({ status: 'error', validUntil: until(3 * DAY) }), now)
    expect(h).toMatchObject({ state: 'error', severity: 'broken', label: 'sync failed', daysLeft: 3 })
  })

  test('reauth_required with plenty of consent left is still reauth', () => {
    expect(connectionHealth(conn({ status: 'reauth_required', validUntil: until(90 * DAY) }), now).state).toBe('reauth')
  })
})

describe('connectionHealth live rule', () => {
  test('a disconnected connection has no health to report', () => {
    const h = connectionHealth(conn({ status: 'disconnected', validUntil: until(-DAY) }), now)
    expect(h).toMatchObject({ state: 'disconnected', severity: 'ok', label: null })
    expect(h.actions).toEqual({ sync: false, reconnect: null, primary: null })
  })

  test('a replaced connection has no health to report even when its status is broken', () => {
    const h = connectionHealth(conn({ status: 'reauth_required', replacedByConnectorId: 'c2' }), now)
    expect(h).toMatchObject({ state: 'disconnected', label: null })
  })
})

describe('connectionHealth actions', () => {
  test('reauth and expired put Reconnect first and hide Sync', () => {
    expect(connectionHealth(conn({ status: 'reauth_required' }), now).actions).toEqual({ sync: false, reconnect: 'Reconnect', primary: 'reconnect' })
    expect(connectionHealth(conn({ validUntil: until(-DAY) }), now).actions).toEqual({ sync: false, reconnect: 'Renew', primary: 'reconnect' })
  })

  test('an expired Plaid login is reconnected, not renewed', () => {
    const h = connectionHealth(conn({ provider: 'plaid', validUntil: until(-DAY) }), now)
    expect(h.actions.reconnect).toBe('Reconnect')
  })

  test('a sync error keeps Sync primary beside a Reconnect', () => {
    expect(connectionHealth(conn({ status: 'error' }), now).actions).toEqual({ sync: true, reconnect: 'Reconnect', primary: 'sync' })
  })

  test('a warning offers Renew and keeps Sync', () => {
    expect(connectionHealth(conn({ validUntil: until(5 * DAY) }), now).actions).toEqual({ sync: true, reconnect: 'Renew', primary: 'reconnect' })
  })
})

describe('summarizeConnections', () => {
  const list = [
    conn({ id: 'ok', lastSyncedAt: until(-2 * DAY), accounts: [{ name: 'A', mask: null, kind: null }] }),
    conn({ id: 'warn', validUntil: until(3 * DAY), lastSyncedAt: until(-DAY) }),
    conn({ id: 'bad', status: 'error', lastSyncedAt: until(-5 * DAY) }),
    conn({ id: 'off', status: 'disconnected', lastSyncedAt: until(-30 * DAY) }),
    conn({ id: 'old', status: 'reauth_required', replacedByConnectorId: 'ok', lastSyncedAt: until(-60 * DAY) }),
  ]
  const s = summarizeConnections(list, now)

  test('counts only live connections', () => {
    expect(s.live.map((c) => c.id)).toEqual(['ok', 'warn', 'bad'])
    expect(s.ok).toBe(1)
    expect(s.accounts).toBe(1)
  })

  test('lists broken before warning', () => {
    expect(s.attention.map((a) => a.connection.id)).toEqual(['bad', 'warn'])
  })

  test('the sync stamp is the oldest live one, ignoring non-live connections', () => {
    expect(s.oldestSync).toBe(until(-5 * DAY))
    expect(syncedText(s.oldestSync ?? '', now)).toBe('synced 5 days ago')
  })

  test('no live sync means no date, only the never-synced count', () => {
    const only = summarizeConnections([conn({ lastSyncedAt: null })], now)
    expect(only.oldestSync).toBeNull()
    expect(only.syncStamp).toBe('1 never synced')
  })

  test('a live connection that never synced is named in the stamp beside the oldest age', () => {
    const mixed = summarizeConnections([conn({ id: 'a', lastSyncedAt: until(-DAY) }), conn({ id: 'b', lastSyncedAt: null })], now)
    expect(mixed.neverSynced).toBe(1)
    expect(mixed.syncStamp).toBe('synced yesterday · 1 never synced')
  })

  test('a never-synced connection that is not live is not counted', () => {
    const s = summarizeConnections([conn({ lastSyncedAt: until(-DAY) }), conn({ id: 'x', status: 'disconnected', lastSyncedAt: null })], now)
    expect(s.neverSynced).toBe(0)
    expect(s.syncStamp).toBe('synced yesterday')
  })

  test('no live connections means no stamp', () => {
    expect(summarizeConnections([], now).syncStamp).toBeNull()
  })
})
