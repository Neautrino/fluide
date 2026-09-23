/** SOURCE OF TRUTH: seeds category_anchors from the categories table (S1-3
 * Tier 2 cold start). One-time/idempotent script, not an HTTP route --
 * run manually after any new categories are seeded.
 * WHAT: embeds each category's human label (and detailed-id words) as an
 * anchor phrase, so Tier 2 has something to compare against even for a
 * brand-new tenant with zero categorized history.
 * WHERE: run with `bun run src/seed-anchors.ts` from apps/server.
 */
import { db, categories, categoryAnchors } from '@repo/ledger'
import { embedBatch } from './embeddings.js'

async function main() {
  const cats = await db.select().from(categories)
  const existing = await db.select({ categoryId: categoryAnchors.categoryId }).from(categoryAnchors)
  const alreadySeeded = new Set(existing.map((e) => e.categoryId))

  const toSeed = cats.filter((c) => !alreadySeeded.has(c.id))
  if (toSeed.length === 0) {
    console.log('All categories already have anchors, nothing to do.')
    return
  }

  const anchorTexts = toSeed.map((c) => `${c.label} ${c.detailed.replace(/_/g, ' ')}`)
  const vectors = await embedBatch(anchorTexts)

  for (let i = 0; i < toSeed.length; i++) {
    const cat = toSeed[i]
    const anchorText = anchorTexts[i]
    const embedding = vectors[i]
    if (!cat || !anchorText || !embedding) continue
    await db.insert(categoryAnchors).values([
      {
        categoryId: cat.id,
        anchorText,
        embedding,
      },
    ])
  }

  console.log(`Seeded ${toSeed.length} category anchors.`)
}

main().then(() => process.exit(0))
