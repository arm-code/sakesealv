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
   - ⬜ 3g+ — resto de library/books (sesión de scoping propia hizo el troceo, ver sección "Fase 3f"): progreso/rating, papelera, portadas (upload/import), metadata providers (otra sub-fase de scoping aparte), adquisición Z-Library real (search/download/login). Después de eso: OPDS, DAV, annotations, queue, stats, logs streaming, device pairing (CreateDeviceApiKeyUseCase)...
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

## Cómo continuar en una sesión nueva

Pega esto al iniciar:

> Retomamos la migración de Sake (SvelteKit → Next.js). Lee
> `sake-next/MIGRATION_HANDOFF.md` completo para el contexto — **la Fase 2
> está completa** (2a-2d) y **la Fase 3a-3f** también (logger, auth local,
> Shelves, Account, Devices, Plugin, los mirrors de Z-Library, el App pane,
> y ahora el **núcleo** de library/books — listar/ver detalle/leer EPUB/
> portada/asignar a estantes). Con el App pane, el Settings modal quedó
> 100% real salvo Hardcover (bloqueado, ver abajo) y el login real de
> Z-Library (mockeado a propósito, Fase 2d). Notas importantes ya resueltas
> (secciones "Fase 3a-3f — Detalle de lo hecho"): en Next 16 el archivo se
> llama `proxy.ts`, no `middleware.ts` — de momento NO hay `proxy.ts`, la
> auth se resuelve por-ruta vía `src/lib/server/auth/require-session.ts`;
> `CreateDeviceApiKeyUseCase` sigue sin portar; hay un contenedor Docker
> `sake-seaweedfs` (S3 local) que ya estaba corriendo de trabajo previo del
> usuario (instrucciones para levantarlo en la sección de la Fase 3c); y
> **Hardcover sigue bloqueado** — su servicio de sync real necesita más que
> solo `getAll`/`getById` de `BookRepository` (el resto del dominio
> library/books todavía no existe). Nota operativa (ya pasó dos veces): si
> vas a levantar el servidor para verificar, revisa primero que no haya un
> `bun run dev`/`bun run start` viejo colgado en el puerto 3000 de una
> sesión anterior (`netstat -ano | grep ':3000'` en Git Bash) — si `bun run
> start` falla con `EADDRINUSE` en background no siempre es obvio, y
> terminarás verificando contra código viejo sin darte cuenta.
>
> **La Fase 3f fue una sesión de scoping dedicada para library/books**
> (dominio completo: ~8,600 líneas si se tomara junto — se trozó en
> mini-fases por dependencia). Con el núcleo cerrado, lee la sección "Fase
> 3f — Detalle de lo hecho" para el troceo completo y por qué quedó así:
> el orden propuesto y confirmado con el usuario fue 3f núcleo (hecho) →
> **3g progreso/rating** (siguiente candidato natural, pequeño: PutProgress/
> GetProgress/PutWebReaderProgress/GetBookProgressHistory/UpdateBookRating/
> ListLibraryRatings/UpdateLibraryBookState) → 3h papelera → 3i portadas
> (upload/import) → 3j+ metadata providers (otra sub-fase de scoping, 3,346
> líneas aparte) → adquisición Z-Library real (ligada al login real ya
> diferido a Fase 4). **No asumas que 3g cabe igual de chico que se ve** —
> igual que siempre, lee el código real primero y confirma el tamaño antes
> de comprometerte. También sigue vigente la decisión de metodología: sin
> UI de biblioteca real todavía (`/library` es el placeholder de Fase 4),
> verificar cada mini-fase de library/books por build + curl + inspección
> directa de DB/S3 (scripts desechables para sembrar datos, borrados antes
> de commit), no por Playwright-contra-UI — eso vuelve cuando la Fase 4
> construya la página real. Plantea el alcance de lo que sea que sigue
> antes de escribir nada, mismo patrón que siempre.
