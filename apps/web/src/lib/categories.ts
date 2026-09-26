import { getJson, type Category } from './api'
import { humanizeKey } from './format'
import { useResource } from './useResource'

let cached: Promise<Category[]> | null = null

function loadCategories(): Promise<Category[]> {
  if (!cached) {
    cached = getJson<{ categories: Category[] }>('/api/ledger/categories').then(
      (r) => r.categories ?? [],
      (e: unknown) => {
        cached = null
        throw e
      },
    )
  }
  return cached
}

export type CategoryGroup = { primary: string; label: string; categories: Category[] }

export type CategoryCatalogue = {
  list: Category[]
  byId: Record<string, Category>
  groups: CategoryGroup[]
}

function buildCatalogue(list: Category[]): CategoryCatalogue {
  const byId: Record<string, Category> = {}
  const groupsByPrimary: Record<string, CategoryGroup> = {}
  const groups: CategoryGroup[] = []
  for (const c of list) {
    byId[c.id] = c
    let g = groupsByPrimary[c.primary]
    if (!g) {
      g = { primary: c.primary, label: humanizeKey(c.primary), categories: [] }
      groupsByPrimary[c.primary] = g
      groups.push(g)
    }
    g.categories.push(c)
  }
  groups.sort((a, b) => a.label.localeCompare(b.label))
  for (const g of groups) g.categories.sort((a, b) => a.label.localeCompare(b.label))
  return { list, byId, groups }
}

export function useCategories() {
  return useResource(() => loadCategories().then(buildCatalogue))
}

/** Label for a category reference that may be an id, a `detailed` key or already a label. */
export function categoryName(catalogue: CategoryCatalogue | undefined, ref: string): string {
  const byId = catalogue?.byId[ref]
  if (byId) return byId.label
  const byDetailed = catalogue?.list.find((c) => c.detailed === ref)
  if (byDetailed) return byDetailed.label
  return /^[A-Z0-9_]+$/.test(ref) ? humanizeKey(ref) : ref
}
