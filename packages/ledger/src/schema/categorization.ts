import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  bigint,
  boolean,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { categories } from './categories.js'
import { postings } from './ledger.js'

export const reviewQueueStatus = pgEnum('review_queue_status', [
  'pending',
  'approved',
  'rejected',
])

export const jevConfidenceBand = pgEnum('jev_confidence_band', ['high', 'medium', 'low'])

export const auditLogAction = pgEnum('audit_log_action', [
  'auto_applied',
  'queued_for_review',
  'approved',
  'rejected',
  'recategorized',
])

export const categorizationRuleStatus = pgEnum('categorization_rule_status', ['proposed', 'active', 'rejected'])

/**
 * categorization_rules — deterministic pattern → category (S1-2), checked
 * before any AI fallback (S1-3) so known vendors cost zero AI calls.
 * `confidenceLearned`/`timesMatched` let an accepted AI categorization
 * become a permanent rule instead of a one-off relabel. `isUserCustom`
 * rules always win over system-learned ones on the same posting.
 * `status`: only 'active' rules are ever matched. A rule learned from a
 * human approval/recategorize starts 'proposed' and does nothing until the
 * user activates it (PLAN.md §5.2: the loop that turns corrections into an
 * auto-rule is itself reviewed before it changes future behavior).
 */
export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    pattern: text('pattern').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    isUserCustom: boolean('is_user_custom').notNull().default(true),
    confidenceLearned: numeric('confidence_learned', { precision: 4, scale: 3 }),
    timesMatched: integer('times_matched').notNull().default(0),
    status: categorizationRuleStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('categorization_rules_tenant_idx').on(table.tenantId),
    index('categorization_rules_pattern_idx').on(table.pattern),
  ],
)

/**
 * review_queue — S1-4's confidence gate output for Tier 2 (Jev) matches that
 * did not clear the auto-apply checklist (confidence + vendor seen 3+
 * times + amount in the historical range for that vendor/category pair).
 * `postings.categoryId` is left NULL for these — the suggestion lives only
 * here until a human approves/rejects it (S1-5 UI). Approving writes
 * `postings.categoryId` through the normal update path; rejecting never
 * writes it at all. Every row is a record of a tier that almost applied
 * but didn't — same "never silently guess" principle as S0-4/S1-2/S1-3.
 */
export const reviewQueue = pgTable(
  'review_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postingId: uuid('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    suggestedCategoryId: uuid('suggested_category_id').references(() => categories.id, { onDelete: 'restrict' }),
    confidenceBand: jevConfidenceBand('confidence_band').notNull(),
    source: text('source').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    status: reviewQueueStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('review_queue_status_idx').on(table.status),
    index('review_queue_posting_idx').on(table.postingId),
  ],
)

/**
 * audit_log — one row per categorization decision, no exceptions (S1-6).
 * Every path that touches postings.categoryId writes here: Tier 1 rule
 * apply, gate auto-apply, gate reject-to-queue, a human's approve/reject
 * on a queued item, and a human's manual recategorize. This is a record of
 * decisions, not of end state — postings.categoryId alone cannot answer
 * "why was this categorized this way, by what, at what confidence."
 * `txId` is the writing DB transaction's id; migration 0004's deferred
 * trigger uses it to refuse any postings.category_id change that has no
 * matching audit row written in the same transaction. Append-only by
 * convention (no code path updates or deletes a row).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postingId: uuid('posting_id')
      .notNull()
      .references(() => postings.id, { onDelete: 'cascade' }),
    action: auditLogAction('action').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    source: text('source').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    reason: text('reason').notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    txId: bigint('tx_id', { mode: 'number' })
      .notNull()
      .default(sql`txid_current()`),
  },
  (table) => [
    index('audit_log_posting_idx').on(table.postingId),
    index('audit_log_created_idx').on(table.createdAt),
  ],
)

/** The gate's defaults when a tenant has never saved settings. The column
 * defaults below are derived from this, so there is one place to change. */
export const GATE_SETTINGS_DEFAULTS = {
  highConfidence: 0.75,
  lowConfidence: 0.5,
  minVendorOccurrences: 3,
  amountRangeTolerance: 0.5,
} as const

/**
 * gate_settings — the confidence gate's thresholds, one row per tenant
 * (PLAN.md §5.2: thresholds are visible and admin-configurable, not hidden
 * constants). No row = GATE_SETTINGS_DEFAULTS; the Settings screen upserts
 * it. CHECKs keep the bands coherent so a bad save can't e.g. put the
 * review band above the auto-apply band.
 */
export const gateSettings = pgTable(
  'gate_settings',
  {
    tenantId: uuid('tenant_id').primaryKey(),
    highConfidence: numeric('high_confidence', { precision: 4, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.highConfidence.toFixed(3)),
    lowConfidence: numeric('low_confidence', { precision: 4, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.lowConfidence.toFixed(3)),
    minVendorOccurrences: integer('min_vendor_occurrences')
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.minVendorOccurrences),
    amountRangeTolerance: numeric('amount_range_tolerance', { precision: 6, scale: 3 })
      .notNull()
      .default(GATE_SETTINGS_DEFAULTS.amountRangeTolerance.toFixed(3)),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('gate_settings_confidence_bands', sql`0 <= ${table.lowConfidence} AND ${table.lowConfidence} < ${table.highConfidence} AND ${table.highConfidence} <= 1`),
    check('gate_settings_min_vendor_occurrences', sql`${table.minVendorOccurrences} >= 1`),
    check('gate_settings_amount_range_tolerance', sql`${table.amountRangeTolerance} >= 0`),
  ],
)
