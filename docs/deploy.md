# Infraestructura y Deploy — Worklist

## Arquitectura en producción

```
Internet
   │
   ▼
Nginx (host, puerto 443/80)
   │
   ├── /uploads/*  ──►  /opt/worklist/uploads/  (archivos estáticos, sin pasar por Node)
   │
   └── /*  ──────────►  Docker container :3001
                              │
                              ├── Next.js + Socket.io (server.ts)
                              └── PostgreSQL container (red interna Docker)
```

El VPS corre **Nginx directamente en el host**. Docker gestiona la app y la base de datos. Nginx actúa como reverse proxy y además sirve los uploads directamente del disco, sin que pasen por Node.js.

---

## Estructura en el VPS

```
/opt/worklist/
├── app/                  ← código fuente (git clone de GitHub)
│   ├── Dockerfile
│   ├── ...
├── docker-compose.yml
├── .env                  ← variables de entorno de producción (no en git)
├── deploy.sh             ← script de deploy
└── uploads/              ← archivos subidos por usuarios (bind mount)
```

---

## Docker

### Dockerfile (multi-stage)

El build usa 4 etapas para minimizar el tamaño de la imagen final:

```
base → deps → builder → runner
```

| Etapa | Qué hace |
|-------|----------|
| `base` | Node 22 Alpine, instala `libc6-compat` (necesario para binarios nativos) |
| `deps` | Copia `package.json` + `package-lock.json` y ejecuta `npm ci`. Cacheada mientras no cambien las dependencias |
| `builder` | Copia el código, genera el cliente Prisma y compila Next.js (`npm run build`) |
| `runner` | Imagen mínima de producción. Solo copia los artefactos necesarios del builder, no el código fuente ni `node_modules` de desarrollo |

**Por qué multi-stage:** la imagen final no incluye el código fuente ni las dependencias de desarrollo. Si el builder falla a mitad, no se produce imagen rota.

#### Puntos clave del runner

```dockerfile
# Usuario sin privilegios — el proceso Node no corre como root
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# Crea el directorio de uploads en la imagen con el ownership correcto.
# En runtime Docker monta el bind mount sobre este path.
RUN mkdir -p public/uploads && chown nextjs:nodejs public/uploads

# prisma.config.ts es necesario para que `prisma migrate deploy` encuentre DATABASE_URL
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Al arrancar: primero aplica migraciones pendientes, luego levanta el servidor
ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node_modules/.bin/tsx server.ts"]
```

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: worklist
      POSTGRES_PASSWORD: <password>
      POSTGRES_DB: worklist
    volumes:
      - postgres_data:/var/lib/postgresql/data   # volumen nombrado — datos persistentes
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U worklist"]
      interval: 5s
      retries: 10

  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    env_file: .env
    volumes:
      - /opt/worklist/uploads:/app/public/uploads  # bind mount — ver sección Volúmenes
    ports:
      - "127.0.0.1:3001:3000"   # solo accesible desde localhost, Nginx hace el proxy
    depends_on:
      postgres:
        condition: service_healthy  # espera a que Postgres esté listo antes de arrancar
```

---

## Volúmenes

### PostgreSQL — volumen nombrado Docker (`postgres_data`)

```
postgres_data  →  /var/lib/postgresql/data  (dentro del container)
```

Docker gestiona este volumen internamente en `/var/lib/docker/volumes/`. Los datos de la base de datos persisten entre reinicios y rebuilds del container. **No se usa bind mount** porque Postgres necesita permisos especiales que Docker gestiona automáticamente.

### Uploads — bind mount (`/opt/worklist/uploads`)

```
/opt/worklist/uploads  (host)  →  /app/public/uploads  (container)
```

Se usa **bind mount** en vez de volumen nombrado Docker por una razón crítica:

> **Next.js en producción escanea `public/` al arrancar y construye una lista interna de archivos estáticos. Archivos añadidos después del arranque no están en esa lista y devuelven 404.**

Con un volumen Docker nombrado, los archivos subidos por los usuarios solo estarían accesibles vía Next.js, que los ignora si se subieron después del arranque del servidor.

La solución es que **Nginx sirva `/uploads/` directamente** desde el bind mount en el host, sin pasar por Next.js. Nginx lee del disco en cada request, sin caché de arranque.

#### Permisos del bind mount

```
/opt/worklist/uploads/
  owner: UID 1001 (nextjs — usuario del container)
  mode:  755     (dueño escribe, todos leen y traversan)
