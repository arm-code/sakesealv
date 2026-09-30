# Migración Sake: SvelteKit → Next.js — Estado

> Documento de continuidad entre sesiones de Claude Code. Si estás retomando esto,
> lee este archivo completo antes de tocar código.

## Objetivo general

Migrar `sake/` (SvelteKit + Svelte 5 + SCSS Modules) a `sake-next/` (Next.js App
Router + React + Tailwind v4 + shadcn/ui), manteniendo intactos Drizzle ORM,
libSQL y el AWS SDK (S3). Runtime: Bun. Metodología: **iterativa por fases**,
sin saltar a la siguiente hasta cerrar la actual.

- `sake/` = proyecto Svelte original, **no se toca**, sigue siendo la fuente de
  verdad de la lógica a migrar.
- `sake-next/` = proyecto nuevo, se construye desde cero al lado.

## Fases

1. ✅ **Fase 1 — Setup inicial.** (COMPLETA)
2. 🔜 **Fase 2 — Componentes base y refactor de estilos.** (EN CURSO, arrancando)
3. ⬜ **Fase 3 — Rutas de API y utilidades de servidor.**
4. ⬜ **Fase 4 — Páginas y layouts completos, mobile-first.**

---

## Fase 1 — Detalle de lo hecho

### Stack confirmado
- Next.js 16.3.8 (App Router), React 19.2.8, Tailwind v4, Bun 1.4.2.
- shadcn/ui inicializado.

### ⚠️ Decisión importante: el estilo "New York" ya NO existe
El CLI de shadcn (verificado en v2, v3 y v4.21.0 — la actual) eliminó por
completo el sistema clásico `new-york`/`default`. Fue reemplazado por 8
presets (`nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`)
combinables con una librería base (`radix` | `base` | `aria`).

**Decisión tomada con el usuario:** usar el default actual del CLI,
**`base-nova`** (Base UI + preset Nova). Ya está en `components.json`. No
volver a preguntar esto — es una decisión cerrada, no una pendiente.

### Qué se instaló/creó
- `bunx create-next-app` con TypeScript, Tailwind, ESLint, App Router, `src/`,
  alias `@/*`.
- `bunx shadcn@latest init -d` → `components.json` (`style: base-nova`,
  `baseColor: neutral`, `cssVariables: true`).
- Componentes shadcn añadidos: `button`, `dropdown-menu`, `separator`,
  `skeleton`, `sonner`.
