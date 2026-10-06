# Contributing to Fluide

Thanks for helping. Fluide is a self-hosted, read-only personal finance app; these
notes keep changes consistent with what it promises its users.

## Before you start

- **Small fixes** (typos, an obvious bug with a clear fix): open a pull request.
- **Features and larger changes**: open an issue first, so we agree on the approach
  before you write the code.

Open an issue first, and expect a discussion, for anything that touches these:

- **Read-only, forever.** Fluide never moves money. Pull requests that add payments
  or any other write to a bank will be declined. The Enable Banking adapter allows
  read endpoints only; keep it that way.
- **Credentials stay on the server.** A Plaid `access_token`, an Enable Banking
  session or private key, or any other bank credential is never sent to the web app
  or to an AI model. Code refers to them by opaque ids.
- **Ledger guarantees.** Changes to how `packages/ledger` stores postings and
  balances, or to the migrations that enforce its rules, need agreement first.
- **New bank providers** (Teller, Mono, Pluggy, …): say which region they are for.

## Set up

You need Docker and [Bun](https://bun.sh).

```sh
docker compose -f docker-compose.dev.yml up -d postgres   # development database on 127.0.0.1:5433
cd packages/ledger && bun run db:migrate && cd ../..      # create its schema
bun install && bunx turbo run dev                         # web on :3000, API on :4000
```

Development always uses Plaid's sandbox, so you only need sandbox keys. The README's
[Development](README.md#development) section has the details, including running the
dev servers in Docker too.

## Before you open a pull request

Run, in each package you changed:

```sh
bunx tsc --noEmit -p tsconfig.json   # type check
bun test                             # in packages that have tests
bun run lint                         # from the repo root
bun scripts/check-headers.ts         # from the repo root
```

In the pull request, say what you changed and how you checked it: the commands you
ran, and screenshots for anything visible in the app or on the site.

## Commits

- Use the repository's style: `type(scope): what changed`, for example
  `fix(web): …`, `feat(ledger): …`, `docs: …`.
- One logical change per commit.
- Never commit `.env` files, `.pem` keys, or any Plaid or bank credential.

## Using an AI coding agent

Welcome. [`AGENTS.md`](AGENTS.md) holds the rules the agent must follow, and you are
responsible for what it produces.

## Releases

Contributors don't create tags or releases. Merged changes ship in the next release
the maintainer publishes.

## License

Fluide is licensed under the [GNU AGPL-3.0](LICENSE) (`AGPL-3.0-only`). By opening a
pull request you agree that your contribution is licensed under the same terms.

## Security

Never report a vulnerability in a public issue. [`SECURITY.md`](SECURITY.md) explains
how to report it privately and what is in scope.
