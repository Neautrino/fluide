/** SOURCE OF TRUTH: the ledger's schema — the double-entry core (accounts,
 * transactions, postings, balance_assertions) plus Slice 1's categorization
 * tables (categories, categorization_rules, review_queue, audit_log).
 * WHAT: barrel over the Drizzle table definitions (PLAN.md §2) plus
 * provider_credentials — app-level connector API credentials (Plaid
 * client_id/secret, Enable Banking app_id + key path), entered via Settings
 * and AES-256-GCM-encrypted before they reach a row (apps/server's
 * vault.ts). PLAN.md's own `connectors` table (per-connection OAuth tokens)
 * is still not modeled — connection-store.ts still owns that (ADR 009).
 * WHY: one entry point, so db.ts's `import * as schema` and drizzle.config.ts
 * see every table. ledger.ts carries the posting invariants.
 * WHERE: this folder owns table SHAPE only. The sum-to-zero rule and posting
 * immutability are hand-written trigger SQL in migrations/0001 — Drizzle's
 * schema DSL can't express them, and schema alone does not stop bad writes.
 */
export * from './ledger.js'
export * from './categories.js'
export * from './categorization.js'
export * from './credentials.js'
