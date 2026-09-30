import type { CashFlow } from '../../lib/api'

type Category = CashFlow['categories'][number]
export type Mover = Category & { baseline: number; diff: number }

/** Categories that differ from their baseline by a whole unit or more, biggest change first. */
export function biggestMovers(categories: Category[]): Mover[] {
  return categories
    .flatMap((c) => (c.baseline !== null && Math.abs(c.amount - c.baseline) >= 1 ? [{ ...c, baseline: c.baseline, diff: c.amount - c.baseline }] : []))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

/** The category that grew most against its baseline, if any grew. */
export function topRiser(categories: Category[]): Mover | null {
  return biggestMovers(categories).find((m) => m.diff > 0) ?? null
}
