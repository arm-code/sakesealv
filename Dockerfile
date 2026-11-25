# Imagen de Sake (Next.js). Contexto de build: la raíz del repo.
#   docker build -t sake .
#
# Usa Node + pnpm (no Bun) para construir: así la misma imagen funciona en servidores
# nuevos y en CPUs viejos (Bun exige instrucciones modernas y muere con "Illegal
# instruction" en procesadores sin AVX2/SSE4.2).
FROM node:22-slim AS deps
WORKDIR /app
# La versión de pnpm sale del campo "packageManager" de package.json
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS builder
ARG PUBLIC_WEBAPP_VERSION=dev-local
ARG PUBLIC_WEBAPP_GIT_TAG=
ARG PUBLIC_WEBAPP_COMMIT_SHA=
ARG PUBLIC_WEBAPP_RELEASED_AT=
ENV NEXT_TELEMETRY_DISABLED=1
COPY . ./
# Las variables PUBLIC_WEBAPP_* se leen en runtime (api/app/version), no hace falta hornearlas aquí.
RUN pnpm run build

# Migraciones: scripts/migrate.mjs usa drizzle-orm (no drizzle-kit, que da SIGILL en CPUs viejos).
#   docker run --rm --env-file ... sake-migrator
# También incluye el script que crea el bucket S3 (sustituye a la imagen del CLI de AWS).
FROM deps AS migrator
WORKDIR /app
COPY drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY src/lib/server/config/infrastructure.shared.js ./src/lib/server/config/infrastructure.shared.js
COPY src/lib/server/infrastructure/db/schema.ts ./src/lib/server/infrastructure/db/schema.ts
COPY scripts/ensure-bucket.mjs scripts/migrate.mjs ./scripts/
CMD ["node", "scripts/migrate.mjs"]

FROM node:22-slim AS runtime
WORKDIR /app
ARG PUBLIC_WEBAPP_VERSION=dev-local
ARG PUBLIC_WEBAPP_GIT_TAG=
ARG PUBLIC_WEBAPP_COMMIT_SHA=
ARG PUBLIC_WEBAPP_RELEASED_AT=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PUBLIC_WEBAPP_VERSION=${PUBLIC_WEBAPP_VERSION} \
    PUBLIC_WEBAPP_GIT_TAG=${PUBLIC_WEBAPP_GIT_TAG} \
    PUBLIC_WEBAPP_COMMIT_SHA=${PUBLIC_WEBAPP_COMMIT_SHA} \
    PUBLIC_WEBAPP_RELEASED_AT=${PUBLIC_WEBAPP_RELEASED_AT} \
    KOREADER_PLUGIN_DIR=/app/koreaderPlugins/sake.koplugin
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY koreaderPlugins/sake.koplugin ./koreaderPlugins/sake.koplugin
EXPOSE 3000
CMD ["node", "server.js"]
