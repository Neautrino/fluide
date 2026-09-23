# AGENTS.md

## Project overview
Fluide — self-hosted, read-only-forever finance SaaS. Bun + Turborepo monorepo:
`apps/server` (Hono API), `apps/web` (Vite + React + Tailwind v4), `packages/`
(shared eslint/tsconfig configs; `ledger`/`connectors` land as Slice 0 progresses).
Full architecture/roadmap: `/home/neautrino/Code/finance-saas-plan/PLAN.md` and
`vertical-slice-matrix.html` (interactive board, tracked separately from this repo).

## Commands
- Install: `bun install` (run at repo root)
- Dev (all apps): `bunx turbo run dev`
- Dev (server only): `cd apps/server && bun run --hot src/index.ts` (port 4000)
- Dev (web only): `cd apps/web && bun run dev` (port 3000)
- Typecheck a package: `bunx tsc --noEmit -p tsconfig.json` (run inside that app's dir)

## Source-of-truth file headers (non-negotiable for ledger/guardrail/secret-boundary files)
Any file that owns a source of truth, an architectural invariant, or a secret
boundary gets a header docstring before its first import, in this shape:

```
/** SOURCE OF TRUTH: <one line — what this file is the canonical owner of>
 * WHAT: <what this file does, concretely>
 * WHY: <the non-obvious reason it's built this way — the thing a reader
 * can't infer just from reading the code below>
 * WHERE: <the boundary — what this file owns vs. what it deliberately
 * does NOT own, so an agent doesn't duplicate logic elsewhere>
 */
```

This applies to: anything in `packages/ledger` (schema/migrations), anything
in `packages/guardrails`, connector adapters that touch access tokens/certs,
and any file where "don't touch this without understanding why" actually
matters. Skip it for boilerplate, pure UI components, and anything a linter
already documents. See `apps/server/src/plaid-client.ts`, `plaid-store.ts`,
`index.ts` for worked examples.

## Boundaries
### Always do
- Run `bunx tsc --noEmit` on any package you touch before considering it done.
- Read `PLAN.md` before inventing a new architectural pattern — this project
  has an unusually large amount of upfront research; check it isn't already decided.

### Ask first
- Adding a new connector provider (Teller, Enable Banking, Mono, Pluggy) —
  confirm which region/slice it's actually needed for first.
- Changing anything in `packages/ledger`'s balance/posting invariants once
  that package exists — these are the architectural guardrails, not casual code.

### Never do
- Commit `.env`, `.pem` files, or any Plaid/Teller/bank credential — already
  gitignored, keep it that way.
- Return an `access_token` (Plaid) or private key (Teller/mTLS) to `apps/web`
  or to any LLM tool call. These stay server-side, referenced by opaque ids only.
- Add a payment-initiation or write-to-bank code path. Read-only forever — see
  PLAN.md principle #1. This is an intelligence/record-keeping layer, not a bank.
