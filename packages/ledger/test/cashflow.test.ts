import { describe, expect, test } from 'bun:test'
import {
  addMonths,
  baselineCandidates,
  buildSankey,
  daysInMonth,
  delta,
  destinationOf,
  legCategory,
  monthWindow,
  parseCashFlowFilter,
  selectLegs,
  summarizeMonth,
  type CashFlowFilter,
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

describe('month math', () => {
  test('addMonths crosses year boundaries both ways', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2025-12', 1)).toBe('2026-01')
    expect(addMonths('2026-09', -12)).toBe('2025-09')
  })

  test('daysInMonth handles leap February', () => {
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2026-09')).toBe(30)
  })

  test('the current UTC month is partial through today; others are whole', () => {
    const now = new Date('2026-09-29T20:00:00Z')
    expect(monthWindow('2026-09', now)).toMatchObject({ partial: true, daysElapsed: 29, daysInMonth: 30 })
    expect(monthWindow('2026-08', now)).toMatchObject({ partial: false, daysElapsed: 31, daysInMonth: 31 })
    const w = monthWindow('2026-12', new Date('2026-12-05T00:00:00Z'))
    expect([w.start.toISOString(), w.end.toISOString()]).toEqual(['2026-12-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'])
  })

  test('baseline candidates per compare mode', () => {
    const average = baselineCandidates('2026-03', 'average')
    expect(average).toHaveLength(12)
    expect([average[0], average.at(-1)]).toEqual(['2026-02', '2025-03'])
    expect(baselineCandidates('2026-01', 'previous')).toEqual(['2025-12'])
    expect(baselineCandidates('2026-01', 'last_year')).toEqual(['2025-01'])
  })

  test('delta has no change against a zero or missing baseline', () => {
    expect(delta(10, null)).toEqual({ baseline: null, change: null })
    expect(delta(10, 0)).toEqual({ baseline: 0, change: null })
    expect(delta(-30, -20)).toEqual({ baseline: -20, change: -0.5 })
  })
})

describe('legCategory', () => {
  test('a Fluide category wins over the bank tag', () => {
    expect(legCategory('Groceries', ['plaid:FOOD_AND_DRINK'])).toEqual({ category: 'Groceries', fromBank: false })
  })

  test('falls back to the humanised Plaid primary, marked fromBank', () => {
    expect(legCategory(null, ['other', 'plaid:FOOD_AND_DRINK'])).toEqual({ category: 'Food and drink', fromBank: true })
  })

  test('no category and no bank tag is Uncategorized', () => {
    expect(legCategory(null, null)).toEqual({ category: 'Uncategorized', fromBank: false })
  })
})

describe('destinationOf', () => {
  const pair = (kind: CashFlowLeg['markKind'], partner: CashFlowLeg['partner'], amount = -100) =>
    leg(amount, { markKind: kind, markMethod: 'pair_match', pairTransactionId: 'other', partner })

  test('classifies matched outflows by destination', () => {
    const none = new Set<string>()
    expect(destinationOf(pair('investment', { accountName: 'IRA', accountKind: 'investment', accountSubtype: 'ira' }), none)).toBe('invested')
    expect(destinationOf(pair('transfer', { accountName: 'CD', accountKind: 'cash', accountSubtype: 'cd' }), none)).toBe('savings')
    expect(destinationOf(pair('transfer', { accountName: 'MM', accountKind: 'cash', accountSubtype: 'Money Market' }), none)).toBe('savings')
    expect(destinationOf(pair('card_payment', { accountName: 'Card', accountKind: 'credit', accountSubtype: 'credit card' }), none)).toBe('card_payoffs')
    expect(destinationOf(pair('transfer', { accountName: 'Other checking', accountKind: 'cash', accountSubtype: 'checking' }), none)).toBe('between_accounts')
    expect(destinationOf(leg(-5, { markKind: 'transfer', markMethod: 'user' }), none)).toBe('between_accounts')
  })

  test('an inflow represents the movement only when its partner is out of scope', () => {
    const inflow = pair('transfer', { accountName: 'Checking', accountKind: 'cash', accountSubtype: 'checking' }, 100)
    expect(destinationOf(inflow, new Set(['other']))).toBeNull()
    expect(destinationOf(inflow, new Set())).toBe('between_accounts')
    const cardInflow = leg(80, { accountKind: 'credit', markKind: 'card_payment', markMethod: 'provider_tag' })
    expect(destinationOf(cardInflow, new Set())).toBe('card_payoffs')
  })

  test('counted legs have no destination', () => {
    expect(destinationOf(leg(-5, { markKind: 'transfer', markMethod: 'provider_tag' }), new Set())).toBeNull()
    expect(destinationOf(leg(-5, { markKind: 'loan_payment', markMethod: 'provider_tag' }), new Set())).toBeNull()
  })
})