```

- El container (corre como UID 1001) puede escribir nuevos archivos.
- Nginx (`www-data`) puede leer y traversar (permisos de "others": `r-x`).

> **Por qué no volumen Docker para uploads:** los directorios de volúmenes Docker viven en `/var/lib/docker/volumes/` que tiene permisos `0710` (solo root y el grupo docker pueden entrar). Nginx en el host no puede leerlos aunque los archivos individuales sean world-readable.

---

## Nginx

Configuración en `/etc/nginx/sites-available/worklist`:

```nginx
# Redirige HTTP → HTTPS
server {
    listen 80;
    server_name worklist.kore247.com;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name worklist.kore247.com;

    # SSL gestionado por Certbot (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/worklist.kore247.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/worklist.kore247.com/privkey.pem;

    client_max_body_size 25M;  # necesario para uploads de imágenes

    # Uploads: Nginx los sirve directamente del disco
    # Sin este bloque, Next.js devolvería 404 en archivos subidos post-arranque
    location /uploads/ {
        alias /opt/worklist/uploads/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Todo lo demás va al container de Next.js
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Headers necesarios para WebSocket (Socket.io)
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 86400;
    }

    # Socket.io en su propio bloque para WebSocket upgrade explícito
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade  $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host     $host;
        proxy_read_timeout 86400;
    }
}
```

**Por qué `alias` y no `root`:** con `alias`, Nginx mapea `/uploads/archivo.png` directamente a `/opt/worklist/uploads/archivo.png`. Con `root`, buscaría `/opt/worklist/uploads/uploads/archivo.png` (duplica el segmento).

---

## Variables de entorno (`.env`)

Archivo en `/opt/worklist/.env` — **nunca en git**.

```env
DATABASE_URL=postgresql://worklist:<password>@postgres:5432/worklist
NEXTAUTH_URL=https://worklist.kore247.com
NEXTAUTH_SECRET=<secret generado con openssl rand -base64 32>
AUTH_TRUST_HOST=true          # requerido cuando hay reverse proxy (Nginx)
AUTH_GOOGLE_ID=<client_id>
AUTH_GOOGLE_SECRET=<client_secret>
```

> `AUTH_TRUST_HOST=true` es necesario porque Next-Auth v5 verifica el header `Host`. Sin esto, devuelve `UntrustedHost` al recibir requests de Nginx.
>
> `postgres` en la `DATABASE_URL` es el nombre del servicio en `docker-compose.yml`, que Docker resuelve internamente.

---

## Script de deploy (`/opt/worklist/deploy.sh`)

```bash
#!/bin/bash
set -e  # aborta si cualquier comando falla
SUDO="echo 'Developer2012#$' | sudo -S"

# 1. Baja los últimos cambios de GitHub
cd /opt/worklist/app
git pull origin main

# 2. Reconstruye la imagen Docker con el nuevo código
cd /opt/worklist
echo 'Developer2012#$' | sudo -S docker compose build

# 3. Levanta los contenedores con la nueva imagen
# `up -d` es idempotente: recrea solo los containers cuya imagen cambió
echo 'Developer2012#$' | sudo -S docker compose up -d

# 4. Elimina imágenes antiguas sin uso (libera espacio en disco)
echo 'Developer2012#$' | sudo -S docker image prune -f

echo "=== Deploy completado ==="
echo 'Developer2012#$' | sudo -S docker compose logs app --tail 5
```

### Por qué `sudo -S` en vez de `sudo` directo

El script se ejecuta remotamente vía SSH sin TTY interactivo. El `sudo` normal requiere terminal para pedir la contraseña. Con `-S` lee la contraseña desde stdin, lo que permite pasarla con `echo 'password' | sudo -S`.

### Cuándo usar `--no-cache`

El `docker compose build` normal reutiliza capas cacheadas de Docker para acelerar el build. Esto es correcto en la mayoría de deploys. Sin embargo, en casos excepcionales la caché puede quedar obsoleta:

```bash
# Forzar rebuild completo (más lento, ~10-15 min):
echo 'Developer2012#$' | sudo -S docker compose build --no-cache
```

Casos en que es necesario:
- Cambios en `proxy.ts` (middleware de Next.js) que no se detectan con cache normal
- Cambios en dependencias del sistema (`apk add`)
- Cuando se sospecha que la imagen tiene código desactualizado

### Flujo completo de un deploy

```
1. Local:  git add . && git commit -m "..." && git push
2. VPS:    ssh kore247 "bash /opt/worklist/deploy.sh"
```

El script tarda entre 5 y 15 minutos dependiendo de si hay cambios en `node_modules`. La app sigue sirviendo tráfico durante el build; solo hay un breve corte al ejecutar `docker compose up -d` para recrear el container.

---

## Migraciones de base de datos

Las migraciones se aplican **automáticamente al arrancar el container** via `npx prisma migrate deploy` en el `ENTRYPOINT`. No hay paso manual.

Para crear una nueva migración en desarrollo:

```bash
npx prisma migrate dev --name nombre-descriptivo
```

Esto genera un archivo en `prisma/migrations/` que se commitea en git. Al hacer deploy, el `ENTRYPOINT` lo aplica.

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Imágenes subidas devuelven 404 | Nginx no configurado para `/uploads/` | Verificar `location /uploads/` en nginx config |
| Login con Google falla (`invalid_client`) | Env vars con nombres incorrectos | Usar `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (no `GOOGLE_CLIENT_ID`) |
| `UntrustedHost` en Auth.js | App detrás de reverse proxy | Añadir `AUTH_TRUST_HOST=true` al `.env` y `trustHost: true` en `lib/auth.ts` |
| `prisma migrate deploy` falla en Docker | `prisma.config.ts` no copiado al runner | Verificar `COPY --from=builder /app/prisma.config.ts` en Dockerfile |
| Deploy no refleja cambios de `proxy.ts` | Caché Docker no invalida middleware | Usar `docker compose build --no-cache` |
| `sudo: a terminal is required` en deploy | `sudo` sin TTY | Usar `echo 'password' \| sudo -S` en lugar de `sudo` directo |
