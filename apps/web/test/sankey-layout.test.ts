import { describe, expect, test } from 'bun:test'
import { orderTargets, ribbonEnds, stackTargets, type Target } from '../src/components/cashflow/sankey-layout.ts'

const target = (label: string, amount: number, group: Target['group'], kind: Target['kind'] = 'category'): Target => ({
  id: label,
  label,
  amount,
  group,
  kind,
})
const spacing = { gap: 12, groupGap: 36, pitch: 20 }

/** Two ribbons from one trunk to one column cross iff their order on the trunk differs from their order at the nodes. */
function expectNoCrossing(ends: { trunk: number; node: number }[]) {
  for (let i = 1; i < ends.length; i++) {
    expect(ends[i].trunk).toBeGreaterThan(ends[i - 1].trunk)
    expect(ends[i].node).toBeGreaterThan(ends[i - 1].node)
  }
}

describe('Sankey target ribbons', () => {
  // A surplus month: the largest target ("Stayed in cash") is laid out last.
  const targets = orderTargets([
    target('Stayed in cash', 5000, 'kept', 'stayed_in_cash'),
    target('Rent', 1500, 'spending'),
    target('Groceries', 400, 'spending'),
    target('Other (3)', 900, 'spending', 'other_categories'),
    target('Invested', 1200, 'kept', 'invested'),
    target('Debt payments', 250, 'debt', 'debt_payments'),
  ])
  const { k, nodes } = stackTargets(targets, 48, 428, spacing)
  const ends = ribbonEnds(
    targets.map((t) => t.amount),
    nodes,
    100,
    k,
  )

  test('orders targets by group, so the largest (kept) target comes last', () => {
    expect(targets.map((t) => t.label)).toEqual(['Rent', 'Groceries', 'Other (3)', 'Debt payments', 'Invested', 'Stayed in cash'])
  })

  test('ribbons leave the trunk in the same order they reach their nodes', () => {
    expectNoCrossing(ends)
  })

  test('trunk slices tile the trunk exactly', () => {
    const total = targets.reduce((s, t) => s + t.amount, 0)
    ends.forEach((e, i) => expect(e.trunk).toBeCloseTo(100 + targets.slice(0, i).reduce((s, t) => s + t.amount, 0) * k, 6))
    const last = ends.at(-1)!
    expect(last.trunk + targets.at(-1)!.amount * k).toBeCloseTo(100 + total * k, 6)
  })
})

describe('stackTargets', () => {
  test('fits the column even when many targets are drawn at the minimum height', () => {
    const targets = orderTargets([
      target('Big', 10000, 'spending'),
      ...Array.from({ length: 8 }, (_, i) => target(`Tiny ${i}`, 1 + i, 'spending')),
      target('Debt payments', 2, 'debt', 'debt_payments'),
    ])
    const { nodes } = stackTargets(targets, 48, 428, spacing)
    const last = nodes.at(-1)!
    expect(last.y + last.h).toBeLessThanOrEqual(48 + 428 + 1e-6)
    expect(nodes[0].y).toBe(48)
  })

  test('keeps neighbouring nodes of one group a label pitch apart, centre to centre', () => {
    const targets = orderTargets([target('Big', 10000, 'spending'), target('Small A', 20, 'spending'), target('Small B', 10, 'spending')])
    const { nodes } = stackTargets(targets, 48, 428, spacing)
    for (let i = 1; i < nodes.length; i++) {
      const pitch = nodes[i].y + nodes[i].h / 2 - (nodes[i - 1].y + nodes[i - 1].h / 2)
      expect(pitch).toBeGreaterThanOrEqual(spacing.pitch - 1e-6)
    }
  })

  test('separates groups by the group gap', () => {
    const targets = orderTargets([target('Rent', 1000, 'spending'), target('Stayed in cash', 1000, 'kept', 'stayed_in_cash')])
    const { nodes } = stackTargets(targets, 48, 428, spacing)
    expect(nodes[1].y - (nodes[0].y + nodes[0].h)).toBeCloseTo(spacing.groupGap, 6)
  })
})
