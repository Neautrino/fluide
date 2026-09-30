import { describe, expect, test } from 'bun:test'
import type { Rule } from '../src/lib/api.ts'
import { checkPattern } from '../src/components/rules/model.ts'

const rule = (pattern: string, status: Rule['status']): Rule => ({
  id: pattern,
  tenantId: 't',
  pattern,
  categoryId: 'c',
  isUserCustom: true,
  confidenceLearned: null,
  timesMatched: 0,
  status,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const rules = [rule('SWIGGY', 'active'), rule('Amazon', 'proposed'), rule('PAYTM', 'rejected')]

describe('checkPattern', () => {
  test('accepts plain text and trims it', () => {
    const c = checkPattern('  DMART ', rules)
    expect(c.ready).toBe(true)
    expect(c.blocker).toBeNull()
    expect(c.notes).toHaveLength(0)
  })

  test('is not ready, and says nothing, for empty input or while the rules list is loading', () => {
    for (const c of [checkPattern('   ', rules), checkPattern('DMART', undefined)]) {
      expect(c.ready).toBe(false)
      expect(c.blocker).toBeNull()
      expect(c.notes).toHaveLength(0)
    }
  })

  test('blocks patterns under 3 characters', () => {
    expect(checkPattern('ab', rules).blocker).not.toBeNull()
    expect(checkPattern(' ab ', rules).ready).toBe(false)
    expect(checkPattern('abc', rules).ready).toBe(true)
  })

  test('blocks wildcard-only patterns but not wildcards inside text', () => {
    for (const p of ['%%%', '___', '_%_']) expect(checkPattern(p, rules).ready).toBe(false)
    expect(checkPattern('ab%', rules).ready).toBe(true)
    expect(checkPattern('%ab', rules).ready).toBe(true)
  })

  test('explains % and _ as wildcards without blocking', () => {
    const c = checkPattern('uber_eats', rules)
    expect(c.ready).toBe(true)
    expect(c.notes).toHaveLength(1)
  })

  test('allows * and says it is matched literally', () => {
    const c = checkPattern('SQ *COFFEE', rules)
    expect(c.ready).toBe(true)
    expect(c.blocker).toBeNull()
    expect(c.notes).toHaveLength(1)
  })

  test('a trailing single backslash blocks (Postgres rejects it); an even run does not', () => {
    expect(checkPattern('abc\\', rules).blocker).not.toBeNull()
    expect(checkPattern('abc\\\\\\', rules).ready).toBe(false)
    expect(checkPattern('abc\\\\', rules).ready).toBe(true)
  })

  test('an interior backslash is allowed with an escape note', () => {
    const c = checkPattern('a\\b', rules)
    expect(c.ready).toBe(true)
    expect(c.notes).toHaveLength(1)
  })

  test('blocks a case-insensitive, trimmed duplicate of an active or proposed rule', () => {
    expect(checkPattern('swiggy', rules).ready).toBe(false)
    expect(checkPattern('swiggy', rules).blocker).not.toBeNull()
    expect(checkPattern(' AMAZON ', rules).blocker).not.toBeNull()
  })

  test('a rejected twin does not block', () => {
    expect(checkPattern('paytm', rules).ready).toBe(true)
  })
})
