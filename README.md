# Fluide

Fluide is a self-hosted, read-only personal finance app. It links US banks
through [Plaid](https://plaid.com) with read-only access, imports accounts and
transactions into a local Postgres ledger, and categorizes them.

Fluide never moves money: the only Plaid product it requests is Transactions.
European banks (via Enable Banking) are not available yet.

## Requirements

- Docker Engine 28.3.3 or newer, with Docker Compose v2 (`docker compose`).
- A Plaid account and its API keys. Each installation brings its own keys.
  Fluide uses Plaid's production environment (real banks) by default, which
  requires Plaid's approval of your Plaid account. To try it with Plaid's test
  banks, set `PLAID_ENV=sandbox` in `.env` and use your sandbox keys.

## Install and run

```sh
git clone https://github.com/Neautrino/fluide.git
cd fluide
cp .env.example .env   # optional: set PLAID_ENV
docker compose up -d --build
```

Open http://localhost:8080, then:

1. Go to **Settings -> Provider keys** and enter your Plaid client id and secret.
2. Click **Connect US bank** and link an account through Plaid.
3. Optional: in **Settings -> Assistant**, pick a categorization model (Jev via
   TypeSafe, OpenCode Zen, OpenRouter or another Jev host) and a chat model (OpenAI,
   Claude, Gemini, OpenCode Zen, OpenRouter or any OpenAI-compatible server,
   such as a local Ollama) and test each connection.

`PLAID_ENV` in `.env` selects the Plaid environment (`production`, the default,
or `sandbox`) and must match the keys you enter.

### What happens on first start

1. `secrets-init` generates the Postgres superuser password, the app's database
   password and a 32-byte vault key, each into its own volume (`pg_super`,
   `pg_app`, `vault`). Existing secrets are never overwritten.
2. `db` (Postgres 17) creates the `fluide` database in the `pgdata` volume.
3. `migrate` applies the database migrations and creates or updates the
   non-superuser role `fluide_app` that the app connects as. It runs on every
   start and does nothing when the schema is already current.
4. `app` starts once `migrate` has succeeded and serves the web app and the API
   on http://localhost:8080.

You never create or type these secrets yourself.

### Update

```sh
git pull && docker compose up -d --build
```

Migrations for the new version run automatically before the app starts.

When a newer release is published, Settings → General shows "Update available"
with a link to the release notes and this command to copy. Fluide never
updates itself.

### Stop

```sh
docker compose down
```

Your data stays in the Docker volumes and is there on the next `docker compose up -d`.

> **Warning:** `docker compose down -v` deletes the volumes: the database
> **and** the vault key. Without a backup (see below) everything is gone.

## Security model

- The app is published on `127.0.0.1:8080` only, so it is reachable from the
  machine it runs on, not from your network.
- Postgres is not published at all; it sits on an internal Docker network. The
  app connects as `fluide_app`, a role without superuser, create-database or
  create-role rights. The app never connects as the Postgres superuser; only
  `migrate` does.
- Bank access tokens and provider keys (Plaid client id and secret) are
  encrypted at rest with AES-256-GCM. The vault key lives in its own volume
  (`vault`), separate from the database volume.
- The server rejects requests whose `Host` header is not an allowed host
  (protection against DNS rebinding) and refuses cross-site write requests.
- The app container runs as a non-root user with a read-only filesystem and
  no Linux capabilities.
- **There is no login yet.** Anyone and any program that can reach
  `localhost:8080` on that machine can use Fluide. Do not expose or forward the
  port.
- LAN and remote access are not supported yet. `FLUIDE_ALLOWED_HOSTS` (extra
  hostnames to accept in the `Host` header) exists only for advanced setups
  behind your own reverse proxy that does the authentication.

## What leaves your machine

| Recipient | When | What |
|---|---|---|
| Plaid | Always, when you link or sync a bank | Requests made with your Plaid keys; Plaid returns your bank accounts and transactions. |
| The categorization model you pick in Settings -> Assistant (TypeSafe, OpenCode Zen, OpenRouter or your own Jev host) | Only when a categorization model is set up and you run categorization, or press Test | The description text of transactions that no categorization rule matched, and your category names. Test sends 25 made-up descriptions instead. |
| The chat model you pick in Settings -> Assistant (OpenAI, Anthropic, Google, OpenCode Zen, OpenRouter or the OpenAI-compatible server you enter) | Only when a chat model is set up and you use the Assistant, or press Test | Your question and the results of the read-only ledger queries the Assistant runs, such as account balances, account masks and up to 50 transactions per query. A local server (for example Ollama on localhost) keeps this on your machine. |
| The provider of the model list you load in Settings -> Assistant | Only when you press Load models | A request for the provider's model list, with your key. |
| LangSmith | Only if you set LangChain/LangSmith tracing environment variables (for example `LANGSMITH_TRACING` and `LANGSMITH_API_KEY`) | Traces of Assistant runs. |
| GitHub (api.github.com) | At most once a day, when you open Settings, unless `FLUIDE_UPDATE_CHECK=off` | A request for the latest Fluide release. GitHub sees your IP address and the User-Agent `fluide/<version>`; nothing else is sent. |

Nothing else is sent anywhere.

## Backups

A usable backup needs **both** the database and the vault key. The database
holds bank connections and provider keys only in encrypted form; without the
matching vault key they cannot be decrypted, and you would have to enter your
Plaid keys again and re-link every bank. Keep the two files apart: the vault
key decrypts the secrets in the database dump.

Back up while the database is running (`docker compose up -d` or
`docker compose up -d --wait db`):

```sh
docker compose exec -T db pg_dump -U postgres fluide > fluide.sql
docker compose run --rm --no-deps -T --entrypoint cat secrets-init /secrets/vault/key > vault.key
```

The second command reads the key from the `vault` volume through the
`secrets-init` container; inside `app` the same file is `/run/fluide/vault/key`.

### Restore

On a fresh checkout, before running a full `docker compose up -d`:

```sh
docker compose up -d --wait db
docker compose run --rm --no-deps -T --entrypoint sh secrets-init -c 'cat > /secrets/vault/key' < vault.key
docker compose exec -T db psql -U postgres -d fluide < fluide.sql
docker compose up -d
```

1. Start only `db`. This runs `secrets-init` first, which creates new
   passwords and a new vault key, and an empty `fluide` database.
2. Replace the new vault key with your backed-up one.
3. Load the dump into the empty database. Errors about the role `fluide_app`
   not existing are expected: the next step creates it.
4. Start everything. `migrate` finds the schema already current, creates
   `fluide_app` with the new password and grants its permissions.

If the installation has already been started, the database is no longer empty;
run `docker compose down -v` first (this deletes its current data and vault key).

## Development

Development uses its own Compose file, `docker-compose.dev.yml` (project
`fluide-dev`). It runs a development Postgres (`postgres`, container
`fluide-postgres`, volume `fluide-dev_devdata`, on `127.0.0.1:5433`)
and the dev servers (`dev`: web on `127.0.0.1:3000`, API on `127.0.0.1:4000`)
in a container with the repository mounted:

```sh
docker compose -f docker-compose.dev.yml up -d
```

The `dev` container runs as uid 1000 and installs dependencies into the
repository's `node_modules`, which is shared with the host through the mount.

Or run only the development database in Docker and the dev servers on the host
(requires [Bun](https://bun.sh)):

```sh
docker compose -f docker-compose.dev.yml up -d postgres
bun install && bunx turbo run dev
```

Production commands (`docker compose ...` without `-f`) never touch the
development data.

Development always uses Plaid's sandbox: the server's `dev` script sets
`PLAID_ENV=sandbox`, for both the `dev` container and the host flow.

> **Warning:** `docker compose -f docker-compose.dev.yml down -v` deletes the
> development database.

The development database is `postgres://fluide:fluide_dev_only@localhost:5433/fluide`
from the host. Apply migrations to it with:

```sh
cd packages/ledger && bun run db:migrate
```

Checks:

```sh
bunx tsc --noEmit -p tsconfig.json   # in each package you touched
bun test                             # in apps/web, packages/connectors, packages/ledger
bun scripts/check-headers.ts         # source-of-truth file headers (repo root)
```

See `AGENTS.md` for the change protocol and repository rules.

## License

Copyright (C) 2026 Subhendu Singh

Fluide is free software: you can redistribute it and/or modify it under the terms of the
GNU Affero General Public License, version 3 (`AGPL-3.0-only`), as published by the Free Software
Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see
[LICENSE](LICENSE) for the full text.

If you run a modified version for other people over a network, the AGPL (section 13) requires you to
offer those users the source code of your version.