function month() {
  const payers = [900, 50, 40, 30, 20, 10].map((amount, i) => leg(amount, { name: `payer ${i}` }))
  const refund = leg(15, { accountKind: 'credit', accountName: 'Card', name: 'Shop' })
  const spend = [300, 120, 90, 80, 60, 50, 40, 30, 20].map((amount, i) => leg(-amount, { category: `cat ${i}`, name: i < 2 ? 'Store' : `m${i}` }))
  const debt = leg(-45, { markKind: 'loan_payment', markMethod: 'provider_tag' })
  const possible = leg(-25, { markKind: 'transfer', markMethod: 'provider_tag', category: 'cat 0' })
  const toSavings = leg(-200, {
    markKind: 'transfer',
    markMethod: 'pair_match',
    pairTransactionId: 'savings-in',
    partner: { accountName: 'Savings', accountKind: 'cash', accountSubtype: 'savings' },
  })
  const savingsIn = leg(200, { transactionId: 'savings-in', accountName: 'Savings', markKind: 'transfer', markMethod: 'pair_match', pairTransactionId: toSavings.transactionId })
  const cardPayoff = leg(-500, { markKind: 'card_payment', markMethod: 'provider_tag', accountKind: 'credit' })
  return [...payers, refund, ...spend, debt, possible, toSavings, savingsIn, cardPayoff]
}

describe('summarizeMonth and buildSankey', () => {
  test('counts per the cash-flow rules', () => {
    const s = summarizeMonth(month(), 30)
    expect(s.moneyIn).toBe(1065)
    expect(s.refunds).toBe(15)
    expect(s.spending).toBe(815)
    expect(s.debtPayments).toBe(45)
    expect(s.moneyOut).toBe(860)
    expect(s.possible).toEqual({ count: 1, total: 25 })
    expect(s.destinations.savings).toEqual({ total: 200, count: 1, accounts: ['Checking', 'Savings'] })
    expect(s.destinations.card_payoffs.total).toBe(500)
    expect(s.destinations.between_accounts.count).toBe(0)
  })

  test('a surplus balances with Stayed in cash; top payers and categories fold into Other', () => {
    const sankey = buildSankey(summarizeMonth(month(), 30))
    const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0)
    expect(sankey.moneyIn).toBe(1065)
    expect(sum(sankey.sources)).toBeCloseTo(1065, 6)
    expect(sum(sankey.targets)).toBeCloseTo(1065, 6)
    expect(sankey.sources.map((s) => s.id)).toEqual(['source:payer 0', 'source:payer 1', 'source:payer 2', 'source:payer 3', 'source:payer 4', 'other_income', 'refunds'])
    expect(sankey.targets.find((t) => t.id === 'other_categories')).toMatchObject({ amount: 50, otherCount: 2 })
    expect(sankey.targets.find((t) => t.id === 'stayed_in_cash')?.amount).toBe(1065 - 815 - 45 - 200)
    expect(sankey.sources.some((s) => s.id === 'from_balance')).toBe(false)
  })

  test('a deficit balances with From your balances', () => {
    const sankey = buildSankey(summarizeMonth([leg(100), leg(-150, { category: 'Rent' }), leg(-30, { markKind: 'investment', markMethod: 'user' })], 30))
    expect(sankey.moneyIn).toBe(180)
    expect(sankey.sources.find((s) => s.id === 'from_balance')?.amount).toBe(80)
    expect(sankey.targets.map((t) => [t.id, t.amount])).toEqual([
      ['category:Rent', 150],
      ['notcounted:invested', 30],
    ])
  })
})

describe('drill-down tokens', () => {
  test('every token selects legs summing to the figure it drills into', () => {
    const legs = month()
    const s = summarizeMonth(legs, 30)
    const sankey = buildSankey(s)
    const node = (id: string) => [...sankey.sources, ...sankey.targets].find((n) => n.id === id)!.amount
    const cases: [string, number][] = [
      ['in', s.moneyIn],
      ['out', s.moneyOut],
      ['spending', s.spending],
      ['debt', s.debtPayments],
      ['refunds', s.refunds],
      ['other_income', node('other_income')],
      ['other_categories', node('other_categories')],
      ['possible', s.possible.total],
      ['notcounted:savings', s.destinations.savings.total],
      ['notcounted:card_payoffs', s.destinations.card_payoffs.total],
      ['category:cat 0', node('category:cat 0')],
      ['merchant:Store', s.merchants.find((m) => m.name === 'Store')!.amount],
      ['source:payer 1', node('source:payer 1')],
      ['largest', s.largest.reduce((a, l) => a + Math.abs(l.amount), 0)],
      ...s.dailyOut.map((amount, i): [string, number] => [`day:${i + 1}`, amount]),
    ]
    for (const [token, figure] of cases) {
      const selected = selectLegs(legs, s, parseCashFlowFilter(token) as CashFlowFilter)
      expect([token, selected.reduce((a, l) => a + Math.abs(l.amount), 0)]).toEqual([token, expect.closeTo(figure, 6)])
    }
  })

  test('rejects malformed tokens', () => {
    for (const token of ['', 'bogus', 'category:', 'notcounted:loans', 'day:0', 'day:32', 'day:1.5']) {
      expect(parseCashFlowFilter(token)).toBeNull()
    }
    expect(parseCashFlowFilter('merchant:A:B')).toEqual({ kind: 'merchant', value: 'A:B' })
  })
})
