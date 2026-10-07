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
2. ✅ **Fase 2 — Componentes base y refactor de estilos.** (COMPLETA)
   - ✅ 2a — Shell visual (Sidebar, AppTopBar, MobileSidebarBackdrop, route groups).
   - ✅ 2b — Settings modal (shell + 5 panes, datos mock).
   - ✅ 2c — Shelf manager (CRUD local, drag&drop, reglas, emoji picker).
   - ✅ 2d — ZLibraryAuthModal (formulario interactivo, submit mock).
3. 🔜 **Fase 3 — Rutas de API y utilidades de servidor.** (EN CURSO)
   - ✅ 3a — Logger + auth local (bootstrap/login/logout/status) + Shelves end-to-end.
   - ✅ 3b — Account pane (me/api-keys/logout-all/basic-password) + Devices pane end-to-end.
   - ✅ 3c — Plugin pane (releases/latest/download/upstream-version) end-to-end, incluyendo S3Storage real por primera vez.
   - ✅ 3d — Z-Library mirrors (Integrations pane, mitad) end-to-end.
   - ✅ 3e — App pane (versión + estado de migración de DB) end-to-end. Con esto el Settings modal queda 100% real salvo Hardcover (bloqueado) y el login real de Z-Library (mockeado a propósito).
   - ✅ 3f — library/books: **núcleo** (listar/ver detalle/leer EPUB/portada/asignar a estantes), verificado backend-only (sin UI todavía, `/library` sigue siendo el placeholder de Fase 4).
   - ✅ 3g — library/books: **progreso/rating** (ratings, historial de progreso, rating, isRead/archived/excludeFromNewBooks, autosave del lector web), verificado backend-only. El sync de progreso de dispositivos KOReader (`PutProgress`/`GetProgress`) quedó **fuera a propósito** — ver sección "Fase 3g" para el motivo (auth dual sesión/API key, ligada al device-pairing todavía sin portar).
   - ✅ 3h — library/books: **papelera** (listar/mover a la papelera/restaurar/borrar permanente + purga de expirados), verificado backend-only, incluyendo limpieza real de S3 (archivo principal, progreso, portadas). `PurgeExpiredTrashUseCase` quedó wireado en `composition.ts` pero **sin ruta ni cron** — ver sección "Fase 3h" para el motivo (mismo hueco de arquitectura que el sync del plugin/Hardcover).
   - ✅ 3i — library/books: **portadas upload/import** (subir una imagen propia desde el EPUB o importar desde una URL externa), verificado backend-only contra S3 real, incluyendo validación de magic bytes y limpieza de portadas viejas al reemplazar. El flujo de importar portada al aplicar un candidato de metadata de búsqueda (Z-Library/mirrors/credenciales) quedó **fuera a propósito** — pertenece a metadata providers (3j+).
   - ✅ 3j — metadata providers: **núcleo** (los 4 proveedores — Google Books/OpenLibrary/ISBNdb/Hardcover-metadata — + agregador/ranking + búsqueda de candidatos), verificado backend-only contra APIs externas reales (OpenLibrary/Google Books sin API key). Sesión de scoping dedicada — ver sección "Fase 3j" para el troceo real del dominio de metadata providers (distinto de lo estimado en 3f).
   - ✅ 3k — metadata providers: edición manual de metadata (`UpdateLibraryBookMetadataUseCase`, sin providers externos, reusa piezas de 3h/3i), verificado backend-only incluyendo limpieza real de portada en S3.
   - ✅ 3l — metadata providers: refetch automático (`ExternalBookMetadataService` + `RefetchLibraryBookMetadataUseCase`), verificado contra OpenLibrary real (relleno de campos faltantes + idempotencia confirmada).
   - ✅ 3m — metadata providers: aplicar candidato (`ApplyMetadataCandidateUseCase`) — **huérfano en el original** (sin ruta HTTP ni UI que lo invoque), portado y verificado con una ruta HTTP nueva inventada (`POST /api/library/[id]/metadata/apply`). **Con esto el dominio completo de metadata providers (3j-3m) queda cerrado.**
   - ✅ 3n — **adquisición Z-Library: login real** (`ZLibraryClient` + `tokenLogin`/`passwordLogin`/`logout`), reemplaza el submit mock de la Fase 2d. Sesión de scoping dedicada previa (ver sección "Scoping — adquisición Z-Library real") mapeó el dominio completo (~5,100 líneas, no ~1,500 como sugería 3j) y lo trozó en A→E; esta es la pieza A.
   - ⬜ — **B. Búsqueda multi-provider** (~1,700 líneas: 4 search providers + registry/factory + `SearchBooksUseCase` + lookup de metadata) — depende de A.
   - ⬜ — **C. Descarga/importación directa** (~1,350 líneas: `DownloadBookUseCase`/`DownloadSearchBookUseCase` + `EpubMetadataService` 707 líneas + `LibraryImportCollisionService` + `storeFromSearchImport`, la pieza que 3i dejó fuera a propósito + `BookRepository.create` nuevo) — depende de A+B.
   - ⬜ — **D. Cola de descargas en background** (~900 líneas: `DownloadQueue` + `QueueJobRepository` + use-cases de cola) — depende de A+B+C, y choca con la decisión de arquitectura de jobs de fondo (mismo hueco que plugin sync/Hardcover/trash purge).
   - ⬜ — **E. `/api/library/[title]` GET/PUT/DELETE** (~290 líneas, el mecanismo por el que providers sin API key de servidor suben el archivo) — depende de C.
   - ⬜ — **F. Device-download tracking** (`GetNewBooksForDeviceUseCase`, `ConfirmDownloadUseCase`, etc. + `ExportDeviceLibraryBookUseCase`) — pertenece más a la futura mini-fase de sync de dispositivos KOReader (mismo bloqueador de auth dual que 3g) que a adquisición.
   - ⬜ — sync de progreso de dispositivos KOReader (ligado a device-pairing). Después de eso: OPDS, DAV, annotations, stats, logs streaming, device pairing (CreateDeviceApiKeyUseCase)...
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

## Fase 2c — Detalle de lo hecho (COMPLETA)

**Decisión clave de esta fase (distinta a 2a/2b):** a diferencia del modal
de Settings, los datos de shelves **no** son fundamentalmente de servidor
— son una lista que se puede mutar localmente de forma coherente. Así que
en vez de usar `notImplemented()` para las acciones, el CRUD completo
(crear/renombrar/borrar/reordenar/guardar reglas) está **100% funcional
contra estado local de React** (`useState` seedeado con `mock-shelves.ts`),
con toasts de éxito reales (`toast.success(...)`) igual que hacía el
original. La Fase 3 solo tiene que reemplazar el backing store (de
`useState` local a `shelfStore` + llamadas a `/api/shelves`) sin tocar la
UI, porque la superficie de funciones del hook ya es la misma forma.

### Modernización respecto al Svelte original
- **Menú contextual del shelf:** el original (`SidebarShelfContextMenu.svelte`)
  calculaba posición manualmente (`getBoundingClientRect`) y renderizaba un
  backdrop a mano. Reemplazado por `DropdownMenu` de shadcn (Base UI) —
  posicionamiento, cierre al hacer click fuera y teclado los resuelve la
  librería. El archivo `SidebarShelfContextMenu.svelte` **no se portó como
  componente aparte**, quedó inline en `shelf-row.tsx`.
- **Selector de emoji:** reemplazado por `Popover` de shadcn en vez del
  backdrop+grid absoluto-posicionado manual.
- **Modal de reglas:** `Dialog` de shadcn resuelve foco/Escape/aria-modal
  nativamente — se eliminó el código manual de focus-trap con `tick()` +
  listeners de teclado que tenía `ShelfRulesModal.svelte`.
- `ConfirmModal.svelte` se convirtió en `src/components/confirm-dialog.tsx`,
  **genérico y reutilizable** (no específico de shelves) como sugería la
  nota de la Fase 2a, usando `Dialog` de shadcn.
- `ShelfRulesHeader`/`ShelfRulesFooter`/`ShelfRulesEmptyState` originales
  (19–29 líneas cada uno) se consolidaron **inline dentro de**
  `shelf-rules-modal.tsx` en vez de archivos separados — eran de un solo uso
  y muy pequeños.

### Archivos creados
- `src/lib/types/library.ts` — `LibraryShelf`, `RuleGroup`/`RuleNode`/
  `ShelfCondition`, `RULE_FIELD_OPTIONS`, `countRuleConditions`,
  `createEmptyRuleGroup` (puerto 1:1 de `Library/Shelf.ts` +
  `Library/ShelfRule.ts`, sin `isRuleGroup`/`parseRuleGroup` — esos son
  validadores de payload de API, se añaden en Fase 3).
- `src/lib/shelf-rules.ts` — puerto 1:1 de `shelfRulesView.ts` (operadores,
  `createRuleCondition`/`createRuleGroup`, helpers de tipo/placeholder).
- `src/components/confirm-dialog.tsx` — genérico, como se comentó arriba.
- `src/components/sidebar/shelves/`:
  - `mock-shelves.ts` — 3 shelves de ejemplo (una con regla simple, una sin
    reglas, una con grupo anidado OR/AND) para poder probar el árbol de
    reglas visualmente.
  - `use-shelf-manager.ts` — hook que porta `sidebarShelfManager.svelte.ts`
    completo: estado de crear/renombrar/borrar/menú/reglas, **y el drag
    reorder por long-press con Pointer Events portado tal cual** (mismo
    umbral de 360ms y 8px de cancelación), pero simplificado porque ya no
    hay paso de "persist" asíncrono que pueda fallar — el reorder local ES
    la persistencia.
  - `shelf-row.tsx`, `shelf-edit-row.tsx`, `shelves-section.tsx` — puertos
    de `SidebarShelfRow`/`SidebarShelfEditRow`/`SidebarShelvesSection`.
  - `shelf-rule-condition-row.tsx`, `shelf-rule-group-header.tsx`,
    `shelf-rules-tree-node.tsx` (recursivo) — puertos de
    `ShelfRuleConditionRow`/`ShelfRuleGroupHeader`/`ShelfRulesTreeNode`.
  - `shelf-rules-modal.tsx` — puerto de `ShelfRulesModal` + sub-componentes
    inline (ver modernización arriba).
- `src/components/sidebar/sidebar.tsx` — la fila "Library" ahora tiene el
  chevron de expandir real, conectado a `useShelfManager`; además ahora lee
  `useSearchParams()` (shelf activo desde `?shelf=`) — **esto obligó a
  envolver `<Sidebar />` en `<Suspense>`** dentro de
  `src/app/(app)/layout.tsx` (Next.js exige esto para cualquier Client
  Component que use `useSearchParams`, si no falla el build con
  "should be wrapped in a suspense boundary").

### Verificación
`bun run build` compila limpio. Probado con Playwright headless el flujo
completo: listar shelves, abrir menú contextual, abrir reglas (incluyendo
el caso con grupo anidado), crear shelf, confirmar borrado con el nuevo
`ConfirmDialog`, y el drawer móvil con la sección de shelves dentro — sin
errores de consola en ningún paso.

---

## Fase 2d — Detalle de lo hecho (COMPLETA)

**Decisión tomada con el usuario:** el login de Z-Library autentica contra
un servicio externo real (vía `ZLibAuthService` → `ZUI.passwordLogin` /
`tokenLogin` → `/api/*`), a diferencia de los shelves no hay un "éxito
local" con sentido — fabricar un estado "Conectado" falso sería engañoso.
Se eligió: **formulario 100% interactivo (tabs, inputs, validación de
campos requeridos) pero submit mock** — al enviar, muestra el toast de
`notImplemented()` y el modal se queda abierto (no finge una conexión
exitosa). Mismo patrón que Account/Devices/Plugin en 2b.

### Archivos creados
- `src/components/zlibrary-auth-modal.tsx` — puerto de
  `ZLibraryAuthModal.svelte`: tabs Email Login/Remix Credentials, campos
  con labels dinámicos según el modo, botón Connect deshabilitado hasta que
  ambos campos tengan contenido. Sin estado de error/loading porque el
  submit no hace una llamada real (eso llega con la Fase 3).
- Cambios de wiring:
  - `src/components/sidebar/settings/settings-modal.tsx` — ahora recibe
    `onOpenZLibraryLogin` como prop en vez de llamar `notImplemented()`
    directamente; se lo pasa a `IntegrationsPane`.
  - `src/app/(app)/layout.tsx` — nuevo estado `zlibModalOpen`, renderiza
    `<ZLibraryAuthModal>` como hermano de `<SettingsModal>`, mismo patrón
    que el resto de modales de la app.
  - `onLogoutZLibrary` en `integrations-pane.tsx` **sigue** en
    `notImplemented()` — no necesita modal, es una acción directa.

### Verificación
`bun run build` compila limpio. Verificado con Playwright: abrir el modal
desde Integrations, cambiar entre tabs, llenar campos (password y remix),
enviar y confirmar que aparece el toast y el modal no se cierra — en light
y dark, sin errores de consola.

---

## Fase 2 — COMPLETA. Qué queda pendiente antes de Fase 3

Estas piezas del `+layout.svelte` original **todavía no se portaron a
ningún lado** (se dejaron fuera del shell desde la Fase 2a a propósito):

- **Registro del service worker** (`navigator.serviceWorker.register(...)`)
  — es JS puro sin dependencias de SvelteKit ni de backend, se podría
  portar en cualquier momento (candidata a hacerse al arrancar la Fase 3,
  o como un paso rápido aparte si se quiere cerrar el root layout antes).
- **Warning de migración de DB** (`databaseMigrationWarning` /
  `shouldShowDatabaseMigrationWarning`, visible arriba del contenido
  cuando `appVersionInfo.database.status` no es `up_to_date`) — depende de
  datos reales de `/api/app-version`, así que tiene sentido esperar a la
  Fase 3 para portarlo con datos de verdad en vez de mock.

No son bloqueantes para arrancar la Fase 3 — son huecos conocidos, no
errores.

---

## Fase 3a — Detalle de lo hecho (COMPLETA)

**Descubrimiento de alcance:** el backend de `sake/` tiene **~90 archivos de
rutas API y ~19,645 líneas** en `src/lib/server/` (arquitectura hexagonal:
`domain/application/infrastructure`, con `use-cases`, `ports`, `repositories`).
Demasiado grande para una sola iteración. Se acordó con el usuario acotar
3a a: **logger + auth local completo (bootstrap/login/logout/status) +
Shelves end-to-end**, dejando todo lo demás (library/books, zlibrary, OPDS,
DAV, devices, annotations, queue, stats, metadata) para 3b en adelante.

