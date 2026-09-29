import { describe, expect, test } from 'bun:test'
import {
  chooseCurrency,
  monthOf,
  monthWindow,
  otherCurrencyTotals,
  periodWindow,
  summarizeMonth,
  type CashFlowLeg,
} from '../src/queries/cashflow.ts'

let seq = 0
const leg = (amount: number, over: Partial<CashFlowLeg> = {}): CashFlowLeg => {
  seq++
  return {
    postingId: `p${seq}`,
    transactionId: `t${seq}`,
    date: new Date(Date.UTC(2026, 8, 1 + (seq % 20))),
    description: `tx ${seq}`,
    pending: false,
    accountId: 'checking',
    accountName: 'Checking',
    accountKind: 'cash',
    amount,
    currency: 'USD',
    name: `name ${seq}`,
    category: 'Uncategorized',
    fromBank: false,
    markKind: null,
    markMethod: null,
    pairTransactionId: null,
    partner: null,
    ...over,
  }
}

const blocks = (legs: CashFlowLeg[]) => {
  const { currencies } = chooseCurrency(legs, [])
  return currencies.map((currency) => ({
    currency,
    summary: summarizeMonth(
      legs.filter((l) => l.currency === currency),
      31,
    ),
  }))
}

describe('periodWindow', () => {
  test('this_month is the cash-flow month window, in UTC', () => {
    const now = new Date('2026-09-29T20:00:00Z')
    const month = monthWindow(monthOf(now), now)
    expect(periodWindow('this_month', now)).toMatchObject({ start: month.start, end: month.end })
    expect([month.start.toISOString(), month.end.toISOString()]).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    ])
  })

  test('day 1 of the month is inside this_month whatever the host offset', () => {
    const window = periodWindow('this_month', new Date('2026-09-01T00:30:00Z'))
    expect(window.start!.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(new Date('2026-09-01T00:15:00Z') >= window.start!).toBe(true)
  })

  test('this_week starts on the UTC Sunday and runs seven days', () => {
    const window = periodWindow('this_week', new Date('2026-09-29T20:00:00Z'))
    expect([window.start!.toISOString(), window.end!.toISOString()]).toEqual([
      '2026-09-27T00:00:00.000Z',
      '2026-10-04T00:00:00.000Z',
    ])
  })

  test('this_year is the UTC calendar year; all_time is unbounded', () => {
    const year = periodWindow('this_year', new Date('2026-09-29T20:00:00Z'))
    expect([year.start!.toISOString(), year.end!.toISOString()]).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ])
    expect(periodWindow('all_time', new Date('2026-09-29T20:00:00Z'))).toEqual({ start: null, end: null })
  })
})

describe('chooseCurrency', () => {
  test('the default is the currency with the most legs', () => {
    const legs = [leg(-10, { currency: 'EUR' }), leg(-20), leg(-30), leg(-5, { currency: 'EUR' }), leg(-1)]
    expect(chooseCurrency(legs, [])).toEqual({ currency: 'USD', currencies: ['USD', 'EUR'] })
  })

  test('an equal number of legs breaks the tie by currency name', () => {
    const legs = [leg(-10, { currency: 'USD' }), leg(-10, { currency: 'EUR' })]
    expect(chooseCurrency(legs, [])).toEqual({ currency: 'EUR', currencies: ['EUR', 'USD'] })
  })

  test('a requested currency the scope holds wins; one it does not falls back to the default', () => {
    const legs = [leg(-10), leg(-20), leg(-5, { currency: 'EUR' })]
    expect(chooseCurrency(legs, [], 'EUR').currency).toBe('EUR')
    expect(chooseCurrency(legs, [], 'GBP').currency).toBe('USD')
  })

  test('with no legs the accounts decide, sorted, and an empty scope has no currency', () => {
    expect(chooseCurrency([], ['USD', 'EUR', 'EUR'])).toEqual({ currency: 'EUR', currencies: ['EUR', 'USD'] })
    expect(chooseCurrency([], [])).toEqual({ currency: '', currencies: [] })
  })
})

describe('per-currency blocks', () => {
  test('mixed currencies give one block each and no block holds the other currency', () => {
    const legs = [
      leg(500, { name: 'Payroll' }),
      leg(-100, { name: 'Grocer', category: 'Food' }),
      leg(-25, { name: 'Lender', markKind: 'loan_payment', markMethod: 'user' }),
      leg(-5.73, { currency: 'EUR', name: 'Café', category: 'Food' }),
    ]
    const [usd, eur] = blocks(legs)
    expect(usd!.currency).toBe('USD')
    expect(usd!.summary).toMatchObject({ moneyIn: 500, moneyOut: 125, spending: 100, debtPayments: 25 })
    expect(eur!.currency).toBe('EUR')
    expect(eur!.summary).toMatchObject({ moneyIn: 0, moneyOut: 5.73, spending: 5.73, debtPayments: 0 })
    expect(usd!.summary.categories).toEqual([{ label: 'Food', amount: 100, fromBank: false }])
    expect(eur!.summary.categories).toEqual([{ label: 'Food', amount: 5.73, fromBank: false }])
    expect(usd!.summary.merchants.map((m) => m.name)).toEqual(['Grocer'])
    expect(eur!.summary.merchants.map((m) => m.name)).toEqual(['Café'])
  })

  test('spending in a category counts outflows only, so a refund never inflates it', () => {
    const legs = [
      leg(-100, { category: 'Food' }),
      leg(30, { category: 'Food', accountKind: 'credit' }),
    ]
    expect(summarizeMonth(legs, 31).categories).toEqual([{ label: 'Food', amount: 100, fromBank: false }])
  })
})

describe('otherCurrencyTotals', () => {
  test('one line per other currency, most legs first, counted legs only', () => {
    const legs = [
      leg(-100),
      leg(-5.73, { currency: 'EUR' }),
      leg(2, { currency: 'EUR' }),
      leg(-900, { currency: 'EUR', markKind: 'transfer', markMethod: 'pair_match' }),
      leg(-40, { currency: 'GBP' }),
    ]
    expect(otherCurrencyTotals(legs, 'USD')).toEqual([
      { currency: 'EUR', count: 2, moneyIn: 2, moneyOut: 5.73 },
      { currency: 'GBP', count: 1, moneyIn: 0, moneyOut: 40 },
    ])
  })

  test('a single-currency scope has nothing to report', () => {
    const legs = [leg(-100), leg(200)]
    expect(chooseCurrency(legs, []).currencies).toHaveLength(1)
    expect(otherCurrencyTotals(legs, 'USD')).toEqual([])
  })
})
