import { describe, expect, test } from 'bun:test'
import {
  assertAllowedEnableBankingCall,
  assignEnableBankingIds,
  normalizeEnableBankingTransaction,
  type EbTransaction,
} from '../src/enable-banking.ts'
import { ConnectorError } from '../src/errors.ts'

const HASH = 'acct-hash'

function tx(overrides: Partial<EbTransaction> = {}): EbTransaction {
  return {
    transaction_amount: { amount: '4.56', currency: 'EUR' },
    credit_debit_indicator: 'DBIT',
    status: 'BOOK',
    booking_date: '2026-09-23',
    remittance_information: ['Coffee'],
    creditor: { name: 'Cafe' },
    debtor: { name: 'Me' },
    balance_after_transaction: { amount: '100.00', currency: 'EUR' },
    ...overrides,
  }
}

function rejection(run: () => unknown): ConnectorError {
  try {
    run()
  } catch (err) {
    expect(err).toBeInstanceOf(ConnectorError)
    return err as ConnectorError
  }
  throw new Error('expected a ConnectorError, nothing was thrown')
}

describe('normalizeEnableBankingTransaction: sign', () => {
  test('DBIT is money out (negative), CRDT is money in (positive)', () => {
    expect(normalizeEnableBankingTransaction(tx({ credit_debit_indicator: 'DBIT' }), HASH).amount).toBe(-4.56)
    expect(normalizeEnableBankingTransaction(tx({ credit_debit_indicator: 'CRDT' }), HASH).amount).toBe(4.56)
  })

  test('a bank that also signs the amount string does not flip it twice', () => {
    const debit = tx({ transaction_amount: { amount: '-4.56', currency: 'EUR' }, credit_debit_indicator: 'DBIT' })
    expect(normalizeEnableBankingTransaction(debit, HASH).amount).toBe(-4.56)
  })

  test('an unknown credit_debit_indicator is refused, not treated as income', () => {
    const err = rejection(() =>
      normalizeEnableBankingTransaction(tx({ credit_debit_indicator: 'XXXX' as 'DBIT' }), HASH),
    )
    expect(err.kind).toBe('bad_response')
    expect(err.message).toContain('credit_debit_indicator')
  })
})

describe('normalizeEnableBankingTransaction: refuses data it would have to guess', () => {
  test.each([
    ['empty amount', { transaction_amount: { amount: '', currency: 'EUR' } }],
    ['blank amount', { transaction_amount: { amount: '  ', currency: 'EUR' } }],
    ['non-numeric amount', { transaction_amount: { amount: 'abc', currency: 'EUR' } }],
    ['missing amount object', { transaction_amount: undefined as never }],
    ['missing currency', { transaction_amount: { amount: '4.56' } as never }],
    ['non-ISO currency', { transaction_amount: { amount: '4.56', currency: 'euro' } }],
    ['no date at all', { booking_date: null, value_date: null, transaction_date: null }],
    ['non-date string', { booking_date: 'not-a-date' }],
    ['impossible calendar date', { booking_date: '2026-13-45' }],
    ['datetime instead of date', { booking_date: '2026-09-23T10:00:00Z' }],
  ] satisfies [string, Partial<EbTransaction>][])('%s', (_label, overrides) => {
    expect(rejection(() => normalizeEnableBankingTransaction(tx(overrides), HASH)).kind).toBe('bad_response')
  })
})