### ⚠️ Descubrimiento crítico: `middleware.ts` no existe en Next 16
`AGENTS.md` (auto-generado por `next dev`) advertía de breaking changes.
Se confirmó uno real: **`middleware.ts` está deprecado y renombrado a
`proxy.ts`** desde Next 16 (`node_modules/next/dist/docs/.../proxy.md`).
Quien retome esto: si vas a escribir algo de middleware, el archivo se
llama `proxy.ts`, no `middleware.ts`.

### Decisión de arquitectura: sin `proxy.ts` todavía, auth por-ruta
`proxy.ts` en Next 16 corre en runtime Node.js por defecto (puede usar
Drizzle + `node:crypto` sin problema), pero **solo puede pasar datos a los
Route Handlers vía headers/cookies** — no hay equivalente al
`event.locals.auth` tipado que SvelteKit compartía entre `hooks.server.ts`
y cada `+server.ts`. Además, gran parte de lo que hacía `authHandle` en el
`hooks.server.ts` original (380 líneas) es **lógica de redirect de
páginas** (gating de `/search`, redirect de `/` a `/library`, etc.) — eso
es Fase 4, no Fase 3.

**Decisión tomada (no se volvió a preguntar, es una llamada técnica
clara):** cada ruta protegida resuelve su propia sesión llamando a un
helper compartido (`src/lib/server/auth/require-session.ts` →
`requireSession()`), en vez de centralizar en `proxy.ts`. Cuando la Fase 4
necesite redirects basados en sesión para páginas, ahí sí tiene sentido
añadir `proxy.ts` para ese propósito específico.

### Composition root minimalista
El original tiene un barrel `composition.ts` que re-exporta 7 módulos
(`foundation`, `providers`, `downloads`, `library`, `search`, `auth`,
`integrations`, `annotations`) — importarlo completo instanciaría
repositorios/servicios de subsistemas que ni existen todavía en
`sake-next` (S3Storage, ZLibraryClient, HardcoverClient, BookRepository...).
`sake-next/src/lib/server/application/composition.ts` solo wirea lo que
3a necesita: 4 repositorios (user/session/apiKey/shelf) y 11 use-cases.
**Extender este archivo según se vayan portando más features** — no crear
uno nuevo.

### Gotcha real encontrado en runtime
`getLibsqlConfig()` llama a `resolveInfrastructureConfig(env)`, que
valida **libsql Y S3 juntos** (así era ya en el original — Fase 1 lo portó
tal cual). Sin `S3_*` en `.env`, hasta abrir la conexión a la DB fallaba
con "Missing S3 configuration", aunque las rutas de auth/shelves no tocan
S3 para nada. No es un bug de la migración — es un acoplamiento que ya
existía. Se documenta aquí para que no vuelva a sorprender: **`.env` de
dev necesita `S3_*` aunque sea con valores dummy**, incluso para features
que no usan storage.

### Qué se portó tal cual (sin cambios de lógica, solo de framework)
- `logger.ts` — pino + `pino-pretty`. **Se dejó fuera `webappLogFeed.ts`**
  (199 líneas, stream para el visor de logs en vivo de Settings → Logs,
  que no existe en `sake-next` — es Fase 4). Si se porta ese visor más
  adelante, ahí se retoma.
- Toda la cadena de auth local: `LocalAuthService` (scrypt, tokens),
  `ResolveRequestAuthUseCase`, `Bootstrap/Login/LogoutLocalAccountUseCase`,
  `GetAuthStatusUseCase`, los 3 repositorios Drizzle (`UserRepository`,
  `UserSessionRepository`, `UserApiKeyRepository`), rate limiting de
  login/bootstrap (`rate-limit.ts` — se quitaron las policies de
  `deviceKeyIp`/`deviceKeyUserDevice`, son para pairing de dispositivo
  KOReader, otra feature de 3b+).
- Todo el slice de Shelves: 6 use-cases, `ShelfRepository` (incluye el
  `UPDATE ... CASE WHEN` en SQL crudo para el reorder, con el mismo guard
  de validación de IDs enteros positivos antes de interpolar), 4 route
  handlers.
