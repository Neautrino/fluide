import { describe, expect, test } from 'bun:test'
import { sliceColors, type Slice } from '../src/components/overview/model.ts'

const slice = (label: string, amount: number, extra: Partial<Slice> = {}): Slice => ({ label, amount, uncategorized: false, riser: false, ...extra })
const colorsOf = (slices: Slice[]) => {
  const colors = sliceColors(slices)
  return slices.map((s) => `${s.label}:${colors.get(s)}`)
}

describe('sliceColors', () => {
  test('riser is black; other named categories take the palette biggest first, skipping the riser', () => {
    const slices = [slice('Rent', 1850), slice('Shopping', 581.9, { riser: true }), slice('Groceries', 572.82), slice('Utilities', 246.31)]
    expect(colorsOf(slices)).toEqual(['Rent:chart-2', 'Shopping:chart-1', 'Groceries:chart-3', 'Utilities:chart-4'])
  })

  test('slices folded into "N more" and uncategorized money stay grey', () => {
    const slices = [
      slice('Rent', 1850),
      slice('Shopping', 581.9, { riser: true }),
      slice('Groceries', 572.82),
      slice('Utilities', 246.31),
      slice('Dining', 245.52),
      slice('Gym & Fitness', 185),
      slice('Uncategorized', 24.6, { uncategorized: true }),
    ]
    expect(colorsOf(slices)).toEqual([
      'Rent:chart-2',
      'Shopping:chart-1',
      'Groceries:chart-3',
      'Utilities:chart-4',
      'Dining:chart-muted',
      'Gym & Fitness:chart-muted',
      'Uncategorized:chart-muted',
    ])
  })

  test('five unfolded categories without a riser use the whole palette', () => {
    const slices = ['A', 'B', 'C', 'D', 'E'].map((l, i) => slice(l, 100 - i))
    expect(colorsOf(slices)).toEqual(['A:chart-2', 'B:chart-3', 'C:chart-4', 'D:chart-5', 'E:chart-6'])
  })
})