describe('normalizeEnableBankingTransaction: fallbacks', () => {
  test('date falls back booking -> value -> transaction', () => {
    expect(normalizeEnableBankingTransaction(tx({ booking_date: '2026-09-01', value_date: '2026-09-02' }), HASH).date).toBe('2026-09-01')
    expect(normalizeEnableBankingTransaction(tx({ booking_date: null, value_date: '2026-09-02', transaction_date: '2026-09-03' }), HASH).date).toBe('2026-09-02')
    expect(normalizeEnableBankingTransaction(tx({ booking_date: null, value_date: null, transaction_date: '2026-09-03' }), HASH).date).toBe('2026-09-03')
  })

  test('description is the counterparty for the direction, then remittance, then bank code, then a placeholder', () => {
    expect(normalizeEnableBankingTransaction(tx({ credit_debit_indicator: 'DBIT' }), HASH).description).toBe('Cafe')
    expect(normalizeEnableBankingTransaction(tx({ credit_debit_indicator: 'CRDT' }), HASH).description).toBe('Me')
    expect(normalizeEnableBankingTransaction(tx({ creditor: null }), HASH).description).toBe('Coffee')
    expect(
      normalizeEnableBankingTransaction(tx({ creditor: null, remittance_information: [], bank_transaction_code: { description: 'Card payment' } }), HASH).description,
    ).toBe('Card payment')
    expect(normalizeEnableBankingTransaction(tx({ creditor: null, remittance_information: null }), HASH).description).toBe('(no description)')
  })
})

describe('assignEnableBankingIds', () => {
  test('entry_reference gives a real id scoped to the account', () => {
    const [only] = assignEnableBankingIds(HASH, [normalizeEnableBankingTransaction(tx({ entry_reference: 'REF-1' }), HASH)])
    expect(only?.providerTransactionId).toBe(`${HASH}:REF-1`)
    expect(only?.syntheticId).toBeUndefined()
  })

  test('synthetic ids are unchanged from before the error-handling change, so re-ingest does not duplicate', () => {
    // Values captured from the normalizer at commit c252596, before input
    // validation was added. If these move, every synthetic transaction already
    // in the ledger would be ingested a second time.
    const ids = assignEnableBankingIds(HASH, [
      normalizeEnableBankingTransaction(tx(), HASH),
      normalizeEnableBankingTransaction(tx(), HASH),
    ]).map((t) => [t.providerTransactionId, t.syntheticId])
    expect(ids).toEqual([
      [`${HASH}:h:a35e5d567621accea03efd546ad615bc`, true],
      [`${HASH}:h:a35e5d567621accea03efd546ad615bc#2`, true],
    ])
  })

  test('the same fetch assigned twice yields the same ids', () => {
    const batch = () => [tx(), tx({ entry_reference: 'REF-9' }), tx()].map((t) => normalizeEnableBankingTransaction(t, HASH))
    expect(assignEnableBankingIds(HASH, batch())).toEqual(assignEnableBankingIds(HASH, batch()))
  })

  test('identical content on two accounts gets different ids', () => {
    const [a] = assignEnableBankingIds('acct-a', [normalizeEnableBankingTransaction(tx(), 'acct-a')])
    const [b] = assignEnableBankingIds('acct-b', [normalizeEnableBankingTransaction(tx(), 'acct-b')])
    expect(a?.providerTransactionId.split(':h:')[1]).not.toBe(b?.providerTransactionId.split(':h:')[1])
  })
})

describe('assertAllowedEnableBankingCall (read-only forever)', () => {
  test.each([
    ['GET', '/aspsps'],
    ['POST', '/auth'],
    ['POST', '/sessions'],
    ['GET', '/sessions/abc'],
    ['DELETE', '/sessions/abc'],
    ['GET', '/accounts/u1/details'],
    ['GET', '/accounts/u1/balances'],
    ['GET', '/accounts/u1/transactions'],
  ])('allows %s %s', (method, path) => {
    expect(() => assertAllowedEnableBankingCall(method, path)).not.toThrow()
  })

  test.each([
    ['POST', '/payments'],
    ['GET', '/payments/p1'],
    ['POST', '/accounts/u1/transactions'],
    ['GET', '/accounts/u1/extra/transactions'],
    ['GET', '/sessions/abc/extra'],
    ['PUT', '/sessions/abc'],
  ])('refuses %s %s', (method, path) => {
    expect(() => assertAllowedEnableBankingCall(method, path)).toThrow('not a read-only endpoint')
  })
})
