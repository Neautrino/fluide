import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * categories — the categorization taxonomy (S1-1). `tenantId IS NULL` =
 * shared system category (seeded, is_system = true); `tenantId IS NOT NULL`
 * = a tenant's own custom category, layered on top. `detailed` matches
 * Plaid PFCv2 identifiers verbatim (e.g. "FOOD_AND_DRINK_GROCERIES") so a
 * future Plaid connector maps onto it with no translation table.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    primary: text('primary').notNull(),
    detailed: text('detailed').notNull(),
    label: text('label').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categories_tenant_idx').on(table.tenantId),
    index('categories_primary_idx').on(table.primary),
    uniqueIndex('categories_system_detailed_unique_idx')
      .on(table.detailed)
      .where(sql`${table.tenantId} IS NULL`),
    uniqueIndex('categories_tenant_detailed_unique_idx')
      .on(table.tenantId, table.detailed)
      .where(sql`${table.tenantId} IS NOT NULL`),
  ],
)
