# Despliegue en servidor Linux (Debian) con Cloudflare Tunnel

Guía para publicar Sake en un servidor Debian propio, expuesto a internet mediante un Cloudflare Tunnel (ejemplo: `sakesealv.dejuarez.mx`).

## 1. Requisitos

- Servidor Debian con acceso SSH.
- Docker y Docker Compose plugin.
- Al menos ~2 GB de RAM (la compilación con `--build` lo necesita).
- Un Cloudflare Tunnel ya conectado (`cloudflared`) y un dominio gestionado en Cloudflare.

## 2. Instalar y levantar la app

```bash
# Instalar Docker (si no lo tienes)
curl -fsSL https://get.docker.com | sh

git clone <tu-repo> sakesealv && cd sakesealv

# Edita las credenciales (ver sección 3)
nano .env.docker.selfhosted

docker compose up -d --build
docker compose logs -f sake
```

Usa `-d` para que siga corriendo al cerrar la sesión SSH.

## 3. Consideraciones de seguridad (antes de exponerlo)

En `docker-compose.yaml` hay puertos publicados en todas las interfaces del servidor:

- **Puertos `8333` (S3) y `9333` (master de SeaweedFS):** no se necesitan fuera de Docker, la app usa la red interna (`seaweedfs:8333`). Elimínalos de `ports` o enlázalos a localhost:
  ```yaml
  ports:
    - "127.0.0.1:8333:8333"
  ```
- **Puerto de la app:** enlázalo solo a localhost para que únicamente el túnel llegue a él:
  ```yaml
  ports:
    - "127.0.0.1:5173:3000"
  ```
- **Credenciales S3:** cambia `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` en `.env.docker.selfhosted`. Los valores por defecto (`sakeadmin` / `sakeadminsecret`) son públicos.
- **Firewall:** no abras puertos entrantes en el router. El túnel solo hace conexiones salientes. Si usas `ufw`, permite solo SSH.

## 4. Configurar el Cloudflare Tunnel

### Opción A: Dashboard (Zero Trust)

1. Networks → Tunnels → tu túnel → **Public Hostname** → Add.
2. Subdominio: `sakesealv`, dominio: `dejuarez.mx`.
3. Tipo: `HTTP`, URL: `localhost:5173`.

### Opción B: Archivo de configuración

`/etc/cloudflared/config.yml`:

```yaml
ingress:
  - hostname: sakesealv.dejuarez.mx
    service: http://localhost:5173
  # ...tus otras entradas...
  - service: http_status:404
```

```bash
cloudflared tunnel route dns <nombre-tunel> sakesealv.dejuarez.mx
sudo systemctl restart cloudflared
```

### Si `cloudflared` corre dentro de Docker

No uses `localhost`. Coloca `cloudflared` y `sake` en la misma red de Docker y apunta a `http://sake:3000`.

## 5. Proteger el acceso

La app puede no incluir sistema de login (revisa el README principal). Si es así, cualquiera con la URL podrá usarla. Se recomienda **Cloudflare Access**:

Zero Trust → Access → Applications → Add application → Self-hosted → dominio `sakesealv.dejuarez.mx` → política (por ejemplo, solo tu correo).

## 6. Mantenimiento

- **Datos:** se guardan en `./.data/selfhost/` (libSQL y SeaweedFS). Respáldalo periódicamente.
- **Actualizar:**
  ```bash
  git pull && docker compose up -d --build
  ```
- **Reiniciar tras reinicio del servidor:** añade `restart: unless-stopped` a los servicios `sake` y `seaweedfs` en el compose.
- **Logs:** `docker compose logs -f`.
- **Detener:** `docker compose down` (los datos persisten en `.data`).

## 7. Problemas comunes

| Síntoma | Causa probable |
|---|---|
| Error 502/1033 en el dominio | `cloudflared` caído o URL de servicio incorrecta |
| Falla la subida de libros | Credenciales S3 distintas entre servicios o bucket no creado (revisa `seaweedfs-init`) |
| Falla el pull de imágenes | Red/DNS/VPN; reintenta o configura DNS en Docker |
| Build se queda sin memoria | Añade swap o compila en otra máquina y usa una imagen prebuilt |