- `src/lib/types/library.ts` ganó `isRuleGroup`/`parseRuleGroup` (se
  habían omitido a propósito en la Fase 2c, documentado como "Fase 3
  territory" — ya están).

### Qué se simplificó/dejó fuera a propósito
- `auth/cookies.ts`: sin el chequeo de socket de plataforma (no aplica a
  Route Handlers) ni el parseo completo del header `forwarded` — solo
  `x-forwarded-proto` + fallback a la URL (cubre el self-hosting detrás de
  reverse proxy del README). También se quitó `clearZlibraryCookies`
  (cookies `userId`/`userKey` del scraping de Z-Library) — eso es Fase 3b
  cuando se porte zlibrary.
- `ShelfRepositoryPort`: sin `listByIds`/`getBookShelfIds*`/
  `setBookShelfIds` — son para membresía libro↔shelf, parte de la Fase de
  library/books, no de la de shelves en sí.
- `hooks.server.ts` original también dispara jobs de fondo al arrancar
  (purga de trash, sync de plugin KOReader, sync de progreso de
  Hardcover, índice de anotaciones) — **nada de eso se portó**, son
  features de 3b+ que no existen aún en `sake-next`.
- `http/api.ts`: solo `apiOk`/`apiError`/`errorResponse` — se dejaron
  fuera `withResponseHeader`/`getErrorMessage`/`attempt`, no los usa nada
  de lo portado hasta ahora.

### Frontend conectado de verdad
- `src/lib/client/shelves-api.ts` — cliente fetch nuevo (no existía algo
  así en 2c, que era 100% local).
- `src/components/sidebar/shelves/use-shelf-manager.ts` — reescrito para
  cargar shelves reales al montar (`useEffect` + `ShelvesApi.list()`) y
  llamar a la API real en create/rename/delete/rules/reorder, con
  `toast.error(...)` en fallos y **revert local si el reorder falla en el
  servidor** (antes no había paso de persistencia que pudiera fallar).
  Se agregaron estados `isMutatingShelves`/`isDeletingShelf`/
  `isSavingShelfRules` y se propagaron como `pending`/`disabled` a
  `ConfirmDialog`, `ShelfRulesModal` y `ShelfEditRow` (antes no existían
  porque las mutaciones locales eran síncronas).

### Setup de desarrollo
- `sake-next/.env` creado (gitignored) con `LIBSQL_URL=file:./.data/dev.db`
  + `S3_*` dummy (ver gotcha arriba). `/.data/` añadido a `.gitignore`.
- `bun run db:migrate` corrido contra esa DB local — las 26 migraciones de
  la Fase 1 aplican limpio.
- **No hay página de login todavía** (Fase 4) — para probar rutas
  protegidas, autenticar vía `POST /api/auth/bootstrap` (primera cuenta) o
  `/api/auth/login` directamente (curl, o `page.request.post(...)` en
  Playwright), la cookie de sesión queda seteada para el resto de la
  sesión del navegador.

### Verificación
`bun run build` compila limpio, las 8 rutas nuevas aparecen como `ƒ
(Dynamic)`. Probado con `curl` el flujo completo (status → bootstrap →
status → shelves CRUD → reorder → logout → 401) contra SQLite real. Luego
verificado end-to-end con Playwright **a través de la UI real** (no mocks):
login vía API, crear shelf desde el Sidebar, **reload de página** para
confirmar que persiste en servidor, abrir/guardar reglas, reload de nuevo,
borrar, reload, logout, confirmar 401. Sin errores de consola inesperados.

---

## Fase 3b — Detalle de lo hecho (COMPLETA)

**Alcance confirmado al leer los archivos propuestos:** las pestañas
Account (`auth/me`, `auth/api-keys`, `auth/logout-all`,
`auth/basic-password`) y Devices del modal de Settings, mockeadas desde la
Fase 2b. Todo el código leído era pequeño (~700 líneas totales, menos que
3a) — **no hubo necesidad de re-acotar con el usuario**, a diferencia de lo
que pasó con el login en 3a.

### Descubrimiento: `CreateDeviceApiKeyUseCase` no era parte de esta UI
El prompt de continuación listaba `CreateDeviceApiKeyUseCase` como posible
dependencia. Al leerlo: es el flujo de **pairing del plugin KOReader**
(`POST /api/auth/device-key` con username+password+deviceId → emite una API
key) — una ruta completamente distinta a la que usa el modal de Settings.
**No se portó.** Los `Device*RepositoryPort` se recortaron en consecuencia
(`ports.ts`) a solo los métodos que sí usan `ListDevicesUseCase`/
`DeleteDeviceUseCase` — `upsert`/`getByDeviceId` del repo de devices y la
mayoría de métodos de `DeviceDownloadRepository`/
`DeviceProgressDownloadRepository` (son del flujo de descargas de
libros, Fase de library/books) quedaron fuera.

### Archivos creados
- `src/lib/server/domain/device.ts` — entidad `Device`.
- `ports.ts` ganó `DeviceRepositoryPort`/`DeviceDownloadRepositoryPort`/
  `DeviceProgressDownloadRepositoryPort`, recortados como se explicó arriba.
- 3 repositorios nuevos (`device-repository.ts`,
  `device-download-repository.ts`, `device-progress-download-repository.ts`),
  también recortados a los métodos usados.
- 8 use-cases nuevos: `get-current-user`, `list-active-api-keys`,
  `revoke-api-key`, `logout-all-local-sessions`, `set-basic-auth-password`,
  `clear-basic-auth-password`, `list-devices`, `delete-device`.
- 7 route handlers: `/api/auth/me` (GET), `/api/auth/api-keys` (GET),
  `/api/auth/api-keys/[id]` (DELETE), `/api/auth/logout-all` (POST),
  `/api/auth/basic-password` (PUT/DELETE), `/api/devices` (GET),
  `/api/devices/[deviceId]` (DELETE). Todos protegidos con el mismo
  `requireSession()` de 3a.
- `composition.ts` extendido con los 3 repos + 8 use-cases nuevos.

### Refactor de limpieza: cliente API compartido
`shelves-api.ts` (3a) tenía su propio helper `request<T>()` duplicado. Con
dos clientes nuevos a punto de repetirlo (`account-api.ts`,
`devices-api.ts`), se factorizó a `src/lib/client/api-client.ts`
(`request<T>()` + `errorMessage()`, esta última también usada por
`use-shelf-manager.ts` — antes tenía su propia copia local).

### Frontend conectado de verdad
- `src/components/sidebar/settings/use-account-data.ts` y
  `use-devices-data.ts` — mismo patrón de hook que `use-shelf-manager.ts`
  (2c/3a): estado + loading/error + acciones que pegan a la API real.
  **Diferencia clave:** a diferencia de shelves (que carga al montar el
  Sidebar), estos hooks solo cargan datos **cuando el modal de Settings
  está abierto** (`enabled: open`) — si cargaran siempre, cada carga de
  `/library` dispararía 3 requests (`me`, `api-keys`, `devices`) aunque el
  usuario nunca abra Settings. Esto replica el `openModal()` del original,
  que disparaba los loads explícitamente al abrir.
- `account-pane.tsx`, `api-key-list.tsx`, `devices-pane.tsx` — ya no usan
  `notImplemented()`; reciben las acciones reales como props (mismo patrón
  de props que ya tenían, solo se conectó el callback real).
- `settings-modal.tsx` gana un prop `onSessionEnded`, pasado desde
  `(app)/layout.tsx` como `window.location.href = "/"` — **recarga
  completa de página**, no `router.push`, para limpiar cualquier estado
  cliente que dependa de la sesión (p.ej. la lista de shelves del Sidebar,
  que no tiene forma de enterarse de que la sesión murió). Logout y
  Logout-All usan el mismo callback.
- `mock-data.ts` perdió `mockCurrentUser`/`mockApiKeys`/`mockDevices`
  (dead code una vez conectado lo real) — quedan solo los mocks de
  App/Plugin/Integrations, que siguen pendientes.

### Verificación
`bun run build` limpio, 7 rutas nuevas como `ƒ (Dynamic)` (23 rutas API en
total). Sin datos de prueba disponibles vía UI para api-keys/devices (ese
flujo es `CreateDeviceApiKeyUseCase`, fuera de alcance), así que se
insertaron filas de prueba directamente con un script `@libsql/client`
contra `.data/dev.db` — **si vuelves a necesitar esto**, cuidado con
reusar un `key_hash`/`device_id` ya existente (hay constraints únicos;
revocar/borrar no elimina la fila vieja, solo la marca). Probado con
`curl` (me, api-keys list, devices list, set/clear basic-password,
logout-all → 401 después) y luego **end-to-end con Playwright a través de
la UI real**: login, pestaña Account con datos reales del usuario,
guardar/quitar basic-auth password, revocar API key (con toast), pestaña
Devices, borrar device, y logout que redirige de verdad a `/` (la cookie
de sesión queda invalidada). Sin errores de consola inesperados.

---

## Fase 3c — Detalle de lo hecho (COMPLETA)

**Alcance confirmado al leer el código:** Plugin fue de verdad el candidato
más chico (routes + use-cases ~290 líneas), pero **creció al leer más
profundo**: `GetKoreaderPluginDownloadUseCase` necesita `StoragePort`/S3 —
nada en `sake-next` lo usaba todavía (primera vez que se toca storage de
archivos). Y la tabla `pluginReleases` estaba vacía (el job de sync nunca
corrió — se excluyó a propósito en 3a junto con el resto de jobs de
arranque de `hooks.server.ts`). Se decidió portar el round-trip completo
(`S3Storage` + `SyncKoreaderPluginReleaseUseCase` +
`KoreaderPluginArtifactService`, ~290 líneas más, total ~950) en vez de
dejar el Plugin pane con datos vacíos — y se verificó con S3 real, no
mockeado.

### Infra de testing: S3 real local, no mocks
`docker-compose.selfhost.yaml` (del proyecto Svelte original) ya define
`seaweedfs` + `seaweedfs-init` (SeaweedFS, S3-compatible). **Resulta que ya
había un contenedor `sake-seaweedfs` corriendo** (de trabajo previo del
usuario con la app original, no algo que esta sesión arrancara) — se
reutilizó tal cual, sin tocarlo. `sake-next/.env` se actualizó con las
credenciales reales de `sake/.env.docker.selfhosted`
(`S3_ENDPOINT=http://localhost:8333`, bucket `sake`, etc.). El primer sync
encontró que el artifact ya existía en ese bucket real (`uploaded: false`,
`445707c5...` el mismo sha256) — confirma interop genuina con datos reales
del proyecto original, no un bucket vacío de prueba.

**Si retomas esto en otra máquina o el contenedor no está corriendo:**
`docker compose -f docker-compose.selfhost.yaml up -d seaweedfs seaweedfs-init`
desde la raíz del repo (no desde `sake-next/`).

### Cómo se disparó el sync (sin inventar un endpoint nuevo)
El original dispara `SyncKoreaderPluginReleaseUseCase` como side-effect de
arranque en `hooks.server.ts` (`triggerPluginSyncOnStartup`) — ese patrón
completo de "jobs en background al arrancar el server" sigue
deliberadamente sin portar (ver nota de 3a). Replicarlo en Next.js no es
trivial: no hay equivalente directo a "código que corre una vez al boot
del proceso" de forma confiable en dev (Turbopack compila rutas on-demand).
**Decisión:** no inventar una ruta HTTP nueva ni un hack de side-effect en
un route handler — se invocó el use-case directamente con un script
desechable (`bun run --env-file=.env _test-sync.ts`, borrado después de
usarlo, igual que el seed de 3b). **Cómo arrancan los jobs de fondo en el
self-hosted de Next.js (sync de plugin, purga de trash, Hardcover, índice
de anotaciones) sigue siendo una decisión de arquitectura pendiente** —
probablemente un comando de arranque del Docker entrypoint o un cron
dedicado, no algo para resolver de paso en una mini-fase de UI. Queda
anotado para cuando se porte ese subsistema completo.

### Archivos creados
- `src/lib/server/domain/plugin-release.ts` — entidad `PluginRelease`.
- `ports.ts` ganó `PluginReleaseRepositoryPort`, `StoragePort` y
  `StorageObjectInfo` (sin recortar — a diferencia de los puertos de 3b,
  acá sí se usan todos los métodos).
- `src/lib/server/infrastructure/storage/s3-storage.ts` +
  `s3-list-pagination.ts` — puerto verbatim de `S3Storage`/
  `listAllS3Objects`. Registrado en `composition.ts` como
  `createLazySingleton(() => new S3Storage())`, mismo patrón que
  `drizzleDb` — no abre conexión S3 hasta el primer uso real.
- `src/lib/server/infrastructure/repositories/plugin-release-repository.ts`.
- `src/lib/server/application/services/koreader-plugin-version.ts` +
  `koreader-plugin-artifact-service.ts` (este último construye el .zip del
  plugin leyendo `koreaderPlugins/sake.koplugin/` en disco — el segundo
  candidato de ruta, `../koreaderPlugins/sake.koplugin` relativo al cwd de
  `sake-next/`, resuelve correcto a la carpeta real en la raíz del repo sin
  cambios).
- 5 use-cases: `sync-koreader-plugin-release`, `get-latest-koreader-plugin`,
  `list-koreader-plugin-releases`, `get-koreader-plugin-upstream-version`,
  `get-koreader-plugin-download`.
- 4 route handlers, **sin `requireSession()`** — son públicas en el
  original (`isPublicApiRoute` del `hooks.server.ts`, porque el plugin de
  KOReader en el dispositivo las llama sin sesión de navegador):
  `/api/plugin/koreader/releases`, `/latest`, `/download`,
  `/upstream-version`.
- Nueva dependencia: `jszip` (no estaba en `sake-next`, Fase 1 la había
  diferido para "cuando se migre el lector" — resultó necesitarse antes,
  para construir el zip del plugin).

### Frontend conectado de verdad
- `src/lib/client/plugin-api.ts` + `use-plugin-data.ts` — mismo patrón de
  hook que Account/Devices (carga solo con el modal abierto). Particularidad:
  un 404 "Plugin releases not found" (nada sincronizado todavía) se trata
  como **lista vacía válida**, no como error — coincide con el estado real
  de un self-host recién instalado antes de que corra el sync.
- `plugin-pane.tsx` ya no usa `notImplemented()` — `onRefresh`/
  `onCheckUpstream` reales. El botón "Download" ya funcionaba como `<a
  href>` directo desde la Fase 2b (apuntando a `downloadUrl` del backend),
  así que no necesitó cambios — solo empezó a apuntar a una URL real en
  vez de placeholder `"#"`.
- `mock-data.ts` perdió `mockPluginReleases`/`mockPluginUpstreamVersion`.

### Verificación
`bun run build` limpio (24 rutas API en total). El sync real contra S3
local logueó cada paso (detección de versión, build del zip, upload
omitido por ya existir, upsert en DB). Luego **end-to-end con Playwright a
través de la UI real**: las 4 rutas devuelven datos reales por `curl`
primero, y después, **descarga real de un archivo** haciendo click en el
botón "Download" de la UI (Playwright capturó el evento de descarga del
navegador, 31,637 bytes, mismo tamaño que por `curl`), más "Check
upstream" contactando a GitHub de verdad (`raw.githubusercontent.com`) y
mostrando "Up to date". Sin errores de consola.

---

## Fase 3d — Detalle de lo hecho (COMPLETA)

**Alcance acotado al leer el código, confirmando la sospecha del usuario:**
`HardcoverProgressSyncService.ts` (495 líneas) importa `BookRepositoryPort`
y la entidad `Book` — el `.reconcile()` real itera sobre libros de la
librería para sincronizar progreso de lectura. **Ese dominio
(library/books) no existe todavía en `sake-next` en absoluto** — ni
siquiera `GetHardcoverProgressSyncStatusUseCase` (29 líneas, el más chico)
se puede portar con sentido sin inventar un stub falso del lado del
service de sync. **Decisión: Hardcover queda completamente fuera de esta
fase**, incluyendo status/toggle — no solo el trigger de sync real. Se
retoma cuando se porte library/books (probablemente como parte de esa
fase, no antes). Z-Library mirrors, en cambio, resultó exactamente del
tamaño esperado (~150 líneas, sin cliente externo — es solo
config/repositorio) y se portó completo.

### Archivos creados
- `src/lib/server/config/zlibrary.ts` — solo
  `resolveZLibraryMirrorUrls`/`normalizeZLibraryMirrorUrls`/
  `normalizeZLibraryUrl` (validación de URLs HTTPS, máx 5 mirrors). Se
  dejaron fuera `resolveZLibraryBaseUrl`/`buildZLibraryUrl`/las constantes
  de timeout — son del `ZLibraryClient` real (búsqueda/descarga), no de la
  gestión de mirrors en sí.
- `src/lib/server/config/demo-mode.ts` — `isDemoMode()`, 3 líneas, puerto
  verbatim (no existía nada de demo mode en `sake-next` todavía).
- `ports.ts` ganó `ZLibraryMirrorSettingsPort` (sin recortar, se usan los
  2 métodos).
- `src/lib/server/infrastructure/repositories/zlibrary-mirror-settings-repository.ts`.
- `src/lib/server/application/use-cases/zlibrary-mirror-settings.ts` —
  ambos use-cases (`Get`/`Update`) en un solo archivo, igual que el
  original los organizaba juntos.
- 1 route handler protegido con `requireSession()` (a diferencia de las
  rutas de Plugin, estas sí requieren sesión en el original — las usa el
  navegador desde Settings, no el dispositivo KOReader):
  `/api/integrations/zlibrary/mirrors` (GET, PUT).
- `composition.ts` — `zlibraryMirrorSettingsRepository` se instancia
  **eager** (no lazy singleton) pasándole
  `resolveZLibraryMirrorUrls(process.env.ZLIBRARY_BASE_URL)` como fallback
  — mismo patrón que el `foundation.ts` original. No requiere la env var
  (tiene default `https://z-lib.gl` si no está seteada).

### Frontend: una sola pestaña, dos mitades con estado distinto
`integrations-pane.tsx` ahora es un caso mixto a propósito: la sección
**Mirrors** está 100% conectada (`use-zlibrary-mirrors.ts`, carga al abrir
el modal, guarda de verdad, persiste entre reloads), mientras que
**Hardcover**, debajo en la misma pestaña, **sigue mockeada** con
`notImplemented()` — documentado en el propio componente/handoff, no es un
olvido. El patrón de sincronización del draft de edición (`mirrors` local
+ `useEffect` para resetear desde el valor guardado del servidor) es el
mismo que ya se usaba para el password de basic-auth en Account (Fase 3b).

### Verificación
`bun run build` limpio (25 rutas API en total — el build tardó ~4.4min
esta vez en vez de los ~10-35s habituales, probablemente contención de
I/O/antivirus en la máquina, no un problema del código). Probado con
`curl`: 401 sin sesión, fallback por defecto (`https://z-lib.gl`) sin fila
en DB, replace + persistencia, y validación real (URL no-HTTPS rechazada,
array vacío rechazado). Luego **end-to-end con Playwright a través de la
UI real**: editar/añadir mirrors, guardar (con toast de confirmación), y
**reload completo de página** para confirmar que los 3 mirrors
persistieron en el servidor — con Hardcover visible debajo mostrando sus
datos mock sin interferir.

---

## Fase 3e — Detalle de lo hecho (COMPLETA)

**Scoping confirmado antes de escribir código:** se leyeron los 5 archivos
reales que el usuario pidió gauge-ar
(`sake/src/routes/api/app/version/+server.ts` 40 líneas,
`GetAppVersionUseCase.ts` 68 líneas, `webappVersion.ts` 26 líneas,
`MigrationStatusRepository.ts` 211 líneas, `MigrationStatusPort.ts` 10
líneas — total ~355 líneas). Confirmado: cero dependencias de
books/clientes externos, toda la lógica es Node puro (`crypto`/`fs`/`path`)
+ Drizzle leyendo `drizzle/meta/_journal.json` y la tabla
`__drizzle_migrations`, infraestructura que `sake-next` ya tenía desde la
Fase 1 (carpeta `drizzle/` copiada + migraciones ya aplicadas en
`.data/dev.db`). Cupo entera en una mini-fase corta, tal como se
sospechaba.

### Archivos creados
- `ports.ts` ganó `MigrationStatusPort`/`MigrationStatusSnapshot` (sin
  recortar — un solo método, `getSnapshot()`).
- `src/lib/server/infrastructure/repositories/migration-status-repository.ts`
  — port verbatim del original: hashea cada `drizzle/<tag>.sql` con
  SHA-256, cachea el journal en memoria, cruza contra la fila más reciente
  de `__drizzle_migrations` vía `drizzleDb.$client.execute()` con SQL
  crudo. Único cambio real: `resolveProjectRoot()` del original se
  colapsó a `process.cwd()` directo (ya no hace falta la indirección, no
  hay nada SvelteKit-específico que resolver).
- `src/lib/webapp-version.ts` — `createWebappVersion()`, normaliza
  strings opcionales, default `version: "dev-local"`.
- `src/lib/server/application/use-cases/get-app-version.ts` —
  `GetAppVersionUseCase`, con el mismo fallback a
  `status: "unavailable"` si `migrationStatusPort.getSnapshot()` lanza
  (DB no disponible no debe tumbar el endpoint de versión).
- Route handler **público** (sin `requireSession()`, igual que el
  original — la pantalla de login necesita poder leer la versión antes de
  tener sesión): `/api/app/version` (GET).
- `composition.ts` — `migrationStatusRepository` + `getAppVersionUseCase`
  wireados, eager (no lazy singleton, igual que
  `zlibraryMirrorSettingsRepository`).
- Frontend: `use-app-version.ts` (hook que fetch-ea solo cuando el modal
  está `open`, mismo patrón que `usePluginData`/`useZlibraryMirrors`) +
  `src/lib/client/app-version-api.ts`. `settings-modal.tsx` ahora pasa
  datos reales a `AppPane` en vez de `mockAppVersion`; `appEnvironment`
  se resuelve con `process.env.NODE_ENV === "production" ? "Production" :
  "Development"` (equivalente Next.js al booleano `dev` de
  `$app/environment` que usaba el original). `mock-data.ts` perdió
  `mockAppVersion` — solo queda `mockHardcoverStatus`.

### Verificación
`bun run build` limpio (23 rutas, incluye `/api/app/version`). `curl` al
build de producción real (`bun run start`) confirmó 200 sin sesión con
los datos reales de la DB local:
`{"version":"dev-local",...,"database":{"status":"up_to_date","currentMigrationTag":"0025_zlibrary_mirror_settings",...}}`
— coincide exactamente con la última migración aplicada en
`.data/dev.db`. Nota operativa: la primera verificación pegó por error
contra un servidor `dev` viejo que había quedado corriendo de una sesión
anterior ocupando el puerto 3000 (`bun run start` falló con
`EADDRINUSE` silenciosamente en background); se detectó porque el pane
mostraba "Environment: Development" en vez de "Production", se mató el
proceso viejo y se repitió la verificación contra el build real. Luego
**Playwright end-to-end contra la UI real**: login, abrir Settings (pestaña
App es la default), confirmar que Version/Database Version/Migration
Status/Environment muestran los valores reales del servidor, captura de
pantalla, **reload completo de página** y reapertura del modal para
confirmar que se vuelve a pedir al servidor (no es estado cliente
cacheado) — mismos valores, sin errores de consola en ningún punto.

---

## Fase 3f — Detalle de lo hecho (COMPLETA)

**Sesión de scoping dedicada para `library/books`, tal como pidió el
usuario.** Mapeo completo antes de escribir código: capa de datos (`Book`
entity 84 líneas + `BookRepositoryPort` 53 + `BookRepository` 408 + helpers
211 + `BookProgressHistoryRepository` 115 ≈ 871 líneas), 47 use-cases
relacionados con books/library/progress/rating/trash/cover/download (3,353
líneas combinadas), más dos subsistemas aparte: metadata providers (3,346
líneas) y el cliente de Z-Library (1,071 líneas). Total si se tomara todo
junto: ~8,600 líneas — confirmó que esto es un sub-proyecto de varias
mini-fases, no una sola.

**Troceo propuesto y confirmado con el usuario** (por dependencia, cada
uno en su propia sesión futura): 3f núcleo (este) → 3g progreso/rating →
3h papelera → 3i portadas (upload/import) → 3j+ metadata providers (otra
sub-fase de scoping) → adquisición Z-Library real (ligada al login real ya
diferido a Fase 4). También se decidió la metodología de verificación
mientras no exista UI de biblioteca real: **backend-only, build + curl +
inspección directa de DB/S3**, sin adelantar ninguna pieza de la Fase 4.

**3f en sí se acotó más de lo que sugería el estimado inicial**: en vez de
portar los 26 métodos de `BookRepositoryPort`, se recortó a los **2 que
usan los use-cases elegidos** (`getAll`, `getById`) — mismo patrón de
"recortar puertos a lo que se usa" que en fases anteriores. Igual con
`ManagedBookCoverService.ts` (801 líneas originales, es el servicio que
descarga/genera portadas desde Z-Library) — `GetLibraryCoverUseCase` solo
necesita 2 funciones puras (`buildManagedBookCoverStorageKey`,
`isValidManagedBookCoverFileName`) que se extrajeron a un archivo propio de
~15 líneas, sin arrastrar la clase completa. Con eso, el footprint real de
3f quedó en **~700 líneas**, bastante menor que la estimación inicial de
scoping.

**Alcance explícitamente excluido de 3f** (una ruta que casi se incluye
por error): `/api/library/[title]` (`GetLibraryFileUseCase` GET +
`PutLibraryFileUseCase` PUT + `DeleteLibraryFileUseCase` DELETE en el
mismo route). Se decidió dejarlo fuera — el PUT es literalmente lo que
escribe el archivo cuando se descarga un libro de Z-Library, así que esta
ruta pertenece a la mini-fase de adquisición, no al núcleo de "ver tu
colección". El núcleo usa `GetLibraryBookContentUseCase` (por `bookId`,
específico del lector web EPUB) en su lugar.

