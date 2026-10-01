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
2. 🔜 **Fase 2 — Componentes base y refactor de estilos.** (EN CURSO)
   - ✅ 2a — Shell visual (Sidebar, AppTopBar, MobileSidebarBackdrop, route groups). COMPLETA.
   - ✅ 2b — Settings modal (shell + 5 panes, datos mock). COMPLETA.
   - ⬜ 2c — Shelf manager (drag&drop, emoji picker, ShelfRulesModal).
   - ⬜ 2d — ZLibraryAuthModal + ConfirmModal.
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

## Fase 2a — Detalle de lo hecho (COMPLETA)

**Descubrimiento importante al arrancar:** `Sidebar.svelte` no es un
componente aislado — arrastra ~1800 líneas repartidas en 10 archivos
(`SidebarSettingsModal` + controller de 396 líneas, shelf manager de 437
líneas con drag&drop, `ShelfRulesModal`, `ConfirmModal`,
`ZLibraryAuthModal`...). Se decidió con el usuario **acotar la Fase 2 en
mini-fases** en vez de migrar todo de un tirón. Esta sección (2a) cubrió
solo el shell visual.

### Decisión de arquitectura confirmada: route groups
- `src/app/(auth)/page.tsx` → login, sin chrome. (Stub por ahora —
  contenido real en Fase 4.)
- `src/app/(app)/layout.tsx` → monta `Sidebar` + `AppTopBar` +
  `MobileSidebarBackdrop`, envuelve el resto de rutas con chrome.
- `src/app/(app)/library/page.tsx` → stub temporal, solo para poder
  verificar el shell visualmente. Se reemplaza con la página real en Fase 4.
- El lector (`/library/[id]/read`) **todavía no existe** — cuando se cree en
  Fase 4, debe vivir fuera de `(app)` (o en su propio route group) para no
  heredar el chrome, igual que hacía la regex en el Svelte original.

### Componentes creados
- `src/components/sidebar/sidebar.tsx` — puerto de `Sidebar.svelte`
  **solo la parte visual**: logo, nav items (lista estática de
  `lib/types/navigation.ts`, puerto 1:1 de `Navigation.ts`), botón
  collapse/expand, botón Settings. Usa tokens de shadcn
  (`bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`,
  `bg-sidebar-accent`) en vez de la paleta oscura hardcodeada del SCSS
  original — dark/light reales ahora vía esos tokens + `next-themes`.
  Iconos: mapeados 1:1 a `lucide-react` (ya es la librería de iconos de
  shadcn) en vez de portar los wrappers custom de `$lib/assets/icons/*`.
  **Excluido a propósito** (queda para 2b/2c): la fila especial de
  "Library" con expand de shelves, `SidebarShelvesSection`, el modal de
  Settings (el botón está wireado pero `onOpenSettings` es un no-op).
- `src/components/layout/app-topbar.tsx` — puerto 1:1 de `AppTopBar.svelte`.
- `src/components/layout/mobile-sidebar-backdrop.tsx` — puerto 1:1 de
  `MobileSidebarBackdrop.svelte`.
- `src/app/(app)/layout.tsx` — puerto de la parte de shell de
  `+layout.svelte`: estado `collapsed`/`mobileOpen` (con persistencia en
  `localStorage`, mismo key `sidebarCollapsed`), `currentSection` derivado
  del pathname vía `usePathname()`. **Excluido a propósito** (no es parte
  del shell visual): el modal de Z-Library, el registro del service worker,
  el warning de migración de DB — esos vuelven en Fase 2d/3 cuando se porte
  el resto del root layout original.
- Breakpoint: el original usaba `900px` a mano; se usó el breakpoint `lg`
  de Tailwind (1024px) en su lugar — más idiomático, visualmente
  equivalente.

### Verificación visual (Playwright, headless Chromium vía `npx playwright install chromium`)
Se levantó `bun run dev` y se capturaron pantallas de `/` y `/library` en
desktop (1280px) y mobile (390px), light y dark, más el sidebar colapsado y
el drawer móvil abierto. Todo renderiza correctamente. El único elemento
"raro" en las capturas (un círculo "N" solapándose con el botón Settings)
es el indicador de dev-tools de Next.js (`next dev`-only), confirmado por
DOM (`display: none` correcto en el label cuando está colapsado) y porque
aparece también en la página de login sin sidebar — no es un bug del
código.

`bun run build` sigue compilando limpio después de estos cambios.

**No hay skill de proyecto para levantar la app (`.claude/skills/`) —
si vas a volver a correr el dev server para QA visual, considera generar
una con `/run-skill-generator` para no repetir el setup de Playwright cada
vez.**

---

## Fase 2b — Detalle de lo hecho (COMPLETA)

**Mismo patrón que 2a:** el controller real (`sidebarSettingsController.svelte.ts`,
396 líneas) depende de `AuthService`, `ZLibAuthService` y `ZUI` (cliente que
pega contra `/api/*`), que no existen todavía en `sake-next` (Fase 3). Se
acordó con el usuario construir **el modal completo (shell + 5 panes) con
datos mock/estáticos** y acciones wireadas a un helper `notImplemented()`
que muestra un toast ("... will be wired up in Phase 3") en vez de no-ops
silenciosos — mejor feedback visual al revisar la UI.

### Dependencias de UI nuevas
- shadcn: `dialog`, `tabs`, `switch`, `badge`, `input`, `label` (vía
  `bunx shadcn add`). El modal usa `Dialog` + `Tabs` (orientación horizontal,
  variant `"line"`) en vez de portar el backdrop/focus-trap manual del
  Svelte original — Base UI ya resuelve foco, Escape, aria-modal, etc.
