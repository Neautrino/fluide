/** SOURCE OF TRUTH: every read-only ledger query — the one service layer
 * both the HTTP routes and the chat agent's tools call (PLAN.md §3).
 * WHAT: deterministic Drizzle reads and aggregates -- no AI involved
 * anywhere here, and no writes.
 * WHY: PLAN.md §3 requires the AI tool surface to be a thin wrapper over
 * the same service layer the web UI uses, so a human and the chat model
 * can never see two different answers for the same question. The chat
 * model only ever picks which function to call and narrates the result;
 * it never computes a number itself (Tier 1, no gate needed).
 * WHERE: owns reads only. Writes live with their owning engine in
 * apps/server (ingest.ts, categorization/, review.ts). Aggregates filter to
 * accounts.type = 'asset' to exclude the equity suspense leg every
 * transaction also has; listTransactionsWithPostings deliberately does not.
 */
export { PERIODS, type Period } from './period.js'
export * from './spending.js'
export * from './accounts.js'
export * from './transactions.js'
export * from './categorization.js'