### Archivos creados
- `src/lib/server/domain/book.ts` — entidad `Book` completa (todos los
  campos, igual que el original; los tipos `CreateBookInput`/
  `UpdateBookMetadataInput` se dejaron fuera por ahora, no los usa nada en
  3f).
- `src/lib/server/constants/mime-types.ts` — `mimeTypes`, verbatim.
- `ports.ts` ganó `BookRepositoryPort` (recortado a `getAll`/`getById`,
  comentario documentando qué falta y a qué mini-fase pertenece cada
  método), y `ShelfRepositoryPort`/`DeviceDownloadRepositoryPort` se
  extendieron con los métodos de asignación de estantes
  (`listByIds`/`getBookShelfIds`/`getBookShelfIdsForBooks`/
  `setBookShelfIds`) y `getByBookId` respectivamente.
- `src/lib/server/infrastructure/repositories/book-repository.helpers.ts`
  — `bookSelection`/`bookSelectionWithDownloadState`/`mapBookRow`/
  `mapBookWithDownloadRow` (sin `toCreateBookRow`/`toUpdateBookMetadataRow`,
  no hace falta todavía).
- `src/lib/server/infrastructure/repositories/book-repository.ts` —
  `BookRepository` con solo `getAll`/`getById`.
- `src/lib/server/application/services/managed-book-cover.ts` — las 2
  funciones puras que necesita `GetLibraryCoverUseCase`.
- 5 use-cases: `list-library.ts`, `get-library-book-detail.ts`,
  `get-library-book-content.ts`, `get-library-cover.ts`,
  `set-book-shelves.ts`.
- `shelf-repository.ts` y `device-download-repository.ts` extendidos
  (métodos nuevos, mismo patrón de transacción Drizzle para
  `setBookShelfIds` que el original).
- 5 rutas, todas con `requireSession()` (ninguna está en el allowlist
  público): `/api/library/list` (GET), `/api/library/[id]/detail` (GET),
  `/api/library/[id]/content` (GET, stream EPUB), `/api/library/covers/
  [fileName]` (GET), `/api/library/[id]/shelves` (PUT).
- `composition.ts` — `bookRepository` + los 5 use-cases wireados,
  reutilizando `shelfRepository`/`deviceDownloadRepository`/`storage` ya
  existentes.

### Verificación
`bun run build` limpio (28 rutas en total). Backend-only por la decisión
de metodología: script desechable (`_seed-library-3f.ts`, borrado antes de
commit) insertó un libro real en `.data/dev.db` vía Drizzle directo y subió
un EPUB falso + una portada falsa al bucket real de SeaweedFS
(`library/test-book-3f.epub`, `covers/test-book-3f-cover.jpg`). Contra el
build de producción real (`bun run start`) con `curl` y sesión real:
- `GET /api/library/list` sin sesión → 401; con sesión → libro real con
  `progressPercent`/`shelfIds` calculados.
- `GET /api/library/:id/detail` → shape completo correcto.
- `GET /api/library/:id/content` → sirve los bytes EPUB reales desde S3
  con `Content-Type: application/epub+zip`.
- `GET /api/library/covers/:fileName` → sirve los bytes de portada reales
  desde S3 con el content-type correcto.
- `PUT /api/library/:id/shelves` → creó un estante real, asignó el libro,
  y se confirmó la persistencia re-consultando `detail` y `list` (ambos
  reflejan `shelfIds` actualizado).
- Casos borde: id inválido → 400, libro inexistente → 404, nombre de
  portada con path traversal (`../../etc/passwd`) → 404 (rechazado por el
  regex de nombre válido), portada inexistente con nombre válido → 404.

No se tocó `/library` (sigue siendo el placeholder de Fase 4) ni se montó
ninguna UI — consistente con la decisión de verificación tomada al
iniciar esta fase.

---

## Fase 3g — Detalle de lo hecho (COMPLETA)

**Scoping confirmado antes de escribir código, con un corte explícito
acordado con el usuario.** Los 7 candidatos originales (`PutProgress`,
`GetProgress`, `PutWebReaderProgress`, `GetBookProgressHistory`,
`UpdateBookRating`, `ListLibraryRatings`, `UpdateLibraryBookState`) se
dividen en dos grupos con requisitos de auth completamente distintos:

- **4 piezas simples** (`ListLibraryRatings`, `GetBookProgressHistory`,
  `UpdateBookRating`, `UpdateLibraryBookState`): auth por sesión estándar
  (`requireSession()`), mismo patrón que toda la Fase 3. `ListLibraryRatings`
  resultó ser **pública** en el original (`isPublicApiRoute` permite GET sin
  sesión) — se portó igual, sin `requireSession()`.
- **`PutWebReaderProgress`** (autosave del lector web EPUB): también
  session-only, pero arrastra su propio subsistema (ver abajo).
- **`PutProgress`/`GetProgress`** (sync real de dispositivos KOReader, el
  endpoint que usa el plugin del e-reader): al leer la ruta original
  (`/api/library/progress`), se descubrió que acepta auth **por sesión O por
  API key de dispositivo** (`resolveAuthorizedDeviceId` lee
  `locals.auth.type === 'api_key'`, poblado centralmente por el
  `hooks.server.ts` original). El `requireSession()` de `sake-next`
  **rechaza explícitamente** actors que no sean `session` — no sirve tal
  cual para esta ruta. Soportarla de verdad requiere un helper de auth
  nuevo (dual: sesión o API key), y la emisión real de esas API keys de
  dispositivo (`CreateDeviceApiKeyUseCase`) sigue sin portar desde la Fase
  3b. **Decisión tomada con el usuario: `PutProgress`/`GetProgress` quedan
  fuera de 3g**, diferidas a cuando se retome el device-pairing completo
  (mismo bloqueador). El resto de 3g (session-only) se portó entero.

### Descubrimiento de tamaño real: la librería Lua de KOReader
`PutWebReaderProgressUseCase` depende de `mergeKoreaderSidecar`/
`parseKoreaderSidecar` (`koreaderSidecar.ts`, 274 líneas), que a su vez
depende de un parser/serializador de tablas Lua completo escrito a mano
(`luaData.ts` 183 + `luaValue.ts` 163 líneas, usa el paquete npm
`luaparse` — **nueva dependencia**, no estaba en `sake-next`, igual que
`jszip` en 3c). Es decir: portar una sola ruta de autosave arrastró
**620 líneas de infraestructura de parsing del formato `.sdr` de
KOReader** (el metadata sidecar que lee/escribe el dispositivo físico),
no solo las ~100 líneas del use-case en sí. Se portó **verbatim, sin
recortar** — es lógica pura (sin dependencias de SvelteKit), y la
necesitará también la futura mini-fase de sync de dispositivos KOReader
que comparte el mismo formato de archivo.

**Único cambio real de framework** (no de lógica): dos literales BigInt
(`0xcbf29ce484222325n`) en `createAnnotationVersion` no compilan con el
`target: "ES2017"` de `tsconfig.json` de `sake-next` (BigInt literals
necesitan ES2020+). Se reescribieron como `BigInt("0x...")` — mismo
resultado en runtime, sin tocar el `target` del proyecto completo por una
función que ni siquiera usa ningún use-case portado todavía
(`createAnnotationVersion`/`createAnnotationId` son del futuro sistema de
annotations, no de progreso).

### `ProgressPersistenceService`: recortado de dependencias opcionales, no de forma
El servicio compartido que persiste cualquier actualización de progreso
(`ProgressPersistenceService`, 153 líneas) normalmente acepta
`HardcoverProgressSyncPort` y `AnnotationIndexService` como parámetros
**opcionales** en el constructor. Ninguno de los dos existe en
`sake-next` (Hardcover sigue bloqueado desde 3d/3f; annotations ni se ha
scopeado). Se portó **sin esos dos parámetros** (no como `undefined`
explícito, directamente fuera de la firma) — se reintroducen cuando se
porten esos subsistemas. El resto de la lógica (upload a S3, actualizar
`BookRepository`, snapshot de historial con guard de tabla-no-existe,
marcar confirmación de dispositivo) se portó tal cual.

`DeviceProgressDownloadRepositoryPort` ganó `upsertByDeviceAndBook`
(antes recortado a solo `deleteByDeviceId` en 3b) — en la práctica **no
se ejerce en 3g** (`PutWebReaderProgress` nunca pasa `deviceId`), pero se
portó completo en vez de dejarlo a medias porque `ProgressPersistenceService`
es el mismo servicio que usará el futuro sync de dispositivos KOReader.

### Archivos creados
- `src/lib/koreader/lua-value.ts`, `lua-data.ts`, `koreader-sidecar.ts` —
  parser/serializador Lua + formato de sidecar KOReader, verbatim (ver
  arriba).
- `src/lib/server/domain/value-objects/progress-file.ts` — descriptor de
  archivo de progreso (`buildProgressFileDescriptor`,
  `buildProgressLookupTitleCandidates`), verbatim, sin dependencias.
- `src/lib/server/domain/book-progress-history.ts` — entidad
  `BookProgressHistory`.
- `src/lib/server/infrastructure/repositories/book-progress-history-repository.ts`
  — `appendSnapshot`/`upsertReaderSessionSnapshot`/`getByBookId`, verbatim
  (usa los `UNIQUE` de `(bookId, recordedAt)` y `(bookId, readerSessionId)`
  que ya traía el schema desde la Fase 1).
- `src/lib/server/application/services/progress-book-resolver.ts`,
  `progress-persistence-service.ts` (ver recorte arriba),
  `sidecar-write-coordinator.ts` — puertos de los 3 servicios de soporte.
- 5 use-cases: `list-library-ratings.ts`, `get-book-progress-history.ts`,
  `update-book-rating.ts`, `update-library-book-state.ts` (sin
  `HardcoverProgressSyncPort`, mismo motivo que `ProgressPersistenceService`),
  `put-web-reader-progress.ts`.
- `src/lib/server/http/web-reader-progress-request.ts` — parser/validador
  del body JSON del autosave, verbatim.
- `ports.ts` — `BookRepositoryPort` ganó `getByStorageKey`/
  `updateProgress`/`updateRating`/`updateState`; nuevo
  `BookProgressHistoryRepositoryPort`; `DeviceProgressDownloadRepositoryPort`
  ganó `upsertByDeviceAndBook`.
- `book-repository.ts` ganó esos 4 métodos (rutas Drizzle directas, sin
  sorpresas) + un `repoLogger` que antes no tenía (solo tenía lecturas).
- `device-progress-download-repository.ts` ganó `upsertByDeviceAndBook`.
- 5 rutas: `/api/library/ratings` (GET, **pública**), `/api/library/[id]/
  progress-history` (GET), `/api/library/[id]/rating` (PUT), `/api/library/
  [id]/state` (PUT), `/api/library/progress/web` (PUT) — las 4 últimas con
  `requireSession()`.
- `composition.ts` — nuevo `bookProgressHistoryRepository`,
  `sidecarWriteCoordinator`, `progressBookResolver` y
  `progressPersistenceService` (estos dos últimos no exportados, solo
  usados para construir `putWebReaderProgressUseCase`) + los 5 use-cases.
- Nueva dependencia: `luaparse` + `@types/luaparse` (instalado con
  `bun add`).

### Verificación
`bun run build` limpio (33 rutas API en total). Backend-only, mismo
patrón que 3f: puerto 3000 verificado libre antes de levantar
(`netstat -ano | grep ':3000'`), contenedor `sake-seaweedfs` ya corriendo
reutilizado tal cual. Script desechable (`_seed-session-3g.ts`, borrado
antes de terminar la sesión) creó una sesión real para el usuario ya
existente en `.data/dev.db` (sin exponer su password) y confirmó que el
libro de prueba de la Fase 3f (`test-book-3f.epub`, id 1) seguía ahí.
Contra el build de producción real (`bun run start`) con `curl`:
- `GET /api/library/ratings` sin cookie → 200 con lista vacía (confirma
  que es pública).
- `GET /api/library/:id/progress-history` sin sesión → 401; con sesión,
  libro válido → 200 vacío; id no numérico → 400.
- `PUT /api/library/:id/rating` → rating fuera de rango (9) → 400; rating
  válido (4) → persiste, y `GET /api/library/ratings` lo refleja de
  inmediato (ruta pública, sin cache); libro inexistente → 404. Reseteado
  a `null` al final para dejar el libro de prueba limpio.
- `PUT /api/library/:id/state` → sin campos → 400; `isRead: true` →
  `progressPercent` salta a 1, `readAt` se setea, reflejado en
  `GET /api/library/:id/detail`; `archived: true` → `excludeFromNewBooks`
  se activa en cascada (`effectiveExclude`); revertido a estado limpio
  (`archived: false, isRead: false`) al final.
