import { describe, expect, test } from 'bun:test'
import {
  isExcludedMark,
  isSuggestedMark,
  matchTransferPairs,
  taggedTransferKind,
  type TransferLeg,
} from '../src/queries/transfer-match.ts'

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n))
const leg = (transactionId: string, accountId: string, amount: number, date: Date, currency = 'USD'): TransferLeg => ({
  transactionId,
  accountId,
  amount,
  currency,
  date,
})

describe('matchTransferPairs', () => {
  test('pairs a unique opposite-amount leg on another account', () => {
    const pairs = matchTransferPairs([
      leg('out', 'checking', -250, day(0)),
      leg('in', 'savings', 250, day(1)),
      leg('coffee', 'checking', -4.5, day(1)),
    ])
    expect(pairs).toEqual([{ outTransactionId: 'out', inTransactionId: 'in' }])
  })

  test('pairs legs exactly 4 days apart, in either order', () => {
    expect(matchTransferPairs([leg('out', 'checking', -100, day(4)), leg('in', 'savings', 100, day(0))])).toEqual([
      { outTransactionId: 'out', inTransactionId: 'in' },
    ])
  })

  test('does not pair legs more than 4 days apart', () => {
    const fourDaysAndASecond = new Date(day(4).getTime() + 1000)
    expect(matchTransferPairs([leg('out', 'checking', -100, day(0)), leg('in', 'savings', 100, fourDaysAndASecond)])).toEqual([])
  })

  test('leaves an outflow with two candidate inflows unpaired', () => {
    expect(
      matchTransferPairs([
        leg('out', 'checking', -100, day(0)),
        leg('in-a', 'savings', 100, day(1)),
        leg('in-b', 'brokerage', 100, day(2)),
      ]),
    ).toEqual([])
  })

  test('leaves an inflow claimed by two outflows unpaired', () => {
    expect(
      matchTransferPairs([
        leg('out-a', 'checking', -100, day(0)),
        leg('out-b', 'card', -100, day(1)),
        leg('in', 'savings', 100, day(1)),
      ]),
    ).toEqual([])
  })

  test('does not pair legs on the same account', () => {
    expect(matchTransferPairs([leg('refund-out', 'checking', -60, day(0)), leg('refund-in', 'checking', 60, day(1))])).toEqual([])
  })

  test('does not pair across currencies', () => {
    expect(matchTransferPairs([leg('out', 'checking', -100, day(0), 'USD'), leg('in', 'savings', 100, day(0), 'EUR')])).toEqual([])
  })

  test('requires opposite signs, not equal amounts', () => {
    expect(matchTransferPairs([leg('a', 'checking', -100, day(0)), leg('b', 'savings', -100, day(0))])).toEqual([])
    expect(matchTransferPairs([leg('a', 'checking', 100, day(0)), leg('b', 'savings', 100, day(0))])).toEqual([])
    expect(matchTransferPairs([leg('a', 'checking', -100, day(0)), leg('b', 'savings', 99.99, day(0))])).toEqual([])
  })
})

describe('taggedTransferKind', () => {
  const loan = ['plaid:LOAN_PAYMENTS']

  test('a LOAN_PAYMENTS outflow from an everyday account is a loan payment', () => {
    expect(taggedTransferKind('cash', -25, loan)).toBe('loan_payment')
    expect(taggedTransferKind('other', -25, loan)).toBe('loan_payment')
    expect(taggedTransferKind(null, -25, loan)).toBe('loan_payment')
  })

  test('a LOAN_PAYMENTS inflow on an everyday account stays unmarked, so it counts as income', () => {
    expect(taggedTransferKind('cash', 25, loan)).toBeUndefined()
    expect(taggedTransferKind('other', 25, loan)).toBeUndefined()
    expect(taggedTransferKind(null, 25, loan)).toBeUndefined()
  })

  test('LOAN_PAYMENTS on a credit account is a card payment either way', () => {
    expect(taggedTransferKind('credit', 25, loan)).toBe('card_payment')
    expect(taggedTransferKind('credit', -25, loan)).toBe('card_payment')
  })

  test('TRANSFER_IN / TRANSFER_OUT are transfers regardless of sign; other tags are not marked', () => {
    expect(taggedTransferKind('cash', 100, ['plaid:TRANSFER_IN'])).toBe('transfer')
    expect(taggedTransferKind('cash', -100, ['plaid:TRANSFER_OUT'])).toBe('transfer')
    expect(taggedTransferKind('cash', -100, ['plaid:FOOD_AND_DRINK'])).toBeUndefined()
    expect(taggedTransferKind('cash', -100, null)).toBeUndefined()
  })
})

describe('isExcludedMark / isSuggestedMark', () => {
  test('a provider-tagged transfer is a counted suggestion, not an exclusion', () => {
    expect(isExcludedMark('transfer', 'provider_tag')).toBe(false)
    expect(isSuggestedMark('transfer', 'provider_tag')).toBe(true)
  })

  test('a matched pair or a user "mine" leaves the movement out and is not suggested', () => {
    for (const kind of ['transfer', 'card_payment', 'investment'] as const) {
      for (const method of ['pair_match', 'user'] as const) {
        expect(isExcludedMark(kind, method)).toBe(true)
        expect(isSuggestedMark(kind, method)).toBe(false)
      }
    }
  })

  test('a provider-tagged card payment (money into the own card) is excluded', () => {
    expect(isExcludedMark('card_payment', 'provider_tag')).toBe(true)
    expect(isSuggestedMark('card_payment', 'provider_tag')).toBe(false)
  })

  test('loan payments and user "payment" decisions always count and are never suggested', () => {
    for (const method of ['pair_match', 'provider_tag', 'user'] as const) {
      for (const kind of ['loan_payment', 'not_transfer'] as const) {
        expect(isExcludedMark(kind, method)).toBe(false)
        expect(isSuggestedMark(kind, method)).toBe(false)
      }
    }
  })
})