- **Gotcha de Base UI:** el `Button` de shadcn (`@base-ui/react/button`)
  asume `nativeButton=true` por defecto. Al usar `render={<a ... />}` para
  botones que son en realidad enlaces (descargas, "Open GitHub"), hay que
  pasar `nativeButton={false}` explícitamente o Base UI tira un warning en
  consola. Ya corregido en `app-pane.tsx` y `plugin-pane.tsx` — tenerlo en
  cuenta para cualquier botón-como-link nuevo.

### Archivos creados
- `src/lib/types/auth.ts`, `plugin.ts`, `integrations.ts`, `app-version.ts`
  — puertos 1:1 de los `.ts` de tipos originales (sin los wrapper
  `*Response` de la API, esos se definen en Fase 3 junto a las rutas).
- `src/lib/utils/database-migration-status.ts` — puerto verbatim de
  `getDatabaseMigrationStatusNote` (pura, sin deps de SvelteKit).
- `src/components/sidebar/settings/`:
  - `settings-modal.tsx` — `Dialog` + `Tabs` horizontal, con scroll en
    mobile para la fila de tabs.
  - `app-pane.tsx`, `plugin-pane.tsx`, `integrations-pane.tsx`,
    `account-pane.tsx`, `devices-pane.tsx`, `api-key-list.tsx` — puertos
    1:1 de la lógica de presentación de cada pane original, con Tailwind +
    shadcn (`Button`, `Badge`, `Switch`, `Input`, `Label`) en vez de los
    `.module.scss`.
  - `meta-row.tsx` — `<MetaList>`/`<MetaRow>` compartidos (el patrón
    `dt`/`dd` se repetía en 4 de los 5 panes original — única abstracción
    nueva introducida, no estaba en el Svelte original pero reduce
    duplicación real).
  - `mock-data.ts` — datos de ejemplo para los 5 panes.
  - `not-implemented.ts` — helper de toast para acciones aún no wireadas.
- `src/app/(app)/layout.tsx` — ahora posee `settingsOpen` (estado elevado,
  mismo patrón que `collapsed`/`mobileOpen`), pasado a `Sidebar` (que ya no
  tiene el `onOpenSettings` no-op de 2a) y a `SettingsModal`.

### Cambio de copy consciente
El pane "App" original tenía el subtítulo "Svelte and KOReader Ecosystem"
— se cambió a "Self-hosted e-book reading and sync platform" porque
mencionar "Svelte" ya no es exacto una vez migrado el frontend a Next/React.
Si el usuario prefiere otro texto, es un cambio trivial en `app-pane.tsx`.

### Verificación
`bun run build` compila limpio. Verificado visualmente con Playwright
headless: las 5 secciones del modal, en light/dark y en desktop (1280px) y
mobile (390px, con el tab-bar scrolleable horizontalmente). Sin errores de
consola tras el fix de `nativeButton`.

---

## Fase 2c/2d — Qué sigue (NO empezado todavía)

- **2c — Shelf manager.** `SidebarShelvesSection.svelte` (136 líneas) +
  `sidebarShelfManager.svelte.ts` (437 líneas, drag&drop + emoji picker) +
  `SidebarShelfContextMenu.svelte` (39 líneas) + `ShelfRulesModal.svelte`
  (164 líneas) + `ConfirmModal.svelte` (73 líneas, genérico — probablemente
  conviene como primitivo shadcn-style reusable). Esto también reactiva la
  fila especial "Library" con el chevron de expandir en `sidebar.tsx`.
- **2d — Z-Library + Toast.** `ZLibraryAuthModal.svelte` (ya leído, ~100
  líneas, formulario simple con tabs) + confirmar que `toastStore.svelte.ts`
  (49 líneas) se reemplaza limpiamente por la API de `sonner`
  (`toast.success(...)`, `toast.error(...)`) en vez de portar
  `ToastContainer`/`Toast.svelte`.

Después de 2b/2c/2d, el root layout real (`src/app/layout.tsx`) necesita
recibir de vuelta: el modal de Z-Library, el registro del service worker, y
el warning de migración de DB — todo lo que se dejó fuera del shell en 2a.

---

## Cómo continuar en una sesión nueva

Pega esto al iniciar:

> Retomamos la migración de Sake (SvelteKit → Next.js). Lee
> `sake-next/MIGRATION_HANDOFF.md` completo para el contexto — Fase 1, 2a
> (shell visual) y 2b (modal de Settings, datos mock) ya están cerradas y
> verificadas visualmente. Vamos a arrancar la Fase 2c (shelf manager):
> necesito que leas
> `sake/src/lib/components/sidebar/SidebarShelvesSection/SidebarShelvesSection.svelte`,
> `sake/src/lib/components/sidebar/Sidebar/sidebarShelfManager.svelte.ts`,
> `sake/src/lib/components/sidebar/SidebarShelfContextMenu/SidebarShelfContextMenu.svelte`,
> `sake/src/lib/components/shelfRules/ShelfRulesModal/ShelfRulesModal.svelte`
> y
> `sake/src/lib/components/ConfirmModal/ConfirmModal.svelte`
> y me propongas la reconstrucción como componente(s) de `sake-next/` con
> Tailwind v4 + shadcn (preset `base-nova`, ya fijado — no volver a
> preguntar por "New York"), mobile-first, con dark/light real vía
> `next-themes`. Mismo patrón que 2a/2b: si el shelf manager depende de
> rutas `/api/*` que no existen todavía (Fase 3), usar datos mock y el
> helper `notImplemented()` de
> `sake-next/src/components/sidebar/settings/not-implemented.ts` para las
> acciones — no bloquear la UI esperando a la Fase 3. Esto también reactiva
> la fila especial "Library" con el chevron de expandir en
> `src/components/sidebar/sidebar.tsx` (actualmente simplificada en 2a).
