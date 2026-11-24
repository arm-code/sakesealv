# Despliegue en Coolify

Sake se despliega como **un solo recurso "Docker Compose"** que levanta cuatro servicios
(`sake`, `sake-migrator`, `seaweedfs`, `seaweedfs-init`) con el archivo
[`docker-compose.coolify.yaml`](../docker-compose.coolify.yaml). Solo `sake` se publica.

> Se construye con Node + pnpm (no Bun), así que funciona igual en servidores nuevos y en
> CPUs viejos sin AVX2/SSE4.2. En un servidor muy justo de RAM, compilar Next puede tardar.

## 1. Crear el recurso
1. **Project → New Resource → Public Git Repository**: `https://github.com/arm-code/sakesealv`.
2. Rama `dev` (o `main` cuando la fusiones). **Build Pack: Docker Compose**.
3. *Base Directory* `/` y *Docker Compose Location* `/docker-compose.coolify.yaml`
   (no el `docker-compose.yaml`: ese es para correrlo en local).

## 2. Variables de entorno
Obligatorias (inventa valores largos y aleatorios; SeaweedFS las usa para crear el acceso S3):

| Variable | Valor |
|---|---|
| `S3_ACCESS_KEY_ID` | `openssl rand -hex 10` |
| `S3_SECRET_ACCESS_KEY` | `openssl rand -hex 20` |

Opcionales (tienen valor por defecto): `S3_BUCKET` (`sake`), `ACTIVATED_PROVIDERS`,
`ACTIVATED_METADATA_PROVIDERS`, `GOOGLE_BOOKS_API_KEY`, `ISBNDB_API_KEY`, `HARDCOVER_API_TOKEN`,
`ZLIBRARY_BASE_URL`, `METADATA_PROVIDER_TIMEOUT_MS`. Ver `.env.example`.

Guarda las dos claves S3 en tu gestor de contraseñas. Si las cambias después de haber subido
libros, SeaweedFS conserva las anteriores y hay que reiniciar con las mismas.

## 3. Dominio
En el servicio **`sake`**: `http://<tu-dominio>` (protocolo `http`: el HTTPS lo pone Cloudflare),
puerto **3000**. Después añade la ruta en el tunnel de Cloudflare hacia el proxy de Coolify.
Los otros tres servicios no llevan dominio.

## 4. Deploy
La primera vez construye la imagen (varios minutos), aplica las migraciones, crea el bucket y
arranca la app. `sake-migrator` y `seaweedfs-init` terminan con código 0: es lo esperado.

## 5. Datos y respaldos
Dos volúmenes con nombre guardan todo; **no los pierdas**:
- `libsql` → la base de datos (`/data/sake.db`).
- `seaweedfs` → los libros.

Respaldo (en el servidor; cambia el nombre del volumen por el real, `docker volume ls | grep libsql`):

```bash
docker run --rm -v <volumen_libsql>:/data -v "$PWD":/out alpine tar czf /out/sake-libsql.tgz -C /data .
docker run --rm -v <volumen_seaweedfs>:/data -v "$PWD":/out alpine tar czf /out/sake-seaweedfs.tgz -C /data .
```
