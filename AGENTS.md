# AGENTS.md

Fluide: self-hosted, read-only-forever finance SaaS (Bun + Turborepo; `apps/server`
Hono API, `apps/web` Vite + React, `packages/ledger`, `packages/connectors`).
Architecture and roadmap: `/home/neautrino/Code/finance-saas-plan/PLAN.md` and
`vertical-slice-matrix.html` (tracked outside this repo).

## IMPORTANT: Change protocol (every change, every agent)
Read-only work needs no approval: reading files, searching, non-mutating queries
and curls. Everything else does: code, config, dependencies, migrations, DB rows,
docs, git, memory files.
1. Investigate read-only first. Reproduce a bug before proposing a fix.
2. Propose, then STOP and wait. A proposal states: the problem with evidence; the
   exact files/symbols to change; the approach and the alternative rejected (why);
   related issues found (listed, not fixed); how the change will be verified.
3. Implement only after an explicit "yes", and only what was approved.
   "Fix X" names the task; it does not approve an approach.
4. Scope changes mid-work (extra file, extra fix, different approach): stop and
   re-propose.
5. Verify by running the changed path; report the command and its actual output.
6. Never commit, push, or start/stop dev servers without an explicit go-ahead.

## Boundaries
### Always
- Run `bunx tsc --noEmit -p tsconfig.json` in every package you touched.
- Read `PLAN.md` before introducing an architectural pattern; it may already be decided.
- Test writes on a scratch DB only (recipe below). Never send a real id to a write route.

### Ask first (beyond the change protocol, these also need a region/slice justification)
- Adding a connector provider (Teller, Enable Banking, Mono, Pluggy): confirm
  which region/slice needs it.
- Changing `packages/ledger` balance/posting invariants or its guardrail migrations.

### Never
- Commit `.env`, `.pem`, or any Plaid/Teller/bank credential.
- Return a Plaid `access_token`, an Enable Banking `session_id` or private key,
  or a Teller/mTLS private key to `apps/web` or to any LLM tool call. They stay
  server-side (`apps/server/src/connection-store.ts`, key file outside the repo),
  referenced by opaque ids.
- Add a payment-initiation or write-to-bank code path (PLAN.md principle #1).
  Enable Banking sandbox apps have payments switched on; its adapter allowlists
  read endpoints only — keep it that way.

## Source-of-truth file headers
A file gets a header only if it (1) is the single owner of a table, secret or
decision (a second copy elsewhere would be a bug), (2) relies on a rule the code,
types and DB constraints can't show, or (3) is a security boundary (credentials,
tokens, keys, read-only-bank). Never on UI components, views, barrels, simple
helpers, tests, seed data, or files whose name already says what they do.

Put it before the first import, with `/*`, not `/**`: tsserver attaches a `/**`
block to the next declaration, so the file header shows up as that symbol's hover.

```
/* SOURCE OF TRUTH: <what this file owns, one line, <=100 chars>
 * Invariant: <rule not visible in code>. Enforced by: <real migration/test/check>.
 * Never: <security boundary>.
 * See: <ADR id> — <why you'd read it>
 */
```

First line required; others only if true; max 4 content lines. SQL: same fields as
`--` lines. No WHAT/WHY/WHERE, caller lists, history, status, dates or slice ids.
A rule about one symbol → 1–3 line JSDoc on it; rationale → an ADR.
Examples: `apps/server/src/vault.ts`, `packages/connectors/src/errors.ts`.
Check: `bun scripts/check-headers.ts` (a new header file must be added to its list).

## Commands
- Install: `bun install` (repo root)
- Dev, all apps: `bunx turbo run dev` — server :4000 (`bun run --hot src/index.ts`
  in `apps/server`), web :3000 (`bun run dev` in `apps/web`). The user runs these.
- Scratch DB for write tests:
  ```
  docker exec fluide-postgres createdb -U fluide fluide_smoke
  cd packages/ledger && DATABASE_URL=postgres://fluide:fluide_dev_only@localhost:5433/fluide_smoke bun run db:migrate
  docker exec fluide-postgres dropdb -U fluide fluide_smoke   # when done
  ```
