# Sake

Self-host your reading stack with a clean web library, KOReader sync, and provider-powered book imports.

Sake is a self-hosted web library built around [KOReader](https://koreader.rocks): it keeps your books, reading progress, highlights and notes in one place and syncs them with your e-readers. It is built with Next.js 16, React 19, TypeScript and Bun.

![Sake library page](./docs/img/webapp/library.png)

## Features

- Personal library with covers, metadata, shelves, ratings and reading state
- Built-in EPUB reader (paginated, themes, font size, highlights, bookmarks, RSVP speed-reading mode) that keeps the same progress format as KOReader
- Reading stats: yearly heatmap, pages per day, streaks, distribution by format/rating/state
- Searchable highlights and annotations hub with inline note editing and Markdown/JSON export
- Download books from multiple search providers (Anna's Archive, Open Library, Project Gutenberg, Z-Library) straight into your library, directly or through a background queue
- Metadata lookup (Google Books, Open Library, Hardcover, ISBNdb): search candidates, pick the fields and cover to apply, or refetch missing fields
- KOReader device pairing and sync: progress, new-book delivery, library export, remote logs
- Built-in KOReader plugin release delivery
- Optional Hardcover progress sync
- OPDS and WebDAV endpoints
- Trash with automatic expiry, archive, and per-account Basic-auth password for OPDS/WebDAV
- libSQL (file or Turso) plus any S3-compatible storage (R2, SeaweedFS, MinIO, AWS S3)

OPDS and WebDAV use HTTP Basic authentication. By default your normal account password works there; in **Settings → Account** you can set a separate Basic-auth password.

## Quick start

### Option A — Docker (self-hosted reference stack)

```bash
docker compose up --build
```

Then open <http://localhost:5173>. This starts:

- the Sake app (image built from `Dockerfile`)
- a one-shot migrator that applies database migrations before the app starts
- SeaweedFS as S3-compatible storage (bucket created automatically)
- a file-backed libSQL database

Data is persisted under `./.data/selfhost/libsql` and `./.data/selfhost/seaweedfs`. Defaults live in `.env.docker.selfhosted` — change the S3 credentials before exposing the stack to a network.

> **Production Deployment:** For deploying on a Linux (Debian) server with Cloudflare Tunnel (e.g. custom domain), see the dedicated guide: [docs/DEPLOY_LINUX_CLOUDFLARE.md](docs/DEPLOY_LINUX_CLOUDFLARE.md).

To stop it: `docker compose down`.

### Option B — Local development with Bun

You need Bun, a libSQL database (a local file is fine) and an S3-compatible bucket. The quickest bucket is the SeaweedFS from the compose file above:

```bash
docker compose up -d seaweedfs seaweedfs-init
```

Then:

```bash
cp .env.example .env     # fill it in, see "Configuration"
bun install
bun run db:migrate       # first run, and after every schema change
bun run dev
```

Open <http://localhost:3000>. In dev mode each page compiles the first time you open it (10–60 s), so the first load looks slow.

Minimal `.env` for the SeaweedFS above:

```env
LIBSQL_URL=file:./.data/dev.db

S3_ENDPOINT=http://localhost:8333
S3_REGION=us-east-1
S3_BUCKET=sake
S3_ACCESS_KEY_ID=sakeadmin
S3_SECRET_ACCESS_KEY=sakeadminsecret
S3_FORCE_PATH_STYLE=true

ACTIVATED_PROVIDERS=anna,openlib,gutenberg
ACTIVATED_METADATA_PROVIDERS=googlebooks,openlibrary
```

### First boot

With an empty database the login page offers the bootstrap flow to create the first account. You can also create it from a terminal:

```bash
curl -X POST http://localhost:3000/api/auth/bootstrap \
  -H "content-type: application/json" \
  -d '{"username":"your_user","password":"a_long_password"}'
```

## Configuration

Copy `.env.example` to `.env` and fill in what you need. Variables are read at runtime (no rebuild needed in Docker).

| Variable | Purpose |
| --- | --- |
| `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN` | Database. `file:./.data/dev.db` locally, `libsql://…` + token for Turso. **Required.** |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | S3-compatible storage for books, covers and KOReader sidecars. **Required.** Use `S3_FORCE_PATH_STYLE=true` for SeaweedFS/MinIO and `false` for R2/S3. |
| `ACTIVATED_PROVIDERS` | Comma-separated search providers: `anna` (`annas`, `annas-archive`), `openlib` (`openlibrary`), `gutenberg`, `zlib` (`zlibrary`). Empty = search disabled and hidden from the menu. |
| `ZLIBRARY_BASE_URL` | Fallback Z-Library mirror(s), HTTPS, comma-separated. **Settings → Integrations** overrides it once saved. |
| `ACTIVATED_METADATA_PROVIDERS` | `googlebooks`, `openlibrary`, `hardcover`, `isbndb`. Empty = metadata lookup disabled. |
| `GOOGLE_BOOKS_API_KEY`, `ISBNDB_API_KEY`, `HARDCOVER_API_TOKEN` | Provider credentials. Google Books and Open Library work without a key (a key only raises the rate limit); Hardcover and ISBNdb are skipped without theirs. |
| `METADATA_PROVIDER_TIMEOUT_MS` | Per-provider metadata timeout. |
| `LOG_LEVEL` | pino level, default `info`. Production logs are JSON on stdout. |
| `SAKE_DEMO_MODE` | `true` disables real Hardcover sync (for public demos). |

Docker build/runtime extras: `PUBLIC_WEBAPP_VERSION`, `PUBLIC_WEBAPP_GIT_TAG`, `PUBLIC_WEBAPP_COMMIT_SHA` and `PUBLIC_WEBAPP_RELEASED_AT` show up in **Settings → App** (`/api/app/version`). `KOREADER_PLUGIN_DIR` points at the plugin directory (set automatically in the image).

### Managed infrastructure example

```env
LIBSQL_URL=libsql://your-database-name.turso.io
LIBSQL_AUTH_TOKEN=your-turso-auth-token

S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_FORCE_PATH_STYLE=false
```

Run the migrations once against it (`bun run db:migrate` with that `.env`, or the migrator image below) before starting the app.

## Docker image

`Dockerfile` builds from the repository root and has two targets:

| Target | What it is |
| --- | --- |
| `runtime` | The app (`node server.js` from Next's standalone output, ~460 MB). Includes the KOReader plugin. |
| `migrator` | Applies database migrations (`drizzle-kit migrate`). Run it before the app and after upgrades. |

```bash
docker build --target runtime  -t sake .
docker build --target migrator -t sake-migrator .

docker run --rm --env-file .env -v ./data:/data sake-migrator
docker run -d  --env-file .env -v ./data:/data -p 3000:3000 sake
```

Optional build args: `PUBLIC_WEBAPP_VERSION`, `PUBLIC_WEBAPP_GIT_TAG`, `PUBLIC_WEBAPP_COMMIT_SHA`, `PUBLIC_WEBAPP_RELEASED_AT`. If you run behind a reverse proxy, raise its request-body limit so large book uploads are not rejected.

## KOReader plugin

The plugin lives in `koreaderPlugins/sake.koplugin` and is uploaded to storage on startup, so devices can update it from the server.

1. Install the plugin in KOReader like any other plugin.
2. Open **Settings → More tools → Sake → Setup**.
3. Set the public URL of your Sake app in **Server URL** and optionally rename the device.
4. Choose **Pair Device** and log in with your web-app username and password. The password is exchanged for a device API key and cleared from the device.
5. Use **Sync**, **Library Import/Export** and **Maintenance** as needed.

- Books download with **Download New Books** or when the device goes to sleep; progress uploads on sleep while a book is open.
- With several devices, use **Pull Progress From Other Devices** to fetch newer progress.
- **Import or Export Existing Library** uploads books already on the device together with progress and notes. It can take a while.
- **Maintenance → Check for Plugin Updates** looks for new plugin releases; **Remote Log Shipping** sends device logs to **Logs → Devices** in the web app.

## Search providers and downloads

Search is routed through `POST /api/search` and shown in the **Search** page once at least one provider is enabled.

- `anna`, `openlib` and `gutenberg` need no credentials.
- `zlib` also needs your Z-Library session: **Settings → Integrations → Connect Z-Library**, then log in with email/password or paste `remix_userid` / `remix_userkey` from your Z-Library cookies. Mirrors must use HTTPS (up to five, 2,048 characters each).

Results can be downloaded to your browser or sent to your library; queued items are processed in the background and tracked on the **Queue** page.

## Development

```bash
bun run dev              # dev server on :3000
bun run build            # production build (needs network for Google Fonts)
bun run start            # serve the production build
bun run lint
bunx tsc --noEmit        # type check
bun run db:generate      # after editing src/lib/server/infrastructure/db/schema.ts
bun run db:migrate
bun run db:studio
```

New to the project? Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (diagrams, components, flows and how everything starts up) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (local setup and database).

### Layout

```
koreaderPlugins/      KOReader plugin shipped by the app
docs/                 screenshots
src/app/(auth)        login / bootstrap
src/app/(app)         app shell: library, archived, trash, search, queue, stats, annotations, logs
src/app/(reader)      full-screen EPUB reader
src/app/api           HTTP API (library, devices, OPDS, WebDAV, search, annotations, stats, …)
src/components        UI by feature
src/lib/client        typed API clients used by the UI
src/lib/server        domain, use-cases, repositories, background jobs (composition.ts wires them)
src/lib/koreader      KOReader sidecar (Lua) parser/serializer
src/lib/reader        reader runtime, RSVP, pagination, preferences
src/instrumentation.ts  starts background jobs (trash purge, plugin sync, annotation reconcile)
src/proxy.ts            WebDAV (PROPFIND) entry point
drizzle/              SQL migrations
```

### Notes for contributors

- This is Next.js 16: the middleware file is `proxy.ts`, and APIs differ from older versions. Read the guides in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).
- Authentication is resolved per route (`requireSession()` for the web UI, `requireActor()` for routes that also accept a device `x-api-key`, `requireBasicAuth()` for OPDS/WebDAV).
- Sibling dynamic route segments must use the same name (`[id]` next to `[id]`, never `[title]`); a mismatch builds fine but crashes at runtime.
- In `next dev`, creating a new route folder while the server runs can leave every route returning 404 until you restart it.
- The first load of the reader in dev can take 30–90 s while book locations are generated.

`MIGRATION_HANDOFF.md` is the engineering log of the port from the previous SvelteKit implementation (kept on its own branch), phase by phase.

## Screenshots

<p><img src="./docs/img/webapp/search.png" alt="Search view" width="700"></p>
<p><img src="./docs/img/webapp/detail.png" alt="Book detail view" width="700"></p>
<p><img src="./docs/img/webapp/progress.png" alt="Reading progress view" width="700"></p>
<p><img src="./docs/koreader/MainMenu.png" alt="KOReader plugin main menu" width="350"></p>

## License

AGPL-3.0-only. See `LICENSE`.
