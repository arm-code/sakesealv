# Contributing to Sake

Thanks for contributing to Sake.

This repository contains the Sake web app, its backend and the KOReader plugin. The project is open source and licensed under `AGPL-3.0-only`, so contributions should stay compatible with open redistribution.

## Repository layout

- `src/` - the Next.js application (App Router, Next.js 16 + React 19 + TypeScript, Bun)
- `drizzle/` - SQL migrations
- `koreaderPlugins/` - KOReader plugin source
- `docs/` - screenshots

## Before you start

Please:

- check whether there is already an issue or discussion for the change
- keep changes open-source friendly
- avoid breaking existing API behavior, storage contracts, or KOReader flows unless the change is explicitly intentional
- keep changes focused and additive when possible

For larger work, it helps to open an issue first so the approach can be aligned before implementation begins.

## Local setup

Sake is Bun-first and uses Next.js 16 with strict TypeScript. Setup, environment variables and Docker options are documented in [README.md](./README.md).

```bash
bun install
cp .env.example .env     # configure the database and S3-compatible storage
bun run db:migrate
bun run dev              # http://localhost:3000
```

New to the project? See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) (in Spanish) for how to inspect the database with Drizzle Studio and how to recover access if you forget the initial user.

Next.js 16 differs from older versions (for example the middleware file is `proxy.ts`). Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level code.

## Useful commands

```bash
bun run dev
bun run lint
bunx tsc --noEmit
bun run build
bun run db:generate
bun run db:migrate
```

Before opening a pull request, `bunx tsc --noEmit` should pass with zero errors and `bun run build` should succeed.

## Architecture expectations

Please preserve the existing layering under `src/lib/server`:

- `domain` - domain types and interfaces
- `application` - use-cases, ports, services and `composition.ts` (wiring)
- `infrastructure` - concrete adapters (database, S3, logging, providers)
- `src/app/api` - thin route handlers only

Route handlers should:

1. Authenticate (`requireSession()`, `requireActor()` for routes that also accept a device API key, or `requireBasicAuth()` for OPDS/WebDAV)
2. Parse and validate input
3. Call one use-case
4. Map the result to an HTTP response

Expected business errors should use the project `ApiResult<T>` pattern instead of throwing.

UI code lives in `src/components` (by feature), talks to the API through the typed clients in `src/lib/client`, and keeps reader logic in `src/lib/reader`.

## KOReader plugin changes

If you touch `koreaderPlugins/`, please preserve these boundaries:

- controllers are KOReader-facing orchestration
- engines are pure workflow logic
- adapters handle KOReader/runtime access
- UI code should stay out of engines

The plugin release source of truth is the database metadata managed by the app, not a storage manifest. You need to manually update the version number in `_meta.lua` so it is recognized as a new version.

## Database and migration notes

- schema: `src/lib/server/infrastructure/db/schema.ts`
- migrations: `drizzle/`

When generating migrations:

- use `bun run db:generate`
- keep migration filenames explicit and descriptive
- do not leave a trailing `--> statement-breakpoint`
- make sure breakpoints only separate real SQL statements

If a generated migration includes unrelated full-schema SQL, trim it back to the minimal intended change while keeping Drizzle metadata in sync.

## Code style

Please follow the existing project conventions:

- TypeScript-first, strict typing; avoid `any` unless there is a strong and clearly justified reason
- function components and hooks; styling with Tailwind and the shared UI components in `src/components/ui`
- preserve license headers and avoid adding incompatible assets or code

## Documentation and API changes

If your change affects contributor or user workflows, update the relevant docs. If you add or change API endpoints, update the API requests that accompany this repository, if you use them.

## Pull requests

A good pull request usually includes:

- a clear summary of what changed
- any relevant screenshots for UI work
- notes about schema, env, or migration changes
- confirmation that type check and build pass

Small, focused PRs are much easier to review than broad mixed changes.
