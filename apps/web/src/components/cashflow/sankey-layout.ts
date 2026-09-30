import type { CashFlow } from '../../lib/api'

type SankeyData = CashFlow['sankey']
export type Source = SankeyData['sources'][number]
export type Target = SankeyData['targets'][number]
export type Group = Target['group']
export type Box = { y: number; h: number }
export type RibbonEnd = { trunk: number; node: number; w: number }

export const GROUPS: Group[] = ['spending', 'debt', 'kept']
const MIN_NODE = 3
const MIN_RIBBON = 1

/** Largest first; "from balance" last on the left. */
export function orderSources(sources: Source[]): Source[] {
  return sources
    .filter((s) => s.amount > 0)
    .sort((a, b) => Number(a.kind === 'from_balance') - Number(b.kind === 'from_balance') || b.amount - a.amount)
}

/** By group, largest first within one; "Other (n)" last among spending, "Stayed in cash" last among kept. */
export function orderTargets(targets: Target[]): Target[] {
  return targets
    .filter((t) => t.amount > 0)
    .sort(
      (a, b) =>
        GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
        Number(a.kind === 'other_categories') - Number(b.kind === 'other_categories') ||
        Number(a.kind === 'stayed_in_cash') - Number(b.kind === 'stayed_in_cash') ||
        b.amount - a.amount,
    )
}

type Spacing = {
  /** Least gap between nodes of one group. */
  gap: number
  /** Gap between groups. */
  groupGap: number
  /** Least distance between the centres of neighbouring nodes in one group, so their labels sit level with them. */
  pitch: number
}

function stackAt(targets: Target[], k: number, top: number, { gap, groupGap, pitch }: Spacing): Box[] {
  let y = top
  let prev: Box | null = null
  return targets.map((t, i) => {
    const h = Math.max(t.amount * k, MIN_NODE)
    if (prev) y += t.group !== targets[i - 1].group ? groupGap : Math.max(gap, pitch - (prev.h + h) / 2)
    const box = { y, h }
    y += h
    prev = box
    return box
  })
}

/** Stacks the ordered targets top-down with the largest amount scale `k` (px per unit) that fits `avail`. */
export function stackTargets(targets: Target[], top: number, avail: number, spacing: Spacing): { k: number; nodes: Box[] } {
  const total = targets.reduce((sum, t) => sum + t.amount, 0)
  const extent = (k: number) => {
    const nodes = stackAt(targets, k, top, spacing)
    const last = nodes.at(-1)
    return last ? last.y + last.h - top : 0
  }
  // Extent only grows with k (a pitch gap shrinks by half of what its two nodes grow), so bisect.
  let lo = 0
  let hi = total > 0 ? avail / total : 0
  if (extent(hi) <= avail) lo = hi
  else
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (extent(mid) <= avail) lo = mid
      else hi = mid
    }
  return { k: lo, nodes: stackAt(targets, lo, top, spacing) }
}

/** Where each ribbon meets the trunk and its node, for nodes in stacking order: ribbon `i`
 * takes the next slice of the trunk from `trunkTop`, so ribbons never cross. */
export function ribbonEnds(amounts: number[], nodes: Box[], trunkTop: number, k: number): RibbonEnd[] {
  let y = trunkTop
  return amounts.map((v, i) => {
    const w = Math.max(v * k, MIN_RIBBON)
    const end = { trunk: y, node: nodes[i].y + (nodes[i].h - w) / 2, w }
    y += v * k
    return end
  })
}
