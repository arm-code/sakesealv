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

## Cómo continuar en una sesión nueva

Pega esto al iniciar:

> Retomamos la migración de Sake (SvelteKit → Next.js). Lee
> `sake-next/MIGRATION_HANDOFF.md` completo para el contexto — **la Fase 2
> está completa** (2a shell visual, 2b Settings modal, 2c shelf manager, 2d
> Z-Library auth modal), todas verificadas visualmente con Playwright y sin
> errores de consola. Vamos a arrancar la Fase 3 (rutas de API y utilidades
> de servidor). Antes de elegir qué migrar primero, dame un resumen de qué
> rutas/endpoints existen en `sake/src/routes/api/` (o donde estén) y su
> tamaño, para decidir el orden igual que se hizo con los mini-pasos de la
> Fase 2 — probablemente convenga empezar por lo que ya bloquea componentes
> ya migrados: `getLibsqlConfig`/infra (ya movido en Fase 1), el logger
> (pendiente, bloqueaba `logResolvedConfig` desde la Fase 1), y los
> endpoints de shelves/settings/zlibrary-auth que hoy están mockeados en
> `sake-next/src/components/sidebar/`. Antes de escribir código, plantea el
> alcance de esta primera mini-fase de Fase 3 como se ha hecho en todas las
> anteriores.
