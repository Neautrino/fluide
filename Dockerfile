# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION} AS manifests
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/connectors/package.json packages/connectors/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/ledger/package.json packages/ledger/
COPY packages/typescript-config/package.json packages/typescript-config/

FROM manifests AS deps
RUN bun install --frozen-lockfile

FROM manifests AS prod-deps
RUN bun install --frozen-lockfile --production --filter server

FROM deps AS build
COPY . .
RUN cd apps/web && bun run build

FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
# bun's isolated linker: per-workspace node_modules are relative symlinks into /app/node_modules/.bun
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=prod-deps /app/packages/ledger/node_modules packages/ledger/node_modules
COPY --from=prod-deps /app/packages/connectors/node_modules packages/connectors/node_modules
COPY package.json ./
COPY apps/server/package.json apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src
COPY packages/ledger/package.json packages/ledger/tsconfig.json packages/ledger/
COPY packages/ledger/src packages/ledger/src
COPY packages/ledger/migrations packages/ledger/migrations
COPY packages/connectors/package.json packages/connectors/tsconfig.json packages/connectors/
COPY packages/connectors/src packages/connectors/src
COPY --from=build /app/apps/web/dist apps/web/dist
# uid/gid 1000 (image's `bun` user); docker-compose.yml secrets-init chowns app secrets to this uid
USER bun
EXPOSE 8080
CMD ["bun", "apps/server/src/index.ts"]
