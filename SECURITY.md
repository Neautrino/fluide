# Security policy

Fluide holds bank connections and financial data, so security reports are taken
seriously and handled privately.

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through GitHub:
[Report a vulnerability](https://github.com/Neautrino/fluide/security/advisories/new)
(the repository's Security tab → Report a vulnerability).

Include, as far as you can:

- what is affected (server, web app, Docker setup, release image) and which version;
- how to reproduce it, step by step;
- what an attacker gains, and what they need first (network access, a browser tab
  the user visits, access to the machine, …).

The report and the conversation about it stay private until a fix is released.
Please give the fix time to ship before disclosing it publicly; you will be credited
in the advisory unless you prefer not to be.

## Supported versions

Fluide is in its 0.x releases. Fixes go into the latest release only, so please
check that a problem still exists there.

## What the security model covers

The README's [Security model](README.md#security-model) describes what Fluide
protects against. In short:

- the app is reachable on `127.0.0.1:8080` only, and Postgres is not reachable from
  outside Docker at all;
- requests with an unknown `Host` header and cross-site write requests are refused;
- bank tokens and provider keys are encrypted at rest, and are never sent to the web
  app or to an AI model;
- the app runs as a non-root user with the restricted `fluide_app` database role.

Reports that break any of these are in scope, as are flaws in the release image and
the Docker Compose setup, and any way Fluide could initiate a payment or write to a
bank (it must only ever read).

## Out of scope

- **No login yet.** Anyone and any program that can reach `localhost:8080` on the
  machine can use Fluide; this is documented. Exposing the port to a network, or
  `FLUIDE_ALLOWED_HOSTS` without your own authenticating reverse proxy, is outside
  the supported setup.
- **Access to the machine itself.** Root, or membership in the `docker` group, gives
  access to the Docker volumes and so to the database and the vault key; no
  self-hosted app can protect against its own administrator.
- **Third-party services**: Plaid, the AI providers you configure, GitHub. Report
  those to them.
- A vulnerability in a dependency that Fluide cannot be shown to be affected by:
  report it upstream.
