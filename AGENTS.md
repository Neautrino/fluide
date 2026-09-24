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
- Return a Plaid `access_token` or a Teller/mTLS private key to `apps/web` or to
  any LLM tool call. They stay server-side, referenced by opaque ids.
- Add a payment-initiation or write-to-bank code path (PLAN.md principle #1).

## Source-of-truth file headers
Files that own a source of truth, an architectural invariant, or a secret
boundary get this header before the first import:

```
/** SOURCE OF TRUTH: <one line — what this file is the canonical owner of>
 * WHAT: <what this file does, concretely>
 * WHY: <the non-obvious reason it's built this way>
 * WHERE: <what this file owns vs. deliberately does NOT own>
 */
```

Applies to `packages/ledger` (schema, migrations — guardrails live in its SQL
migrations), connector adapters that touch access tokens/certs, and any file
where "don't touch this without understanding why" matters. Skip boilerplate and
pure UI components. Examples: `packages/connectors/src/plaid-client.ts`,
`apps/server/src/plaid-store.ts`, `apps/server/src/index.ts`.

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