- `next-themes` instalado y envuelto en `src/components/theme-provider.tsx`,
  montado en `src/app/layout.tsx` con `attribute="class"`,
  `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
  Compatible con la estrategia `.dark` que ya trae `globals.css` generado por
  shadcn (variables en `oklch`, tokens `--background`/`--foreground`/etc.).
- Tipografía: `Inter` (`--font-sans`) y `JetBrains_Mono` (`--font-geist-mono`)
  vía `next/font/google`, reemplazando los `<link>` de Google Fonts que
  usaba `+layout.svelte`.
- `<Toaster />` (de `sonner`) montado en el layout raíz — sustituirá a
  `ToastContainer.svelte` / `toastStore.svelte.ts` en Fase 2.

### Backend movido (solo lo estrictamente de infraestructura de datos)
Copiado **sin cambios** porque no dependía de SvelteKit:
- `src/lib/server/infrastructure/db/schema.ts`
- `src/lib/server/config/infrastructure.shared.js`
- `src/lib/server/utils/createLazySingleton.ts`
- Carpeta `drizzle/` completa (26 migraciones `.sql`)

Reescritos **mínimamente** (solo cambios de framework, cero cambios de lógica):
- `src/lib/server/config/infrastructure.ts` — `$env/dynamic/private` →
  `process.env`. **Se quitó la llamada a `logResolvedConfig` (pino)** porque
  depende de `src/lib/server/infrastructure/logging/logger` (SvelteKit-coupled),
  que aún no se ha migrado. **Pendiente para Fase 3.**
- `src/lib/server/infrastructure/db/client.ts` — imports `$lib/*` → `@/lib/*`,
  resto idéntico (mismo patrón de lazy singleton para no abrir libSQL en build).
- `drizzle.config.ts` — mismo contenido, paths ajustados a `sake-next/`.
- `.env.example` — solo `LIBSQL_*` y `S3_*`. Se dejaron fuera a propósito:
  `VITE_ALLOWED_HOSTS`, `BODY_SIZE_LIMIT` (specific de Vite/SvelteKit, sin
  equivalente necesario ahora) y las vars de metadata providers
  (`ACTIVATED_PROVIDERS`, `ZLIBRARY_BASE_URL`, `GOOGLE_BOOKS_API_KEY`, etc. —
  son lógica de negocio de Fase 3, no de setup de infraestructura).
- `package.json` de `sake-next/` — añadidos scripts `db:generate`,
  `db:migrate`, `db:studio` (versión simplificada, sin los wrappers de
  `run-with-project-env.mjs` que tenía el proyecto Svelte — evaluar en Fase 3
  si se necesitan).

### Verificación
`bun run build` en `sake-next/` compila limpio (TypeScript + build de
producción sin errores).

---

## Fase 2 — Qué sigue (NO empezado todavía)

**Objetivo de esta fase:** reconstruir el shell global de la app
(`+layout.svelte` → layout(s) de Next) usando Tailwind + shadcn, con dark/light
real, mobile-first.

### Ya analizado
`sake/src/routes/+layout.svelte` — contiene:
- Shell con sidebar colapsable + topbar + área de contenido.
- Oculta el chrome en `/` (login) y en `/library/:id/read` (lector).
- Estado: `sidebarCollapsed`/`sidebarMobileOpen` en `localStorage`, sección
  activa derivada de la ruta, sesión de Z-Library (modal de login), toasts,
  registro de service worker, warning de migración de DB.
- Estilos: variables CSS propias (paleta oscura fija, dorado como accent) —
  **se reemplazan** por los tokens de shadcn (`--background`, `--primary`,
  etc.) ya generados en `globals.css`, vía `next-themes` para light/dark real
  en vez de un tema oscuro hardcodeado.

### Pendiente por revisar (bloqueante para escribir el layout de Next)
Archivos que el layout referencia y que **aún no se han leído/migrado**:
1. `sake/src/lib/components/sidebar/Sidebar/Sidebar.svelte` (+ su `.scss` si
   es archivo separado)
2. `sake/src/lib/components/layout/AppTopBar/AppTopBar.svelte`
3. `sake/src/lib/components/layout/MobileSidebarBackdrop/MobileSidebarBackdrop.svelte`
4. `sake/src/lib/components/ToastContainer/ToastContainer.svelte` (se
   sustituye por `<Toaster />` de sonner, pero revisar el store
   `toastStore.svelte.ts` para saber qué API usar al disparar toasts)
5. `sake/src/lib/components/layout/ZLibraryAuthModal/ZLibraryAuthModal.svelte`

### Decisión de arquitectura pendiente (proponer al usuario en Fase 2)
En Next App Router probablemente convenga usar **route groups**:
- `app/(auth)/page.tsx` → login, sin chrome.
- `app/(app)/layout.tsx` → sidebar + topbar, envolviendo el resto de rutas.
- El lector (`/library/[id]/read`) también sin chrome — puede vivir fuera de
  `(app)` o el layout puede detectarlo igual que hacía Svelte con la regex.

No está decidido todavía — plantearlo antes de escribir código.

---

## Cómo continuar en una sesión nueva

Pega esto al iniciar:

> Retomamos la migración de Sake (SvelteKit → Next.js). Lee
> `sake-next/MIGRATION_HANDOFF.md` completo para el contexto — Fase 1 ya está
> cerrada y verificada. Vamos a arrancar la Fase 2: necesito que leas
> `sake/src/lib/components/sidebar/Sidebar/Sidebar.svelte` y
> `sake/src/lib/components/layout/AppTopBar/AppTopBar.svelte` (y sus estilos
> asociados) y me propongas la reconstrucción como componentes de
> `sake-next/` con Tailwind v4 + shadcn (preset `base-nova`, ya fijado — no
> volver a preguntar por "New York"), mobile-first, con dark/light real vía
> `next-themes`.