- `PUT /api/library/progress/web` → sin sesión → 401; `readerSessionId`
  no-UUID → 400; `percentFinished` sin `lastXPointer` (o viceversa) → 400;
  `fileName` que no matchea ningún libro → 404; anotación inválida
  (campos requeridos faltantes) → 400. **Guardado real contra S3**: primer
  PUT (sin sidecar previo en S3) generó un sidecar mínimo, lo subió a
  `library/test-book-3f.sdr/metadata.epub.lua` en el bucket real de
  SeaweedFS, y creó una fila en el historial de progreso (25%). Segundo
  PUT con el mismo `readerSessionId` **leyó el sidecar real de vuelta de
  S3**, fusionó un highlight nuevo preservando la estructura Lua
  existente, subió el resultado mergeado, y el historial se **actualizó
  in-place** (upsert por `readerSessionId`, no una fila nueva) de 25% a
  60% — confirma tanto el merge de contenido Lua real como el
  comportamiento de upsert vs. append de `BookProgressHistoryRepository`.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que 3f,
sigue sin existir superficie de biblioteca real hasta la Fase 4.

---

## Fase 3h — Detalle de lo hecho (COMPLETA)

**Scoping confirmado antes de escribir código: alcance chico, sin
bifurcaciones como la de 3g.** Los 5 candidatos (`ListLibraryTrash`,
`MoveLibraryBookToTrash`, `RestoreLibraryBook`, `DeleteTrashedLibraryBook`,
`PurgeExpiredTrashUseCase`) suman 213 líneas en el original, todos sobre
`BookRepositoryPort` sin clientes externos. La única pieza con una
decisión real fue `PurgeExpiredTrashUseCase`: no tiene ruta HTTP en el
original — se dispara desde `hooks.server.ts` en cada request si ya pasó
el intervalo de purga (`triggerTrashPurgeIfDue`). Es el mismo hueco de
arquitectura ya documentado en 3a/3c ("cómo arrancan los jobs de fondo en
el self-hosted de Next.js", sin resolver todavía). Se portó igual (es
chica y comparte dependencias con `DeleteTrashedLibraryBook`), pero se
dejó **wireada en `composition.ts` sin ruta ni cron**, lista para
invocarse cuando se resuelva esa decisión.

### `ManagedBookCoverService.deleteForBookStorageKey`: función suelta, no la clase
`DeleteTrashedLibraryBookUseCase`/`PurgeExpiredTrashUseCase` necesitan
borrar las portadas gestionadas de un libro al eliminarlo permanentemente.
El método real (`deleteForBookStorageKey`, en el `ManagedBookCoverService`
de 801 líneas del original) solo usa `storage.list`/`storage.delete` +
`buildManagedBookCoverPrefix` — nada del resto de la clase (fetch +
resolución de mirrors de Z-Library, eso es la mini-fase de portadas
upload/import). Se extrajo como función suelta
(`deleteManagedBookCoversForStorageKey(storage, bookStorageKey)`) en el
mismo archivo que ya tenía los 2 helpers puros de 3f
(`src/lib/server/application/services/managed-book-cover.ts`), en vez de
instanciar una clase que arrastraría dependencias que no se necesitan.

### Archivos creados
- 5 use-cases: `list-library-trash.ts`, `move-library-book-to-trash.ts`,
  `restore-library-book.ts`, `delete-trashed-library-book.ts`,
  `purge-expired-trash.ts` (sin ruta, ver arriba).
- `managed-book-cover.ts` ganó `buildManagedBookCoverPrefix` y
  `deleteManagedBookCoversForStorageKey`.
- `ports.ts` — `BookRepositoryPort` ganó `getByIdIncludingTrashed`,
  `hasOtherBookWithStorageKey`, `listStorageKeysWithExternalReferences`,
  `getTrashed`, `moveToTrash`, `restoreFromTrash`, `getExpiredTrash`,
  `delete`.
- `book-repository.ts` ganó esos 8 métodos (Drizzle directo, sin
  sorpresas — mismas queries que el original).
- 3 rutas: `/api/library/trash` (GET), `/api/library/[id]/restore`
  (POST), `/api/library/[id]/trash` (POST mover a papelera, DELETE borrar
  permanente) — las 3 con `requireSession()`.
- `composition.ts` — los 5 use-cases wireados (reutilizando
  `bookRepository`/`storage` ya existentes).

### Verificación
`bun run build` limpio (36 rutas API en total). Backend-only, mismo
patrón que 3f/3g: puerto 3000 verificado libre, `sake-seaweedfs`
reutilizado. Dos scripts desechables (`_seed-session-3h.ts` y
`_test-purge-3h.ts`, ambos borrados antes de terminar la sesión) — el
primero creó una sesión real y un libro de prueba nuevo (id 2, para no
tocar el libro de la Fase 3f reusado entre fases); el segundo insertó un
tercer libro ya con `trashExpiresAt` vencido y objetos reales en S3
(archivo principal + portada) para ejercer `PurgeExpiredTrashUseCase`
directamente (sin ruta). Contra el build de producción real (`bun run
start`) con `curl` y con los scripts:
- `GET /api/library/trash` sin sesión → 401; con sesión → lista vacía.
- `POST /api/library/:id/restore` sobre libro no trasheado → 400;
  id inexistente → 404; id inválido → 400.
- `DELETE /api/library/:id/trash` sobre libro no trasheado → 400.
- `POST /api/library/:id/trash` → mueve a papelera, `trashExpiresAt` a 30
  días; `GET /api/library/trash` lo refleja; `GET /api/library/list` deja
  de mostrarlo (confirma el filtro `isNull(deletedAt)`).
- `POST /api/library/:id/restore` → vuelve a aparecer en `list`,
  desaparece de `trash`.
- Ciclo completo: trashear de nuevo → `DELETE /api/library/:id/trash` →
  borrado permanente real; `GET /api/library/:id/detail` → 404;
  `POST .../restore` sobre el mismo id ahora → 404 (no 400, confirma que
  la fila ya no existe en absoluto, no solo que no está en papelera).
- `PurgeExpiredTrashUseCase.execute()` invocado directamente: antes de
  purgar, `storage.list` confirmó 1 objeto real subido para el archivo
  principal y 1 para la portada; después de purgar, ambos listados
  devuelven 0 (borrado real en SeaweedFS, no solo en DB) y el libro ya no
  existe ni con `getByIdIncludingTrashed`.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que
fases anteriores de library/books.

---

## Fase 3i — Detalle de lo hecho (COMPLETA)

**Scoping confirmado antes de escribir código, acotando deliberadamente el
`ManagedBookCoverService` completo (801 líneas originales) a solo lo que
necesitan `UploadLibraryBookCoverUseCase`/`ImportLibraryBookCoverUseCase`
(68+70 líneas).** El servicio original tiene 3 métodos públicos:
`storeFromBuffer` (upload desde el EPUB), `storeFromExternalUrl` (import
manual por URL) y `storeFromSearchImport` (importar la portada que trae un
candidato de metadata de búsqueda — Z-Library/mirrors/credenciales de
sesión). Los dos primeros no tocan nada de Z-Library; el tercero es la
única razón por la que el constructor original acepta
`mirrorSource`/`ZLibraryMirrorResolver` y por la que existen
`normalizeSourceUrl`/`buildFetchHeaders`/`resolveZLibraryMirrorUrls`. Se
confirmó leyendo el código que **ninguno de esos tres** lo usan los dos
use-cases de esta fase — pertenecen enteros a `ApplyMetadataCandidateUseCase`
(metadata providers, 3j+). Se portaron `storeFromBuffer`/
`storeFromExternalUrl` y todos sus helpers compartidos
(`uploadManagedCover`, `deleteOtherManagedCovers`, validación de magic
bytes, `readResponseBufferWithinLimit`, bloqueo de hostnames privados para
import manual) **tal cual**, sin recortar nada dentro de ellos — la única
simplificación fue de forma, no de lógica (ver abajo).

### Funciones sueltas en vez de clase (mismo patrón que `deleteForBookStorageKey` en 3h)
El archivo `managed-book-cover.ts` ya venía siendo funcional (no una
clase) desde 3f/3h. Se mantuvo esa forma: en vez de instanciar
`ManagedBookCoverService` con `storage`/`fetchImpl` como campos privados,
`storeManagedBookCoverFromBuffer(storage, input)` y
`storeManagedBookCoverFromExternalUrl(storage, input, fetchImpl?)` reciben
esas dependencias como parámetros. Mismo comportamiento exacto, sin
arrastrar el constructor con la lógica de resolución de mirrors que ya no
hace falta.

