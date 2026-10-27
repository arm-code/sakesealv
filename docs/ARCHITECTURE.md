# Arquitectura de Sake

Mapa para quien llega al proyecto: qué piezas hay, qué hace cada una, cómo se comunican y cómo se levantan. Los diagramas son [Mermaid](https://mermaid.js.org/): GitHub y VS Code (con la extensión *Markdown Preview Mermaid Support*) los dibujan directamente.

Documentos relacionados: [README](../README.md) (instalación y variables), [DEVELOPMENT.md](DEVELOPMENT.md) (entorno local, base de datos, acceso), [CONTRIBUTING.md](../CONTRIBUTING.md) (convenciones).

## 1. Qué es Sake, en una frase

Una biblioteca de libros **self-hosted** (web + API) que sincroniza libros, progreso de lectura y anotaciones con lectores **KOReader** mediante un plugin Lua.

## 2. Vista general

```mermaid
flowchart LR
    subgraph Clientes
        WEB["Navegador<br/>UI React + lector EPUB"]
        KO["KOReader<br/>plugin sake.koplugin (Lua)"]
        OPDS["Apps OPDS / WebDAV<br/>(Basic auth)"]
    end

    subgraph APP["Sake — un solo proceso Next.js 16"]
        direction TB
        UI["src/app + src/components<br/>páginas y UI"]
        API["src/app/api<br/>Route Handlers HTTP"]
        PROXY["src/proxy.ts<br/>WebDAV PROPFIND"]
        CORE["src/lib/server<br/>use-cases · services · repositorios"]
        JOBS["Jobs de fondo<br/>instrumentation.ts"]
        QUEUE["Cola de descargas<br/>en memoria + persistida"]
    end

    subgraph Datos
        DB[("libSQL / SQLite<br/>usuarios, libros, progreso,<br/>cola, shelves")]
        S3[("Almacenamiento S3<br/>EPUBs, portadas,<br/>sidecars KOReader, plugin")]
    end

    subgraph Externos["Servicios externos (opcionales)"]
        SEARCH["Búsqueda: Anna's Archive,<br/>Open Library, Gutenberg, Z-Library"]
        META["Metadata: Google Books,<br/>Open Library, Hardcover, ISBNdb"]
        HC["Hardcover<br/>sync de progreso"]
    end

    WEB --> UI
    WEB --> API
    KO -->|"x-api-key"| API
    OPDS --> API
    OPDS --> PROXY
    UI --> API
    API --> CORE
    PROXY --> CORE
    JOBS --> CORE
    JOBS --> QUEUE
    CORE --> QUEUE
    CORE --> DB
    CORE --> S3
    CORE --> SEARCH
    CORE --> META
    CORE --> HC
```

Puntos clave:

- **Es un monolito.** Frontend, API y jobs de fondo corren en el mismo proceso Next.js. No hay un backend separado.
- **Dos almacenes con roles distintos:** la base de datos (libSQL) guarda lo relacional; S3 guarda los archivos (libros, portadas, sidecars de KOReader, el plugin).
- **Todo lo externo es opcional** y se activa por variables de entorno (`ACTIVATED_PROVIDERS`, `ACTIVATED_METADATA_PROVIDERS`).

## 3. Tecnologías y para qué sirve cada una

| Tecnología | Rol en Sake | Dónde mirar |
|---|---|---|
| **Next.js 16** (App Router) + **React 19** | UI y API en un solo proceso. Ojo: tiene cambios incompatibles con versiones anteriores (p. ej. `proxy.ts` en lugar de `middleware.ts`); ver [AGENTS.md](../AGENTS.md) | `src/app` |
| **TypeScript** | Todo el código web | — |
| **Bun** | Gestor de paquetes y runner de scripts (`bun install`, `bun run …`) | `package.json`, `bun.lock` |
| **Tailwind 4**, **shadcn/ui**, **base-ui** | Estilos y componentes | `src/components`, `components.json` |
| **libSQL** (SQLite compatible, o Turso) | Base de datos | `LIBSQL_URL` |
| **Drizzle ORM / drizzle-kit** | Esquema tipado y migraciones SQL | `src/lib/server/infrastructure/db/schema.ts`, `drizzle/` |
| **S3 compatible** (SeaweedFS, MinIO, R2, AWS) | Archivos. SeaweedFS es el que trae `docker-compose` | `S3_*`, `infrastructure/storage/s3-storage.ts` |
| **epub.js** | Lector EPUB en el navegador | `src/components/reader`, `src/lib/reader` |
| **Lua** (KOReader) | Plugin del e-reader; habla con la API por HTTP | `koreaderPlugins/` |
| **pino** | Logs (JSON en producción) | `infrastructure/logging` |
| **Docker** | Imagen `runtime` (app) e imagen `migrator` (migraciones) | `Dockerfile`, `docker-compose.yaml` |

## 4. Estructura del código

```
koreaderPlugins/
  sake.koplugin/         Plugin Lua para KOReader (sync de progreso, libros, logs)
  sakeUpdater.koplugin/  Actualizador del plugin
drizzle/                 Migraciones SQL generadas (se suben a git)
docs/                    Documentación y capturas
src/
  instrumentation.ts     Arranca los jobs de fondo al iniciar el servidor
  proxy.ts               Entrada de WebDAV (PROPFIND)
  app/
    (auth)/              Login / creación de la primera cuenta
    (app)/               Shell de la app: library, search, queue, stats, annotations, logs…
    (reader)/            Lector EPUB a pantalla completa
    api/                 API HTTP (ver §6)
  components/            UI organizada por feature
  lib/
    client/              Clientes tipados que la UI usa para llamar a /api
    reader/              Runtime del lector, paginación, RSVP, preferencias
    koreader/            Parser y serializador de sidecars (Lua) de KOReader
    server/              Backend, ver §5
```

## 5. Backend: capas (`src/lib/server`)

Sigue una arquitectura por capas con dependencias hacia adentro: las rutas llaman a casos de uso, los casos de uso dependen de **interfaces** (`ports.ts`), y la infraestructura implementa esas interfaces.

```mermaid
flowchart TB
    R["Route Handler<br/>src/app/api/**/route.ts<br/>valida input, resuelve auth, traduce a HTTP"]
    A["auth/<br/>requireSession · requireActor · requireBasicAuth"]
    H["http/<br/>helpers de request/response, SSE"]
    UC["application/use-cases/<br/>una acción de negocio por archivo"]
    SV["application/services/<br/>lógica compartida: metadata, progreso,<br/>anotaciones, plugin, sidecars"]
    P{{"application/ports.ts<br/>interfaces"}}
    D["domain/<br/>tipos y reglas puras"]
    I["infrastructure/<br/>repositories · storage · clients ·<br/>search-providers · metadata-providers · queue · db"]
    C["application/composition.ts<br/>Composition root: crea e inyecta todo"]

    R --> A
    R --> H
    R --> UC
    UC --> SV
    UC --> P
    SV --> P
    UC --> D
    I -.implementa.-> P
    C --> UC
    C --> I
```

| Carpeta | Qué contiene |
|---|---|
| `application/use-cases/` | Una operación por archivo (`download-book.ts`, `create-shelf.ts`, `get-progress.ts`…). Es lo primero que hay que leer para entender una feature. |
| `application/services/` | Lógica compartida entre casos de uso (agregador de metadata, persistencia de progreso, índice de anotaciones, sincronización del plugin). |
| `application/ports.ts` | Interfaces (`*RepositoryPort`, etc.) que desacoplan negocio de infraestructura. |
| `application/composition.ts` | **Composition root**: instancia repositorios, servicios y casos de uso y los exporta. Cuando agregues una feature, regístrala aquí. |
| `domain/` | Tipos y reglas sin dependencias externas. |
| `infrastructure/` | Implementaciones: repositorios Drizzle, cliente S3, proveedores de búsqueda y metadata, cola de descargas, logging. |
| `auth/` | Autenticación por ruta (ver §7). |
| `jobs/` | Jobs de fondo. |
| `opds/`, `dav/` | Catálogo OPDS y WebDAV. |

> Los comentarios "Fase 3x" en `composition.ts` son historial de la migración desde SvelteKit (ver [MIGRATION_HANDOFF.md](../MIGRATION_HANDOFF.md)); todas las fases ya están portadas.

## 6. API HTTP (`src/app/api`)

| Grupo | Para qué |
|---|---|
| `auth/` | Bootstrap de la primera cuenta, login/logout, API keys, device-key (emparejar KOReader), contraseña Basic |
| `library/` | Libros: listar, detalle, contenido, portada, metadata, rating, progreso, descargas, papelera/archivo, shelves |
| `search/`, `zlibrary/` | Búsqueda en proveedores y login de Z-Library |
| `metadata/` | Búsqueda de candidatos de metadata |
| `queue/` | Estado de la cola de descargas |
| `annotations/` | Hub de anotaciones: listar, editar, exportar, reindexar |
| `devices/` | Dispositivos KOReader, versiones y logs remotos (SSE) |
| `plugin/` | Releases del plugin KOReader |
| `integrations/` | Hardcover, mirrors de Z-Library |
| `opds/` | Catálogo OPDS |
| `stats/`, `app/` | Estadísticas de lectura, versión de la app |

## 7. Autenticación

Se resuelve **en cada ruta**, no en un middleware global:

| Función | Quién la usa | Credencial |
|---|---|---|
| `requireSession()` | UI web | Cookie de sesión |
| `requireActor()` | Rutas que también usa KOReader | Cookie **o** header `x-api-key` (clave del dispositivo) |
| `requireBasicAuth()` | OPDS y WebDAV | HTTP Basic (contraseña de la cuenta o contraseña Basic propia) |

No hay registro abierto: la **primera** cuenta se crea con `/api/auth/bootstrap` y luego se cierra (pensado para una instancia de un solo dueño). Detalles en [DEVELOPMENT.md](DEVELOPMENT.md#3-usuarios-y-acceso).

## 8. Flujos principales

### 8.1 Sincronizar un e-reader KOReader

```mermaid
sequenceDiagram
    participant K as KOReader (plugin Lua)
    participant A as Sake API
    participant D as libSQL
    participant S as S3

    K->>A: Pair: usuario + contraseña
    A-->>K: device API key (la contraseña se descarta)
    Note over K,A: A partir de aquí todo va con x-api-key

    K->>A: ¿Libros nuevos para este dispositivo?
    A->>D: consulta libros no entregados
    A-->>K: lista
    K->>A: Descarga libro
    A->>S: lee EPUB
    A-->>K: archivo
    K->>A: Confirmar descarga

    K->>A: PUT progreso (al suspender el dispositivo)
    A->>S: escribe sidecar KOReader
    A->>D: guarda progreso + historial
    A-->>K: ok
```

El lector web guarda el progreso en el **mismo formato** que KOReader, por eso ambos se pueden alternar sobre el mismo libro.

### 8.2 Buscar y descargar un libro

```mermaid
sequenceDiagram
    participant U as Usuario (UI)
    participant A as API /api/search
    participant P as Proveedor externo
    participant Q as Cola de descargas
    participant S as S3
    participant D as libSQL

    U->>A: Buscar "título"
    A->>P: consulta (Anna / OpenLib / Gutenberg / Z-Lib)
    P-->>A: resultados
    A-->>U: lista
    U->>A: Enviar a la biblioteca
    A->>Q: encola tarea
    Q->>D: persiste job (sobrevive reinicios)
    Q->>P: descarga el archivo
    Q->>S: guarda EPUB
    Q->>D: crea el libro + metadata
    U->>A: Consulta /queue (estado)
```

### 8.3 Jobs de fondo

Arrancan una vez desde `src/instrumentation.ts` → `jobs/background-jobs.ts`:

- **Purga de papelera** cada 6 h (`SAKE_SKIP_TRASH_PURGE` la desactiva).
- **Sincronización del plugin KOReader** al arrancar: sube `koreaderPlugins/sake.koplugin` a S3 para que los dispositivos puedan actualizarse (`SAKE_SKIP_STARTUP_PLUGIN_SYNC` la desactiva).
- **Recuperación de la cola de descargas** tras un reinicio.
- **Reconciliación de Hardcover** (solo si hay token) y del **índice de anotaciones** (`SAKE_SKIP_ANNOTATION_INDEX_SYNC` desactiva esta última).

## 9. Base de datos

Esquema en `src/lib/server/infrastructure/db/schema.ts`. Tablas principales:

```mermaid
erDiagram
    Users ||--o{ UserSessions : tiene
    Users ||--o{ UserApiKeys : tiene
    Users ||--o{ Devices : empareja
    Devices ||--o{ DeviceDownloads : "libros entregados (por deviceId)"
    Devices ||--o{ DeviceProgressDownloads : "progreso entregado (por deviceId)"
    Books ||--o{ DeviceDownloads : entregado
    Books ||--o{ DeviceProgressDownloads : entregado
    Books ||--o{ BookProgressHistory : registra
    Books ||--o{ BookAnnotations : contiene
    Books }o--o{ Shelves : "BookShelves"
```

> Es un resumen conceptual; para columnas y relaciones exactas, abre `schema.ts` o `bun run db:studio`. Los libros **no pertenecen a un usuario**. `QueueJobs` (cola de descargas), `PluginReleases` y los ajustes de Hardcover/Z-Library son tablas independientes. Los nombres de tabla empiezan con mayúscula.

## 10. Cómo se levanta

### Desarrollo (lo que necesita cada pieza)

```mermaid
flowchart LR
    ENV[".env<br/>LIBSQL_URL + S3_*"] --> DEV["bun run dev<br/>:3000"]
    MIG["bun run db:migrate"] --> DBF[(".data/dev.db")]
    DBF --> DEV
    SW["docker compose up -d<br/>seaweedfs seaweedfs-init<br/>:8333"] --> DEV
```

**Requisitos:** [Bun](https://bun.sh), Docker (solo para el S3 local de SeaweedFS) y Git. Node no es necesario para desarrollar; la imagen de producción usa Node 22.

```bash
bun install
cp .env.example .env                              # Windows: copy .env.example .env
docker compose up -d seaweedfs seaweedfs-init     # S3 local (solo para subir/descargar libros)
bun run db:migrate
bun run dev                                       # http://localhost:3000
```

Guía completa y problemas frecuentes: [DEVELOPMENT.md](DEVELOPMENT.md).

### Producción / self-host

```mermaid
flowchart LR
    M["sake-migrator<br/>aplica migraciones<br/>y termina"] --> APP["sake (Next standalone)<br/>:5173 → 3000"]
    SW["seaweedfs<br/>S3 :8333"] --> INIT["seaweedfs-init<br/>crea el bucket"]
    INIT --> APP
    APP --- V1[("./.data/selfhost/libsql")]
    SW --- V2[("./.data/selfhost/seaweedfs")]
```

```bash
docker compose up --build        # abre http://localhost:5173
```

`sake-migrator` y `seaweedfs-init` deben terminar bien antes de que arranque la app. Para un servidor Linux con dominio propio, ver [DEPLOY_LINUX_CLOUDFLARE.md](DEPLOY_LINUX_CLOUDFLARE.md).

## 11. Dónde tocar según lo que quieras hacer

| Quiero… | Empieza por |
|---|---|
| Agregar un endpoint | Un `route.ts` en `src/app/api/…` → un caso de uso en `application/use-cases/` → registrarlo en `composition.ts` |
| Cambiar la base de datos | Editar `schema.ts` → `bun run db:generate` → `bun run db:migrate` → subir `drizzle/` |
| Agregar un proveedor de búsqueda o metadata | `infrastructure/search-providers/` o `metadata-providers/` + su `*-factory.ts` + variable `ACTIVATED_*` |
| Cambiar el lector web | `src/components/reader`, `src/lib/reader` |
| Cambiar el plugin del e-reader | `koreaderPlugins/sake.koplugin` (arranca en `main.lua`; `api/` habla con el servidor, `engines/` y `controllers/` orquestan, `ui/` son los menús) |
| Una pantalla nueva | Página en `src/app/(app)/…`, componentes en `src/components/<feature>`, cliente en `src/lib/client` |

## 12. Gotchas

- Next.js 16 difiere de lo que probablemente conoces: lee `node_modules/next/dist/docs/` antes de tocar código a nivel framework.
- Los segmentos dinámicos hermanos deben llamarse igual (`[id]` junto a `[id]`, nunca `[title]`): compila pero falla en runtime.
- En `next dev`, crear una carpeta de ruta nueva con el servidor corriendo puede dejar todas las rutas en 404 hasta reiniciar.
- La primera carga de cada página en dev tarda (10–60 s); la del lector hasta 30–90 s.
- `no such table` = faltan migraciones (`bun run db:migrate`).
