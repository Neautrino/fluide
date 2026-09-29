import { describe, expect, test } from 'bun:test'
import { countsTowardTotals } from '../src/queries/accounts.ts'

describe('countsTowardTotals', () => {
  test('a live login counts, a disconnected one never does', () => {
    expect(countsTowardTotals({ connectionStatus: 'active', excludeFromNetWorth: false })).toBe(true)
    expect(countsTowardTotals({ connectionStatus: 'reauth_required', excludeFromNetWorth: false })).toBe(true)
    expect(countsTowardTotals({ connectionStatus: 'error', excludeFromNetWorth: false })).toBe(true)
    expect(countsTowardTotals({ connectionStatus: 'disconnected', excludeFromNetWorth: false })).toBe(false)
  })

  test('an account left out of net worth never counts, whatever its login says', () => {
    expect(countsTowardTotals({ connectionStatus: 'active', excludeFromNetWorth: true })).toBe(false)
    expect(countsTowardTotals({ connectionStatus: null, excludeFromNetWorth: true })).toBe(false)
  })

  test('a manual account has no login and counts', () => {
    expect(countsTowardTotals({ connectionStatus: null, excludeFromNetWorth: false })).toBe(true)
  })
})
