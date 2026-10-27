# Guía de desarrollo local

Guía práctica para quien se incorpora al proyecto: cómo levantar el entorno, ver la base de datos y recuperar el acceso si olvidas el usuario o la contraseña.

Para la instalación general y las variables de entorno, ver el [README](../README.md). Para las convenciones de código y de PR, ver [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Levantar el entorno

```bash
bun install
cp .env.example .env      # en Windows: copy .env.example .env
bun run db:migrate        # primera vez y después de cada cambio de esquema
bun run dev               # http://localhost:3000
```

En `.env` lo mínimo para desarrollo es:

```env
LIBSQL_URL=file:./.data/dev.db
LIBSQL_AUTH_TOKEN=
```

El almacenamiento S3 (SeaweedFS) solo hace falta para subir o descargar libros. Se levanta con:

```bash
docker compose up -d seaweedfs seaweedfs-init
```

## 2. La base de datos

Sake usa **libSQL (compatible con SQLite)**. En desarrollo es un archivo local:

```
.data/dev.db
```

`.data/` está en `.gitignore`: la base de datos de cada desarrollador es local y no se comparte.

### Ver y editar los datos

**Opción recomendada: Drizzle Studio** (ya incluido en el proyecto, no requiere instalar nada más):

```bash
bun run db:studio
```

Abre una interfaz web (normalmente `https://local.drizzle.studio`) con todas las tablas. Desde ahí puedes ver, editar y borrar filas, o ejecutar SQL.

**Otros clientes:** DBeaver, TablePlus, DB Browser for SQLite o la extensión SQLite de VS Code. Abre el archivo `.data/dev.db` como una base SQLite.

> Los nombres de tabla empiezan con mayúscula (`Users`, `UserSessions`, `Books`...). SQLite no distingue mayúsculas en nombres de tabla, pero conviene respetarlas.

### Esquema y migraciones

- El esquema está en `src/lib/server/infrastructure/db/schema.ts`.
- Después de cambiarlo: `bun run db:generate` crea la migración en `drizzle/` y `bun run db:migrate` la aplica.
- Sube a git los archivos generados en `drizzle/`.

## 3. Usuarios y acceso

### Cómo funciona el registro

No hay pantalla de "crear cuenta" abierta. Al iniciar la app por primera vez, con la tabla `Users` vacía, la pantalla de login permite crear la **cuenta inicial** (usuario de 3 a 64 caracteres y contraseña de al menos 8).

En cuanto existe un usuario, el registro se cierra: `/api/auth/bootstrap` responde `403 Registration is closed`. Es el comportamiento esperado, pensado para instancias self-hosted de un solo dueño.

Las contraseñas se guardan con hash `scrypt`, así que **no se pueden leer**, solo reemplazar.

### Ver qué usuarios existen

En Drizzle Studio abre la tabla `Users`, o ejecuta:

```sql
SELECT id, username, is_disabled, last_login_at, created_at FROM Users;
```

(No selecciones `password_hash`: no sirve para recuperar nada.)

### Olvidé el usuario o la contraseña (desarrollo)

La forma más simple es borrar el usuario para que el registro se reabra:

1. Abre Drizzle Studio (`bun run db:studio`) o cualquier cliente SQLite.
2. Borra la fila del usuario. Con SQL:
   ```sql
   DELETE FROM Users WHERE id = 1;
   ```
   También puedes borrar la fila desde la interfaz de la tabla `Users`.
3. Recarga la app en `http://localhost:3000`. Como ya no hay usuarios, el login te deja registrar uno nuevo.

**Qué se borra junto con el usuario** (`ON DELETE CASCADE`): sus sesiones (`UserSessions`) y sus API keys (`UserApiKeys`). Los **libros no se borran**: no pertenecen a un usuario. Si el borrado falla por una restricción de llave foránea, revisa las tablas que referencian `Users`.

**Reinicio total** (si prefieres empezar de cero): detén `bun run dev`, borra `.data/dev.db` y ejecuta `bun run db:migrate` de nuevo. Pierdes **todos** los datos locales.

> Esto aplica solo a tu base local. En producción o en un stack self-host con datos reales no borres usuarios sin respaldo previo.

## 4. Comandos útiles

```bash
bun run dev           # servidor de desarrollo
bun run lint          # eslint
bunx tsc --noEmit     # chequeo de tipos (debe terminar sin errores)
bun run build         # build de producción
bun run db:generate   # genera migración desde schema.ts
bun run db:migrate    # aplica migraciones
bun run db:studio     # explorador visual de la base de datos
```

## 5. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| No puedo iniciar sesión y no veo cómo registrarme | Ya existe un usuario. Ver "Olvidé el usuario o la contraseña". |
| `no such table` al arrancar o consultar | Falta aplicar migraciones: `bun run db:migrate`. |
| Subir o descargar libros falla | SeaweedFS no está corriendo: `docker compose up -d seaweedfs seaweedfs-init`. |
