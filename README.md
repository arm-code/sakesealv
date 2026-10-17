<h1 align="center">Sake</h1>

<p align="center">
  Self-host your reading stack with a clean web library, KOReader sync, and provider-powered book imports.
</p>

![Sake library page](./docs/img/webapp/library.png)

## Why Sake?

If you already use KOReader, Sake gives you a much nicer home base around it: a self-hosted web library, seamless progress sync, note-aware reading updates, easy book delivery to devices and a built-in plugin update flow, without losing the KOReader setup you already like.

## Quick start

```bash
docker compose -f docker-compose.selfhost-next.yaml up --build
```

Then open <http://localhost:5173> and create your first account on the login page. The stack includes the app, automatic database migrations, a file-backed libSQL database and SeaweedFS as S3-compatible storage.

## Documentation

Everything about running, configuring and developing the app is in [`sake-next/README.md`](./sake-next/README.md): local development, Docker image and targets, environment variables, search/metadata providers, OPDS/WebDAV and the KOReader plugin setup.

## What lives in this repo?

- `sake-next/` - the web app (Next.js 16 + React 19 + TypeScript + Bun)
- `koreaderPlugins/` - the KOReader plugin shipped by the app
- `docs/` - screenshots

`sake/` is the previous SvelteKit implementation, kept only until the migration is finished; it is maintained on its own branch.

## Screenshots

### Web app

<p><img src="./docs/img/webapp/library.png" alt="Library view" width="700"></p>
<p><img src="./docs/img/webapp/search.png" alt="Search view" width="700"></p>
<p><img src="./docs/img/webapp/detail.png" alt="Book detail view" width="700"></p>
<p><img src="./docs/img/webapp/progress.png" alt="Reading progress view" width="700"></p>

### KOReader plugin

<p><img src="./docs/koreader/MainMenu.png" alt="KOReader plugin main menu" width="350"></p>
<p><img src="./docs/koreader/Download.png" alt="KOReader plugin download view" width="350"></p>
<p><img src="./docs/koreader/Export.png" alt="KOReader plugin export flow" width="350"></p>
<p><img src="./docs/koreader/Login.png" alt="KOReader plugin login flow" width="350"></p>
<p><img src="./docs/koreader/VersionList.png" alt="KOReader plugin updater version list" width="350"></p>

## License

This repository is licensed under `AGPL-3.0-only`. See `LICENSE` for the full text.