### `BookRepository.updateMetadata`: reescribe la fila completa, no un patch
A diferencia de `updateRating`/`updateState` (3g/3h, que solo tocan los
campos que cambian), `updateMetadata` en el original **reemplaza todos los
campos de metadata a la vez** (`UpdateBookMetadataInput`, 24 campos) —
así es como ya lo usaban `UploadLibraryBookCoverUseCase`/
`ImportLibraryBookCoverUseCase`: leen el libro completo, lo pasan por
`toUpdateMetadataInput(existing, newCoverUrl)` (solo cambia `cover`,
preserva el resto) y reescriben. Se portó tal cual — `UpdateBookMetadataInput`
se añadió a `book.ts` (se había dejado fuera a propósito en 3f, "no lo usa
nada todavía" — ya hace falta). `CreateBookInput` sigue sin portar, es de
la mini-fase de adquisición.

### Archivos creados
- `managed-book-cover.ts` ganó: `buildManagedBookCoverFileName`,
  `buildManagedBookCoverUrl`, `buildManagedBookCoverVersionToken`,
  `buildVersionedManagedBookCoverUrl`, `isManagedBookCoverUrl`,
  `MIN_MANAGED_BOOK_COVER_BYTES`/`MAX_MANAGED_BOOK_COVER_BYTES`, y las dos
  funciones de store (con todos sus helpers privados compartidos).
- `src/lib/server/application/use-cases/book-cover-metadata.ts` —
  `toUpdateMetadataInput`, puerto de `bookCoverMetadata.ts` (simplificado
  para tomar un `Book` ya resuelto en vez de `Book | undefined` — los
  use-cases ya hacen el check de "no encontrado" antes de llamarlo, así
  que el guard `if (!existing) throw` del original no hacía falta).
- `upload-library-book-cover.ts`, `import-library-book-cover.ts` — puertos
  1:1 de los use-cases, con `storage: StoragePort` inyectado directo en
  vez de un `Pick<ManagedBookCoverService, '...'>`.
- `book.ts` ganó `UpdateBookMetadataInput`.
- `book-repository.helpers.ts` ganó `toUpdateBookMetadataRow`.
- `book-repository.ts` ganó `updateMetadata`.
- `ports.ts` — `BookRepositoryPort` ganó `updateMetadata`.
- 2 rutas, ambas con `requireSession()`: `/api/library/[id]/cover/upload`
  (POST, multipart/form-data) y `/api/library/[id]/cover/import` (POST,
  JSON con `coverUrl` opcional — si se omite, usa `book.cover` existente
  como fuente).
- `composition.ts` — los 2 use-cases wireados (reutilizando
  `bookRepository`/`storage`).

### Verificación
`bun run build` limpio (38 rutas API en total). Backend-only, mismo
patrón que 3f-3h: puerto 3000 verificado libre, `sake-seaweedfs`
reutilizado. Script desechable (`_seed-session-3i.ts`, borrado al
terminar) creó una sesión y un libro de prueba nuevo (id 4, sin portada).
Gotcha de la propia verificación: `curl -F "file=@/tmp/..."` fallaba con
exit code 26 (`CURLE_READ_ERROR`) en Git Bash sobre Windows a pesar de que
el archivo existía — se resolvió usando una ruta absoluta de Windows bajo
el directorio de scratchpad en vez de `/tmp/`. Contra el build de
producción real (`bun run start`) con `curl`:
- `POST /api/library/:id/cover/upload` sin sesión → 401; content-type no
  imagen → 400; archivo vacío → 400; archivo real (PNG descargado de
  GitHub, 9,208 bytes) → 200 con una URL versionada
  (`/api/library/covers/test-book-3i.epub.png?v=<hash>`).
- `GET /api/library/:id/detail` refleja que la metadata se reescribió sin
  tocar el resto de campos (title/author intactos).
- `GET /api/library/covers/:fileName` sirvió los bytes reales de vuelta
  desde S3 — mismo tamaño y mismo contenido que el archivo subido.
- `POST /api/library/:id/cover/import` sin `coverUrl` y con el cover ya
  interno → 400 "Cover is already stored internally" (confirma
  `isManagedBookCoverUrl`); con `coverUrl` externo explícito (la misma
  imagen de GitHub) → 200, **mismo version token** que el upload anterior
  (confirma que el hash SHA-256 del contenido es el mecanismo de
  versionado, no un timestamp); con hostname bloqueado
  (`http://localhost/evil.png`) → 502 "Failed to import cover image"
  (confirma `isBlockedManualImportHostname`); body con `coverUrl` no
  string/null → 400; libro inexistente → 404.
- Verificado directamente contra S3 (`storage.list("covers/test-book-3i.epub.")`):
  **un solo objeto** permanece después de upload + import sobre el mismo
  libro (confirma `deleteOtherManagedCovers` limpiando versiones viejas en
  cada reemplazo, no solo acumulando). Limpieza final: se usó la papelera
  de la Fase 3h (`trash` + `DELETE`) para borrar el libro de prueba y
  confirmar que `DeleteTrashedLibraryBookUseCase` también limpió su
  portada real de S3 (`storage.list` devolvió `[]` después).

No se tocó `/library` ni se montó ninguna UI — mismo criterio que
fases anteriores de library/books.

---

## Fase 3j — Detalle de lo hecho (COMPLETA)

**Sesión de scoping dedicada para "metadata providers", tal como pidió el
usuario (mismo patrón que 3f).** El estimado de 3f (3,346 líneas) resultó
impreciso por una razón estructural, no por error de conteo: `composition/
providers.ts` del original mezcla dos subsistemas con nombres parecidos
pero funciones completamente distintas:

- **Metadata providers** (Google Books/OpenLibrary/ISBNdb/Hardcover-metadata):
  enriquecer campos de metadata de un libro **ya en tu biblioteca**
  (título, autor, portada, rating externo...). Esto es lo que de verdad
  pertenece a "3j+".
- **"Search providers"** (Anna's Archive/Gutenberg/OpenLibrary-search/
  Z-Library-search, **~1,502 líneas, descubrimiento de esta sesión**):
  *buscar libros nuevos para descargar*. No tiene nada que ver con
  metadata providers más que compartir el mismo archivo de composition en
  el original. Pertenece a la mini-fase de adquisición Z-Library real — no
  se tocó nada de esto en 3j.

Con esa separación hecha, el dominio real de metadata providers mide
**~2,728 líneas** (núcleo confirmado-wireado) **+ 341** de
`ApplyMetadataCandidateUseCase` (ver hallazgo abajo) **= ~3,069**, cerca del
estimado original pero por una composición distinta a la esperada.

**Troceo propuesto y confirmado con el usuario** (por dependencia): 3j
núcleo (este, proveedores + búsqueda de candidatos, ~2,019 líneas) → 3k
edición manual de metadata (~377 líneas, sin dependencia de providers) →
3l refetch automático (~332 líneas, depende de 3j) → 3m aplicar candidato
(~341 líneas, depende de 3j, ver hallazgo del huérfano abajo).

### Hallazgo: `ApplyMetadataCandidateUseCase` está huérfano en el original
341 líneas, sin ninguna ruta HTTP ni código de frontend que lo invoque en
todo `sake/` (confirmado con grep exhaustivo). Es una pieza completa
("aplicar los campos seleccionados de un candidato de búsqueda al libro")
pero nunca se conectó a nada en la app original. **Decisión tomada con el
usuario: se porta en 3m y se inventa una ruta HTTP razonable** (el original
no define una) — Fase 4 va a necesitar este flujo para la UI real de
"aplicar metadata encontrada". Dato a favor encontrado al leer el código:
usa `managedBookCoverService.storeFromExternalUrl` para la portada del
candidato — **no** `storeFromSearchImport` — así que la nota de 3i sobre
"quizá haya que volver a `managed-book-cover.ts`" **no aplica**: todo lo
que esta pieza necesita ya está portado desde 3i.

### 3j en sí: solo los 4 providers + agregador + búsqueda de candidatos
Alcance de esta sesión, confirmado leyendo cada archivo del original antes
de escribir código: `MetadataProviderPort`, los 4 providers (`GoogleBooks`/
`OpenLibrary`/`ISBNdb`/`Hardcover`-metadata), su infraestructura compartida
(`metadataProviderUtils`, `MetadataAggregatorService`,
`MetadataDescriptionSanitizer`), el cliente GraphQL de Hardcover
(`HardcoverClient` + `externalClientPolicy`, 171 líneas — genérico, sin
relación con `HardcoverProgressSyncService`, que sigue bloqueado), y
`SearchMetadataCandidatesUseCase` + sus 2 rutas de solo lectura. **Cero
cambios a `BookRepository`/`ports.ts`** — `getById` (3f) ya cubre todo lo
que necesita `SearchMetadataCandidatesUseCase`. **Cero dependencias npm
nuevas** — los 4 providers usan `fetch` nativo, a diferencia de 3c
(`jszip`)/3g (`luaparse`).

### Simplificación consciente: sin `hardcoverClient` compartido en composition
El original instancia `hardcoverClient`/`hardcoverApiToken` una sola vez en
`foundation.ts`, compartido entre el provider de metadata y
`HardcoverProgressSyncService` (bloqueado). En `sake-next` ese segundo
consumidor no existe todavía, así que no tiene sentido una instancia
compartida — `HardcoverMetadataProvider` cae a su propio fallback interno
(`new HardcoverClient(token)` por lookup, ya estaba en el original como
comportamiento por defecto cuando no se inyecta un cliente). Si se retoma
Hardcover progress sync más adelante, ahí sí tiene sentido promover esto a
un singleton compartido en `composition.ts`.

### Activación opt-in, igual que el original
`ACTIVATED_METADATA_PROVIDERS` (lista separada por comas: `googlebooks`,
`openlibrary`, `hardcover`, `isbndb`) controla qué providers se
instancian — vacío/no-seteado = lookup completamente deshabilitado (ambas
rutas devuelven 404 "Metadata lookup is not enabled"), igual que el
original. Google Books y OpenLibrary no necesitan API key (Google Books
tiene mejor rate-limit con una); ISBNdb/Hardcover sí. `sake-next/.env`
local quedó con `ACTIVATED_METADATA_PROVIDERS=googlebooks,openlibrary` para
poder verificar el agregador real sin necesitar keys de pago.

### Archivos creados
- `src/lib/types/metadata-provider.ts` — `METADATA_PROVIDER_IDS`/
  `MetadataProviderId`.
- `src/lib/utils/author.ts`, `publication-date.ts` — `normalizeAuthor(ForMatch)`/
  `validatePublicationDateParts`/`parsePublicationDateString`/
  `formatPublicationDate`, verbatim, puros.
- `src/lib/server/application/ports.ts` ganó `MetadataQuery`/
  `MetadataCandidate`/`MetadataCoverCandidate`/`MetadataProviderCapabilities`/
  `MetadataProviderPort` (en el original viven en un archivo propio,
  `MetadataProviderPort.ts` — en `sake-next` todos los ports viven en el
  barrel `ports.ts`, mismo patrón que el resto de fases).
- `src/lib/server/infrastructure/clients/external-client-policy.ts`,
  `hardcover-client.ts` — verbatim.
- `src/lib/server/infrastructure/metadata-providers/` (carpeta nueva):
  `metadata-provider-utils.ts`, `google-books-metadata-provider.ts`,
  `open-library-metadata-provider.ts`, `isbndb-metadata-provider.ts`,
  `hardcover-metadata-provider.ts`, `metadata-provider-factory.ts` —
  verbatim.
- `src/lib/server/config/activated-metadata-providers.ts` — verbatim
  (`process.env` en vez de `$env/dynamic/private`).
- `src/lib/server/application/services/metadata-aggregator-service.ts`,
  `metadata-description-sanitizer.ts` — verbatim.
- `src/lib/server/application/use-cases/search-metadata-candidates.ts` —
  verbatim.
- 2 rutas, ambas con `requireSession()` (no están en el allowlist público
  del original): `/api/metadata/providers` (GET, lista providers activados
  + capabilities), `/api/metadata/search` (POST, `bookId` o `query` libre).
- `composition.ts` — `activatedMetadataProviders`/
  `activatedMetadataAggregator`/`searchMetadataCandidatesUseCase` wireados.
- `.env.example`/`.env` — `ACTIVATED_METADATA_PROVIDERS`/
  `GOOGLE_BOOKS_API_KEY`/`ISBNDB_API_KEY`/`HARDCOVER_API_TOKEN` documentados.

### Verificación
`bun run build` limpio (40 rutas API en total). Backend-only, mismo patrón
que 3f-3i: puerto 3000 verificado libre, `sake-seaweedfs` reutilizado (no
se usó S3 en esta fase — metadata providers no tocan storage). Script
desechable (`_seed-session-3j.ts`, borrado al terminar) creó una sesión
real para el usuario `admin` existente. Contra el build de producción real
(`bun run start`) con `curl`:
- `GET /api/metadata/providers` sin sesión → 401; con sesión → lista real
  de 2 providers activados (`googlebooks`, `openlibrary`) con sus
  capabilities reales.
- `POST /api/metadata/search` sin sesión → 401; sin `bookId` ni `query` →
  400; `bookId` no-entero → 400; `bookId` inexistente (999) → 404;
  `query.limit` inválido → 400; JSON inválido → 400.
- **Búsqueda real contra APIs externas reales**: `{"query":{"title":"Dune","author":"Frank Herbert"}}`
  devolvió 3 candidatos reales de OpenLibrary (Dune, Dune Messiah, Children
  of Dune — con ISBNs/portadas/ratings reales de OpenLibrary), ordenados
  por el ranking del agregador. Google Books devolvió `429` (rate limit
  real de la API pública sin key) — confirmado que esto **no tumba la
  búsqueda**: queda reflejado en `providerErrors` mientras OpenLibrary sigue
  respondiendo normal (`Promise.allSettled`, resiliencia del agregador
  funcionando como se diseñó).
- `bookId: 1` (el libro de prueba de 3f, título "Fase 3f Test Book") →
  200 con `candidates: []` (esperado, ese título no matchea nada real) y
  el mismo `providerErrors` de Google Books.
- **Lookup deshabilitado**: servidor relanzado con
  `ACTIVATED_METADATA_PROVIDERS=` vacío → ambas rutas devuelven 404
  "Metadata lookup is not enabled", igual que el original. Confirmado y
  luego revertido a la configuración real para dejar el entorno como se
  encontró.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que fases
anteriores de library/books.

---

## Fase 3k — Detalle de lo hecho (COMPLETA)

**La más chica del dominio de metadata providers, tal como se estimó en
3j: sin providers externos en absoluto.** `UpdateLibraryBookMetadataUseCase`
es edición manual directa — el usuario escribe los campos en un
formulario y se guardan tal cual, sin tocar ningún proveedor. Confirmado
leyendo el código: reescribe la fila completa de metadata (como
`updateMetadata` desde 3i) y, si el cover deja de ser una URL gestionada
(`isManagedBookCoverUrl`, 3i) borra las portadas gestionadas viejas de S3
(`deleteManagedBookCoversForStorageKey`, 3h). **Cero piezas nuevas de
infraestructura** — todo lo que necesita ya estaba portado.

### Archivos creados
- `src/lib/server/http/library-metadata-update.ts` —
  `parseLibraryMetadataUpdateInput`/`LibraryMetadataUpdateInput`, puerto
  verbatim del parser/validador del body (allowlist de 20 campos,
  validación de tipos/rangos, chequeo de fecha de publicación si vienen
  year+month+day juntos).
- `src/lib/server/application/use-cases/update-library-book-metadata.ts` —
  `UpdateLibraryBookMetadataUseCase`, puerto 1:1 — toma `storage:
  StoragePort` inyectado directo (en vez de un
  `Pick<ManagedBookCoverService, 'deleteForBookStorageKey'>` como el
  original), mismo patrón que el resto de use-cases de 3f-3j en
  `sake-next`.
- 1 ruta con `requireSession()`: `/api/library/[id]/metadata` (PUT).
- `composition.ts` — `updateLibraryBookMetadataUseCase` wireado
  (reutilizando `bookRepository`/`storage`).

### Verificación
`bun run build` limpio (41 rutas API en total). Backend-only, mismo
patrón que fases anteriores: puerto 3000 verificado libre,
`sake-seaweedfs` reutilizado. Reutilizó la sesión real creada en 3j (sigue
vigente, expira a las 24h) y el libro de prueba de 3f (id 1). Contra el
build de producción real (`bun run start`) con `curl`:
- Sin sesión → 401; id inválido → 400; libro inexistente (999) → 404;
  campo desconocido en el body → 400 ("Unknown field: ..."); JSON
  inválido → 400; `title` vacío/solo espacios → 400; `month: 13` → 400
  ("month must be at most 12").
- Update real (`publisher`/`series`/`seriesIndex`/`pages`/fecha completa)
  → 200, y `GET .../detail` lo refleja exacto, con `title`/`author`/
  `progressPercent`/`rating`/`shelfIds` (de 3f/3g) intactos — confirma que
  es un patch selectivo sobre los campos enviados, no una sobreescritura
  ciega.
- **Limpieza real de portada en S3**: subió una portada real al libro
  (reusando el endpoint de 3i), confirmó el objeto real en el bucket
  (`storage.list`), hizo `PUT .../metadata` con `cover: null`, y
  `storage.list` volvió a dar `[]` — confirma que
  `deleteManagedBookCoversForStorageKey` se dispara de verdad desde esta
  ruta, no solo desde trash/upload. Libro de prueba revertido a su estado
  original (sin cover, sin los campos de prueba) al terminar.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que fases
anteriores de library/books.

---

## Fase 3l — Detalle de lo hecho (COMPLETA)

**Refetch automático — depende de 3j, tal como se estimó.** A diferencia
de 3k (edición manual, explícita), esta pieza enriquece un libro existente
buscando por `title`/`author` en los providers activados y **solo rellena
los campos que están vacíos** (`keepOrFillText`/`keepOrFillNumber`/
`keepOrFillPages`) — nunca sobreescribe un valor que el usuario ya tiene.
Dato importante confirmado leyendo el código: `title`/`author` se
mantienen **siempre** del libro existente (nunca se reemplazan con lo que
devuelva el provider) — son la clave de búsqueda, no un campo a enriquecer.

### `ExternalBookMetadataService`: un segundo consumidor del agregador de 3j
A diferencia de `SearchMetadataCandidatesUseCase` (3j, devuelve candidatos
crudos sin fusionar), este servicio toma el resultado del mismo
`MetadataAggregatorService` y colapsa los candidatos de los 3 providers
("mejor" Google Books/OpenLibrary/Hardcover) en un único objeto de
metadata fusionada (`pickFirst` por campo). En `composition.ts` se
instancia pasándole `activatedMetadataAggregator` (la misma instancia real
de 3j, con los providers activados de verdad) — el constructor del
original acepta un agregador opcional y cae a uno vacío si no se pasa
nada; eso solo aplica como fallback de test, no en producción.

### Archivos creados
- `src/lib/server/application/services/external-book-metadata-service.ts`
  — `ExternalBookMetadataService`, verbatim.
- `src/lib/server/application/use-cases/refetch-library-book-metadata.ts`
  — `RefetchLibraryBookMetadataUseCase`, verbatim (incluye
  `mergePublicationDate`, que solo usa mes/día del provider si el año
  coincide con el que ya tenía el libro — evita mezclar fecha parcial de
  fuentes distintas).
- 1 ruta con `requireSession()`: `/api/library/[id]/refetch-metadata`
  (POST).
- `composition.ts` — `externalBookMetadataService`/
  `refetchLibraryBookMetadataUseCase` wireados.

### Verificación
`bun run build` limpio (42 rutas API en total). Backend-only, mismo
patrón que fases anteriores. **Nota operativa real de esta sesión**: antes
de levantar el servidor, `netstat` mostró un `node.exe` ya escuchando en
el puerto 3000 que no era el que yo había arrancado (ni el de la sesión
anterior, que ya se había confirmado cerrado) — se mató sin indagar más
(dev-server viejo de alguna sesión previa) y se repitió la verificación
limpia. Sirve como recordatorio de que el chequeo de puerto libre antes de
arrancar sigue siendo necesario en cada sesión, no solo "la primera vez
que pasó".

Script desechable (`_seed-dune-3l.ts`, borrado al terminar) insertó un
libro real con `title: "Dune"`/`author: "Frank Herbert"` y el resto de
metadata vacía (id 5) — a diferencia de otras fases, aquí hacía falta un
libro con datos *reales* buscables, no un título de prueba sin sentido.
Contra el build de producción real (`bun run start`) con `curl` y sesión
real:
- Sin sesión → 401; id inválido → 400; libro inexistente (999) → 404.
- **Refetch real contra OpenLibrary**: con el libro vacío, devolvió
  `publisher: "Dom Wydawniczy REBIS Sp. z o.o."`, `identifier:
  "9780441013593"`, `pages: 608`, `openLibraryKey: "/works/OL893414W"`,
  `externalRating: 4.3049326`/`externalRatingCount: 446`, y una portada
  real de `covers.openlibrary.org` — **todos campos reales**, mismos
  valores que ya habían aparecido en la verificación de `/api/metadata/search`
  en 3j (mismo candidato real de OpenLibrary). `title`/`author` quedaron
  exactamente igual que antes del refetch.
- **Idempotencia confirmada**: un segundo refetch sobre el mismo libro ya
  enriquecido devolvió exactamente los mismos valores — `keepOrFillText`/
  `keepOrFillNumber` no sobreescriben campos que ya tienen datos, aunque
  la búsqueda externa se repita.
- Limpieza: libro de prueba trasheado + borrado permanente (reusando 3h),
  confirmado `404` en `detail` después.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que fases
anteriores de library/books.

---

## Fase 3m — Detalle de lo hecho (COMPLETA)

**Cierra el dominio completo de metadata providers (3j-3m).** Portado
`ApplyMetadataCandidateUseCase` tal cual (helpers `buildPatch`/
`normalizePublicationDatePatch`/`buildUpdateMetadataInput`/
`toAppliedMetadataBook`, los 17 `APPLY_METADATA_FIELD_SELECTIONS`) —
confirmado en 3j que usa `storeManagedBookCoverFromExternalUrl` (3i) para
la portada del candidato, no `storeFromSearchImport`, así que no hizo
falta tocar `managed-book-cover.ts`.

### La pieza nueva de esta fase: inventar el contrato HTTP
El original no define ninguna ruta para este use-case — es la única pieza
de todo library/books donde **no hay un `+server.ts` de referencia que
copiar**. Decisión de diseño tomada: `POST /api/library/[id]/metadata/apply`,
con `requireSession()` igual que el resto de rutas de library/books, body
`{ candidate, fieldSelections, coverChoice? }` — el cliente manda de
vuelta, tal cual, uno de los candidatos que ya recibió de
`POST /api/metadata/search` (3j). Como el use-case original nunca se
expuso por HTTP, tampoco existía un parser/validador de body para él
(a diferencia de `library-metadata-update.ts`, que sí existía en el
original para la ruta de 3k) — se escribió uno nuevo desde cero
(`apply-metadata-candidate-request.ts`) que valida la forma completa de
`MetadataCandidate` (identifiers/publishedDate/covers[]/rating anidados)
campo por campo, mismo nivel de rigor que los parsers portados de otras
fases.

### Archivos creados
- `src/lib/server/application/use-cases/apply-metadata-candidate.ts` —
  `ApplyMetadataCandidateUseCase`, puerto 1:1 — toma `storage: StoragePort`
  inyectado directo (mismo patrón que el resto de use-cases de `sake-next`,
  en vez de un `Pick<ManagedBookCoverService, 'storeFromExternalUrl'>`).
- `src/lib/server/http/apply-metadata-candidate-request.ts` —
  `parseApplyMetadataCandidateRequest`, validador nuevo (no existía en el
  original, ver arriba).
- 1 ruta nueva (inventada) con `requireSession()`:
  `/api/library/[id]/metadata/apply` (POST).
- `composition.ts` — `applyMetadataCandidateUseCase` wireado (reutilizando
  `bookRepository`/`storage`).

### Verificación
`bun run build` limpio (43 rutas API en total). Backend-only, mismo
patrón que fases anteriores: puerto 3000 verificado libre,
`sake-seaweedfs` reutilizado. Script desechable (`_seed-dune-3m.ts`,
borrado al terminar) insertó un libro real (`title: "Dune"`/`author:
"Frank Herbert"`, id 6, sin metadata) — mismo patrón que 3l, hacía falta
un libro buscable de verdad. Contra el build de producción real (`bun run
start`) con `curl` y sesión real:
- Sin sesión → 401; id inválido → 400; JSON inválido → 400; `candidate`
  faltante → 400; `fieldSelections` con un valor no válido → 400 (`"...is
  not a valid field selection"`); candidate válido pero libro inexistente
  (999) → 404; sin `fieldSelections` ni `coverChoice` → 400 ("At least one
  field selection or cover choice is required").
- **Flujo real completo, encadenando 3j→3m**: `POST /api/metadata/search`
  con `bookId: 6` devolvió el mismo candidato real de OpenLibrary visto en
  3j/3l (Dune, Dom Wydawniczy REBIS, isbn 9780441013593, pages 608, rating
  4.3/446, portada real). Se aplicó ese candidato en dos pasos — primero
  `fieldSelections: ["publisher","identifier","pages","externalRating","externalRatingCount"]`
  sin `coverChoice` → 200, `detail` reflejó los 5 campos reales sin tocar
  `title`/`author`; después un segundo POST solo con
  `coverChoice: candidate.covers[0]` → 200, `cover` pasó a ser una URL
  gestionada versionada (`/api/library/covers/test-book-3m-dune.epub.jpg?v=...`).
- **Portada real verificada en S3**: `GET` a esa URL devolvió 200,
  57,929 bytes, `Content-Type: image/jpeg` — la imagen real de OpenLibrary,
  no un placeholder.
- **Hostname bloqueado**: `coverChoice.url: "http://localhost/evil.jpg"`
  → 502 "Failed to import cover image" (reusa el bloqueo de hostnames
  privados de 3i, sin cambios).
- Limpieza: libro de prueba trasheado + borrado permanente (3h);
  `storage.list` confirmó que la portada real también se limpió de S3 al
  borrar, no solo la fila de la DB.

No se tocó `/library` ni se montó ninguna UI — mismo criterio que fases
anteriores de library/books.

---

## Scoping — adquisición Z-Library real (sesión dedicada previa a 3n)

**Confirma el patrón de "no asumas que cabe chico":** el estimado de 3j
(~1,502 líneas de "search providers") solo cubría una parte. Leyendo el
código real de `sake/` (composition/search.ts, composition/downloads.ts, y
todas las rutas `/api/search/*` y `/api/zlibrary/*`), el dominio completo de
adquisición mide **~5,100 líneas** y se trocea en 6 piezas por dependencia:

- **A. Login real** (~550 líneas: `ZLibraryClient` 410 + use-cases
  login/logout + config extendido) — sin dependencias nuevas, cierra el
  mock de 2d. **Esta es la pieza de 3n.**
- **B. Búsqueda multi-provider** (~1,700 líneas: `SearchProviderPort`/
  `SearchProviderRegistry`/factory + los 4 providers —
  `ZLibrarySearchProvider`, `AnnaArchiveSearchProvider` 595 líneas,
  `GutenbergSearchProvider` 221, `OpenLibrarySearchProvider` 414 — +
  `SearchBooksUseCase` + `LookupSearchBookMetadataUseCase`, este último
  reusa `ExternalBookMetadataService` ya portado en 3l) — depende de A
  (el provider de Z-Library necesita credenciales de sesión para buscar).
- **C. Descarga/importación directa, síncrona** (~1,350 líneas:
  `DownloadBookUseCase` 310 + `DownloadSearchBookUseCase` 55 +
  `EpubMetadataService` 707 líneas — rewrite de título en el EPUB
  descargado, nueva dependencia de infraestructura, usa `jszip` ya
  instalado desde 3c — + `LibraryImportCollisionService` + `StorageKeySanitizer`
  + `ManagedBookCoverService.storeFromSearchImport`, la pieza que 3i dejó
  fuera a propósito — reutiliza casi todos los helpers privados ya
  portados de `storeFromExternalUrl`, solo le falta la rama de resolución
  de mirrors + credenciales — + `BookRepository.create`/`CreateBookInput`,
  nuevo) — depende de A+B.
- **D. Cola de descargas en background** (~900 líneas: `DownloadQueue` 472 +
  `QueueJobRepository` 276 + `QueueDownloadUseCase`/`QueueSearchBookUseCase`/
  `GetQueueStatusUseCase`) — depende de A+B+C, y **choca con la decisión de
  arquitectura de jobs de fondo** todavía pendiente (mismo hueco de 3a/3c/3h:
  plugin sync, Hardcover, trash purge — ahora un cuarto consumidor esperando
  el mismo mecanismo).
- **E. `/api/library/[title]` GET/PUT/DELETE** (~290 líneas, sobre todo
  `PutLibraryFileUseCase` 235) — confirmado leyendo `libraryDetailController.svelte.ts`:
  es el mecanismo por el que el navegador sube el archivo cuando el
  provider (Anna's Archive/Gutenberg/OpenLibrary, no Z-Library) no tiene
  API key de servidor — depende de C.
- **F. Device-download tracking** (`GetNewBooksForDeviceUseCase`,
  `ConfirmDownloadUseCase`, `RemoveDeviceDownloadUseCase`,
  `ResetDownloadStatusUseCase`, `ExportDeviceLibraryBookUseCase` 249 líneas)
  — pertenece más a la futura mini-fase de sync de dispositivos KOReader
  (mismo bloqueador de auth dual identificado en 3g) que a adquisición en
  sí; se deja fuera del troceo A-E.

**Troceo confirmado con el usuario:** A (3n, este) → B → C → E, dejando D
para cuando se resuelva la arquitectura de jobs de fondo, y F para la
mini-fase de device-sync.

---

## Fase 3n — Detalle de lo hecho (COMPLETA)

**Pieza A del troceo de adquisición Z-Library (ver sección de scoping
arriba): login real**, reemplaza el submit mock de `ZLibraryAuthModal` de
la Fase 2d. A diferencia de los shelves (2c), acá sí hay una sesión externa
real que autenticar — mismo principio que ya se aplicó en 2d.

### Por qué se portó `ZLibraryClient` completo (410 líneas) aunque 3n solo usa login
La clase implementa `ZLibraryPort` (`signup`/`passwordLogin`/`tokenLogin`/
`search`/`download`) compartiendo helpers privados (`tryMirrors`/
`requestApi`/`getHeaders`/`getCookies`) entre los 5 métodos — partirla para
portar solo login habría significado duplicar esos helpers ahora y de nuevo
en la pieza B (búsqueda) y C (descarga). Se portó verbatim completa; los
métodos `search`/`download` quedan sin use-case ni ruta que los invoque
hasta B/C, mismo patrón que `BookRepositoryPort` en 3f (se extiende según
se necesita, no se recorta la clase origen).

### Cookies de Z-Library: cambio deliberado respecto al original
El original fija `Secure` a mano en el `Set-Cookie` crudo de las rutas de
login/logout (inconsistente con `clearZlibraryCookies`, que sí usa
`isSecureRequest()` vía la API `Cookies` de SvelteKit — un quirk del
original, no una decisión documentada). `sake-next` ya tenía
`isSecureRequest(request)` como el mecanismo establecido para la cookie de
sesión de Sake (self-hosting detrás de reverse proxy). Se usó el mismo
mecanismo para `userId`/`userKey` vía `setZLibraryCookies`/
`clearZLibraryCookies` nuevas en `auth/cookies.ts` (mismos nombres de
cookie, mismo TTL de 1 año, mismos flags `httpOnly`/`sameSite=lax`) — más
correcto detrás de un reverse proxy, consistente con el resto de la app, no
un cambio de comportamiento visible. De paso se añadió
`getZLibraryCredentials()` (lee ambas cookies, `null` si falta alguna) en
el mismo archivo — no se usa todavía (eso es B/C), pero es el contraparte
natural de `set`/`clear` y vive mejor ahí que repartido después.

### Parser de body recortado a lo que 3n usa
`zlibraryRequests.ts` original (92 líneas) mezcla los parsers de
login (`parseZTokenLoginRequest`/`parseZPasswordLoginRequest`) con el de
búsqueda (`parseZSearchRequest`, que arrastra `parseStringArray`/`parseYear`
y las constantes de límites de query). Se portó solo lo que usa 3n
(`zlibrary-auth-request.ts`, los 2 parsers de login + `isRecord`/
`parseRequiredString`) — mismo patrón de recorte de toda la migración.
`parseZSearchRequest` se porta en B cuando haga falta.

### "Conectado" es estado 100% cliente, sin cambios
Confirmado leyendo `zlibAuthService.ts` original: no existe un endpoint de
"status" de Z-Library — el indicador "Connected"/nombre de usuario en
Integrations vive en `localStorage` (`zlibName`, mismo key que el
original), poblado por el front tras un login exitoso. No hace falta
ninguna ruta nueva para esto; se portó tal cual en el hook
`use-zlibrary-auth.ts` nuevo.

### Archivos creados
- `src/lib/types/zlibrary.ts` — `ZBook`/`ZSearchBookResponse`/
  `ZBookFileResponse`/`ZLibUser`/`ZLoginResponse`/`ZLoginRequest`/
  `ZTokenLoginRequest`, verbatim (consolidados en un archivo, a diferencia
  del original que los separa en `Requests/`/`Responses/`).
- `src/lib/server/config/zlibrary.ts` ganó `ZLIBRARY_MIRROR_FAILOVER_TIMEOUT_MS`/
  `ZLIBRARY_REQUEST_TIMEOUT_MS`/`MAX_ZLIBRARY_DOWNLOAD_REDIRECTS`/
  `resolveZLibraryBaseUrl`/`buildZLibraryUrl` (la parte de mirrors ya
  estaba desde 3d).
- `src/lib/server/infrastructure/clients/to-url-encode.ts`,
  `zlibrary-client.ts` — `toUrlEncoded`/`ZLibraryClient`, verbatim.
- `src/lib/server/application/ports.ts` ganó `ZLibraryCredentials`/
  `ZLibrarySearchRequest`/`ZLibrarySearchResult`/`ZLibraryPort`.
- `src/lib/server/application/use-cases/zlibrary-auth.ts` —
  `ZLibraryTokenLoginUseCase`/`ZLibraryPasswordLoginUseCase`/
  `ZLibraryLogoutUseCase`, los 3 en un archivo (mismo patrón que
  `zlibrary-mirror-settings.ts` de 3d).
- `src/lib/server/http/zlibrary-auth-request.ts` — parsers recortados (ver
  arriba).
- `src/lib/server/auth/cookies.ts` ganó `setZLibraryCookies`/
  `clearZLibraryCookies`/`getZLibraryCredentials` (ver arriba).
  `src/lib/server/auth/constants.ts` ganó los nombres/TTL de esas cookies.
- 3 rutas, todas con `requireSession()` (no están en el allowlist público
  del original): `/api/zlibrary/login` (POST, token), `/api/zlibrary/passwordLogin`
  (POST, email+password), `/api/zlibrary/logout` (GET).
- `composition.ts` — `zlibraryClient` (usa `zlibraryMirrorSettingsRepository.get()`
  de 3d como fuente de mirrors, igual que el original) + los 3 use-cases
  wireados.
- Frontend: `src/lib/client/zlibrary-auth-api.ts` + hook
  `src/components/sidebar/settings/use-zlibrary-auth.ts` (estado `zlibName`
  en `localStorage`, `loginWithPassword`/`loginWithToken`/`logout` reales) —
  elevado a `(app)/layout.tsx` (mismo nivel que `zlibModalOpen`) porque lo
  necesitan tanto `SettingsModal` (mostrar nombre conectado + logout) como
  `ZLibraryAuthModal` (submit de login), que son hermanos ahí.
  `zlibrary-auth-modal.tsx` ganó estado real de error/loading (antes no
  tenía, el submit era mock) y cierra el modal + toast de éxito en login
  exitoso. `settings-modal.tsx`/`integrations-pane.tsx` ya no usan
  `notImplemented()` para Z-Library.

### Gotcha de verificación: mirrors `.example` fantasma de la Fase 3d
Al probar login contra Z-Library real, la primera corrida falló con
`ExternalClientError`/`network` genérico — la tabla `zlibraryMirrorSettings`
todavía tenía los 3 mirrors `*.example` que 3d insertó para probar
persistencia (nunca se revirtieron a un valor real tras esa sesión). Se
corrigió con un `PUT /api/integrations/zlibrary/mirrors` real a
`["https://z-lib.gl"]` — no un side-channel, la misma ruta que un usuario
real usaría — y **se dejó así** (es el valor correcto para un self-host
real, no un artefacto de prueba) en vez de restaurar los `.example`. Quien
retome 3d-adjacent debe saber que los mirrors de prueba ya no están.

### Verificación
`bun run build` limpio (46 rutas API en total). Puerto 3000 verificado
libre antes de levantar, `sake-seaweedfs` reutilizado. Sesión real creada
con script desechable (`_seed-session-3n.ts`, borrado al terminar) contra
el usuario `admin` existente. Contra el build de producción real (`bun run
start`) con `curl` y sesión real:
- `POST /api/zlibrary/login`/`passwordLogin` sin sesión → 401; con sesión,
  body vacío/incompleto → 400 (`"userId is required"`/`"password is
  required"`); JSON inválido → 400.
- **Login real contra Z-Library** (tras arreglar los mirrors, ver gotcha
  arriba): credenciales inválidas (`userId: "0", userKey: "invalid"` /
  email+password inexistentes) → la API real de Z-Library responde 400, y
  ese 400 se propaga correctamente como error al cliente (confirmado
  también con un script desechable llamando a `zlibraryClient` directo,
  mismo `ExternalClientError` con status 400 real de `z-lib.gl`, no un
  fallo de red) — confirma `tryMirrors`/`requestApi`/mirror resolution
  funcionando end-to-end contra el servicio real. No se pudo probar el
  camino de éxito (no hay credenciales reales de Z-Library disponibles en
  esta sesión) — limitación conocida, igual que en 2d no se pudo fingir un
  "Conectado" real.
- `GET /api/zlibrary/logout` sin sesión → 401; con sesión → 200 y
  `Set-Cookie` reales limpiando `userId`/`userKey` (`Max-Age`/`Expires` en
  el pasado).

Backend-only, sin UI de biblioteca — pero a diferencia de 3f-3m, esta vez
**sí se tocó UI real ya existente** (`ZLibraryAuthModal`/`IntegrationsPane`
de 2b/2d), porque el login de Z-Library ya tenía una UI completa esperando
por datos reales desde la Fase 2d — no hubo que inventar ni diferir nada de
interfaz.

---

## Cómo continuar en una sesión nueva

Pega esto al iniciar:

> Retomamos la migración de Sake (SvelteKit → Next.js). Lee
> `sake-next/MIGRATION_HANDOFF.md` completo para el contexto — **la Fase 2
> está completa** (2a-2d), **la Fase 3a-3i** también (logger, auth local,
> Shelves, Account, Devices, Plugin, los mirrors de Z-Library, el App pane,
> el **núcleo** de library/books — listar/ver detalle/leer EPUB/portada/
> asignar a estantes —, **progreso/rating** — ratings, historial de
> progreso, rating, isRead/archived/excludeFromNewBooks, autosave del
> lector web —, **papelera** — listar/mover/restaurar/borrar permanente +
> purga de expirados —, **portadas upload/import** — subir una imagen
> propia desde el EPUB o importar desde una URL externa), y **el dominio
> completo de metadata providers (3j-3m) ya está cerrado**: núcleo (los 4
> proveedores + agregador/ranking + búsqueda de candidatos), edición
> manual de metadata, refetch automático, y aplicar candidato (esta última
> con una ruta HTTP nueva inventada — el use-case estaba huérfano en el
> original). **La pieza A de adquisición Z-Library real (3n — login real)
> también está cerrada** — reemplaza el submit mock de Z-Library de la
> Fase 2d. Con esto el Settings modal queda 100% real salvo Hardcover
> (bloqueado, ver abajo).
> Notas importantes ya resueltas (secciones "Fase 3a-3i — Detalle de lo
> hecho"): en Next 16 el archivo se llama `proxy.ts`, no `middleware.ts` —
> de momento NO hay `proxy.ts`, la auth se resuelve por-ruta vía
> `src/lib/server/auth/require-session.ts` (solo sesión por cookie — **no**
> soporta API key de dispositivo, ver nota de 3g abajo);
> `CreateDeviceApiKeyUseCase` sigue sin portar; hay un contenedor Docker
> `sake-seaweedfs` (S3 local) que ya estaba corriendo de trabajo previo del
> usuario (instrucciones para levantarlo en la sección de la Fase 3c); y
> **Hardcover sigue bloqueado** — su servicio de sync real necesita más que
> progreso/rating/papelera/portadas de `BookRepository` (el resto del
> dominio library/books todavía no existe). Nota operativa (ya pasó varias
> veces): si vas a levantar el servidor para verificar, revisa primero que
> no haya un `bun run dev`/`bun run start` viejo colgado en el puerto 3000
> de una sesión anterior (`netstat -ano | grep ':3000'` en Git Bash) — si
> `bun run start` falla con `EADDRINUSE` en background no siempre es obvio,
> y terminarás verificando contra código viejo sin darte cuenta. Otra nota
> operativa nueva de 3i: si necesitas subir un archivo local con `curl -F`
> para probar un endpoint multipart, usa una ruta absoluta de Windows bajo
> el directorio de scratchpad — `curl -F "file=@/tmp/..."` falla con
> `CURLE_READ_ERROR` (exit 26) en Git Bash sobre Windows aunque el archivo
> exista.
>
> **La Fase 3f fue una sesión de scoping dedicada para library/books**
> (dominio completo: ~8,600 líneas si se tomara junto — se trozó en
> mini-fases por dependencia). Lee la sección "Fase 3f — Detalle de lo
> hecho" para el troceo completo. El orden original propuesto era 3f núcleo
> (hecho) → 3g progreso/rating (hecho) → 3h papelera (hecho) → 3i portadas
> upload/import (hecho) → 3j+ metadata providers (otra sub-fase de scoping,
> en curso, ver abajo) → adquisición Z-Library real (ligada al login real
> ya diferido a Fase 4).
>
> **La Fase 3g dejó algo fuera a propósito — importante para lo que sigue:**
> al leer el código real, `PutProgress`/`GetProgress` (el sync de progreso
> de los dispositivos KOReader físicos, no el autosave del lector web) usan
> auth dual — sesión O API key de dispositivo — que `requireSession()` no
> soporta (rechaza cualquier actor que no sea `session`). Como
> `CreateDeviceApiKeyUseCase` (emisión de esas API keys, el pairing del
> plugin) tampoco está portado, se decidió con el usuario diferir esas dos
> rutas a una mini-fase futura de "sync de dispositivos KOReader" que
> probablemente combine ambas cosas (hay que diseñar un helper de auth
> nuevo, tipo `requireActor()`, que acepte sesión o API key). El resto de
> 3g (ratings, historial, rating, estado, autosave del lector web) sí se
> portó completo — incluyendo, sin que lo pidiera el scoping original, **una
> librería Lua entera** (`src/lib/koreader/`, 620 líneas: parser/
> serializador de tablas Lua + el formato de sidecar `.sdr` de KOReader)
> porque el autosave del lector web la necesita para fusionar progreso con
> anotaciones existentes. Lee la sección "Fase 3g — Detalle de lo hecho"
> antes de tocar nada relacionado — esa librería Lua también la va a
> necesitar la futura mini-fase de sync de dispositivos.
>
> **La Fase 3h fue chica y sin bifurcaciones**, salvo una pieza:
> `PurgeExpiredTrashUseCase` no tiene ruta HTTP en el original — se dispara
> desde `hooks.server.ts` por intervalo en cada request, el mismo hueco de
> "cómo arrancan jobs de fondo en self-hosted Next.js" sin resolver desde
> 3a/3c (sync del plugin/Hardcover). Se portó y quedó **wireado en
> `composition.ts` sin ruta ni cron** — si retomas esa decisión de
> arquitectura de jobs de fondo, ya hay 3 use-cases esperando ese mecanismo
> (plugin sync, Hardcover, trash purge). Lee la sección "Fase 3h — Detalle
> de lo hecho" para el resto.
>
> **La Fase 3i recortó el `ManagedBookCoverService` original (801 líneas) a
> solo lo que necesita upload/import** (`storeFromBuffer`/
> `storeFromExternalUrl`, portados tal cual como funciones sueltas) —
> **excluyó por completo** `storeFromSearchImport` y toda la lógica de
> resolución de mirrors de Z-Library/credenciales de sesión que solo ese
> método usa. Nota ya resuelta en 3j: `ApplyMetadataCandidateUseCase`
> (confirmado leyendo el código) usa `storeFromExternalUrl` para la
> portada del candidato, **no** `storeFromSearchImport` — así que
> `managed-book-cover.ts` **no necesita ningún cambio** cuando se porte esa
> pieza en 3m. Lee la sección "Fase 3i — Detalle de lo hecho" para el resto
> (incluye el gotcha de `curl -F` en Windows, documentado arriba).
>
> **La Fase 3j fue una sesión de scoping dedicada para "metadata
> providers"** y encontró que el dominio real es distinto de lo que
> sugería el nombre: el original mezcla en el mismo archivo de composition
> los metadata providers (enriquecer libros ya en tu biblioteca — esto sí
> es 3j+) con un subsistema aparte de **"search providers"** (Anna's
> Archive/Gutenberg/OpenLibrary-search/Z-Library-search, ~1,502 líneas,
> para *buscar libros nuevos para descargar* — esto es parte de la
> adquisición Z-Library real, no de metadata providers). Lee la sección
> "Fase 3j — Detalle de lo hecho" para el troceo completo (sigue siendo
> relevante: ahí está el hallazgo de "search providers", que NO es
> metadata providers). Las 4 sub-fases están todas hechas: 3j núcleo → 3k
> edición manual → 3l refetch automático (rellena solo campos vacíos,
> `title`/`author` nunca se sobreescriben) → 3m aplicar candidato (ver
> sección "Fase 3m" — la única pieza de todo library/books sin un
> `+server.ts` de referencia en el original; se inventó
> `POST /api/library/[id]/metadata/apply` y su validador de body desde
> cero).
>
> **Adquisición Z-Library real tuvo su propia sesión de scoping dedicada
> (ver sección "Scoping — adquisición Z-Library real")**: el dominio mide
> ~5,100 líneas (no ~1,500 como sugería 3j) y se trozó en 6 piezas por
> dependencia — A. login real (hecho en 3n) → B. búsqueda multi-provider
> (~1,700 líneas: los 4 search providers + registry/factory +
> `SearchBooksUseCase`, depende de A) → C. descarga/importación directa
> síncrona (~1,350 líneas: `DownloadBookUseCase`/`DownloadSearchBookUseCase`
> + `EpubMetadataService` 707 líneas + `storeFromSearchImport` que 3i dejó
> fuera + `BookRepository.create` nuevo, depende de A+B) → E.
> `/api/library/[title]` GET/PUT/DELETE (~290 líneas, depende de C). Quedan
> fuera del troceo A-E: **D. cola de descargas en background** (~900
> líneas, choca con la decisión de arquitectura de jobs de fondo todavía
> pendiente de 3a/3c/3h) y **F. device-download tracking** (pertenece más a
> la futura mini-fase de sync de dispositivos KOReader). Para lo que sigas
> ahora: **B (búsqueda multi-provider)** es el siguiente paso natural del
> troceo A→B→C→E, o la mini-fase de sync de dispositivos KOReader / la
> decisión de jobs de fondo si prefieres cerrar esos huecos antes. **No
> asumas que cabe igual de chico que se ve** — igual que siempre, lee el
> código real primero y confirma el tamaño antes de comprometerte (en este
> dominio en particular ya se subestimó una vez en 3j). También sigue
> vigente la decisión de metodología: sin UI de biblioteca real todavía
> (`/library` es el placeholder de Fase 4), verificar cada mini-fase de
> library/books por build + curl + inspección directa de DB/S3 (scripts
> desechables para sembrar datos, borrados antes de terminar la sesión), no
> por Playwright-contra-UI — eso vuelve cuando la Fase 4 construya la
> página real. La única excepción ya ocurrida es 3n: como el login de
> Z-Library ya tenía UI real esperando desde la Fase 2d, esa sesión sí tocó
> componentes de UI existentes (no una página nueva de Fase 4). Plantea el
> alcance de lo que sea que sigue antes de escribir nada, mismo patrón que
> siempre.
