# Manual de despliegue en VPS

Guía completa para llevar Worklist a producción en un VPS propio con Docker, Nginx y SSL.

---

## Requisitos del servidor

- **OS:** Ubuntu 22.04 LTS (o Debian 12)
- **RAM:** mínimo 2 GB (recomendado 4 GB)
- **Disco:** mínimo 20 GB
- **Dominio:** un registro A apuntando a la IP del VPS (ej. `worklist.tudominio.com`)
- **Puertos abiertos:** 22 (SSH), 80 (HTTP), 443 (HTTPS)

---

## 1. Preparar el servidor

### 1.1 Instalar Docker y Docker Compose

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y ca-certificates curl gnupg lsb-release

# Agregar repositorio Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permitir usar docker sin sudo (requiere cerrar sesión y volver)
sudo usermod -aG docker $USER
```

### 1.2 Instalar Nginx y Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 1.3 Clonar el repositorio

```bash
sudo mkdir -p /opt/worklist
sudo chown $USER:$USER /opt/worklist
cd /opt/worklist
git clone https://github.com/TU_USUARIO/worklist.git .
```

---

## 2. Variables de entorno

Crea el archivo `.env` en la raíz del proyecto. **Nunca lo subas a Git.**

```bash
cp .env.example .env   # si existe
# o crear desde cero:
nano /opt/worklist/.env
```

Contenido del `.env` de producción:

```env
# ─── Base de datos ────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://worklist:CONTRASEÑA_SEGURA@localhost:5432/worklist"

# ─── Auth.js ──────────────────────────────────────────────────────────────────
NEXTAUTH_URL="https://worklist.tudominio.com"
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"

# ─── Google OAuth (opcional) ──────────────────────────────────────────────────
# Crear en https://console.cloud.google.com → APIs → Credentials
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"

# ─── Email (para magic links / invitaciones) ──────────────────────────────────
# Ejemplo con Resend (https://resend.com) — plan gratuito: 3000 emails/mes
EMAIL_SERVER_HOST="smtp.resend.com"
EMAIL_SERVER_PORT="465"
EMAIL_SERVER_USER="resend"
EMAIL_SERVER_PASSWORD="re_xxxxxxxxxx"
EMAIL_FROM="Worklist <noreply@tudominio.com>"

# ─── Cloudflare R2 (almacenamiento de archivos adjuntos) ─────────────────────
# Ver sección 3 para cómo obtener estas credenciales
R2_ACCOUNT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_ACCESS_KEY_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
R2_BUCKET="worklist-uploads"
# URL pública del bucket (activar en R2 → Settings → Public access)
R2_PUBLIC_URL="https://pub-xxxxxxxx.r2.dev"

# ─── App ──────────────────────────────────────────────────────────────────────
NODE_ENV="production"
PORT="3000"
```

Generar `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## 3. Configurar Cloudflare R2

### 3.1 Crear el bucket

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. Click **Create bucket** → nombre: `worklist-uploads` → región: automática
3. En el bucket → **Settings** → **Public access** → Enable
4. Copiar la **Public bucket URL** (empieza con `https://pub-...r2.dev`) → `R2_PUBLIC_URL`

### 3.2 Crear credenciales de API

1. R2 → **Manage R2 API tokens** → **Create API token**
2. Permisos: `Object Read & Write` para el bucket específico
3. Copiar `Access Key ID` → `R2_ACCESS_KEY_ID`
4. Copiar `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
5. El `Account ID` está en la barra lateral derecha de R2

### 3.3 Configurar CORS en el bucket (solo si hay uploads directos desde browser)

En R2 → bucket → Settings → CORS:
```json
[
  {
    "AllowedOrigins": ["https://worklist.tudominio.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Docker Compose de producción

Crea `docker-compose.prod.yml` en `/opt/worklist/`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: worklist
      POSTGRES_PASSWORD: CONTRASEÑA_SEGURA   # misma que DATABASE_URL
      POSTGRES_DB: worklist
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"   # solo accesible desde localhost (Nginx hace proxy)
    depends_on:
      - postgres
    networks:
      - internal

networks:
  internal:

volumes:
  postgres_data:
```

---

## 5. Dockerfile

Crea `Dockerfile` en la raíz del proyecto:

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── Instalar dependencias ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Imagen final ───────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib

USER nextjs

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server.ts"]
```

---

## 6. Configurar Nginx

### 6.1 Crear el virtual host

```bash
sudo nano /etc/nginx/sites-available/worklist
```

Pegar la siguiente configuración:

```nginx
server {
    listen 80;
    server_name worklist.tudominio.com;

    # Certbot llenará esto automáticamente
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name worklist.tudominio.com;

    # SSL — Certbot completa estos valores
    ssl_certificate /etc/letsencrypt/live/worklist.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/worklist.tudominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Tamaño máximo de subida (debe coincidir con el límite de la API)
    client_max_body_size 25M;

    # Proxy general a Next.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers estándar
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # WebSocket (Socket.io)
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 86400;
    }

    # Socket.io — path dedicado (más robusto que el proxy general)
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/worklist /etc/nginx/sites-enabled/
sudo nginx -t   # verificar sintaxis
```

### 6.2 Obtener certificado SSL

```bash
# Primero levantar Nginx sin SSL para que Certbot pueda validar
sudo systemctl start nginx

# Obtener certificado (reemplaza el email y dominio)
sudo certbot --nginx -d worklist.tudominio.com --email tu@email.com --agree-tos --no-eff-email

# Verificar renovación automática
sudo certbot renew --dry-run
```

---

## 7. Primer despliegue

```bash
cd /opt/worklist

# 1. Construir y levantar PostgreSQL
docker compose -f docker-compose.prod.yml up -d postgres

# 2. Esperar que Postgres arranque
sleep 5

# 3. Ejecutar migraciones (desde el contenedor temporal)
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 4. Construir y levantar la app
docker compose -f docker-compose.prod.yml up -d --build app

# 5. Recargar Nginx
sudo systemctl reload nginx
```

### Verificar que todo funciona

```bash
# Ver logs de la app
docker compose -f docker-compose.prod.yml logs -f app

# Ver logs de Postgres
docker compose -f docker-compose.prod.yml logs -f postgres

# Estado de los contenedores
docker compose -f docker-compose.prod.yml ps
```

---

## 8. Actualizaciones (redeploy)

Cada vez que hay cambios en el código:

```bash
cd /opt/worklist

# 1. Bajar el código nuevo
git pull origin main

# 2. Si hay migraciones nuevas, aplicarlas
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 3. Reconstruir y reiniciar solo la app (Postgres no se toca)
docker compose -f docker-compose.prod.yml up -d --build app

# 4. Limpiar imágenes Docker antiguas
docker image prune -f
```

---

## 9. Backups de la base de datos

### Backup manual

```bash
# Crear backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U worklist worklist > /opt/backups/worklist_$(date +%Y%m%d_%H%M).sql

# Restaurar backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U worklist worklist < /opt/backups/worklist_20260101_1200.sql
```

### Backup automático diario (cron)

```bash
# Crear directorio de backups
sudo mkdir -p /opt/backups
sudo chown $USER:$USER /opt/backups

# Agregar cron job
crontab -e
```

Agregar esta línea (backup diario a las 3 AM, retención 7 días):

```cron
0 3 * * * cd /opt/worklist && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U worklist worklist | gzip > /opt/backups/worklist_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "*.sql.gz" -mtime +7 -delete
```

---

## 10. Variables de entorno por entorno

| Variable | Desarrollo | Producción |
|----------|-----------|------------|
| `DATABASE_URL` | `postgresql://worklist:worklist_dev@localhost:5432/worklist` | URL real de Postgres |
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://worklist.tudominio.com` |
| `NEXTAUTH_SECRET` | cualquiera | `openssl rand -base64 32` |
| `NODE_ENV` | `development` | `production` |
| `R2_*` | vacías (usa disco local) | credenciales reales |

---

## 11. Checklist de lanzamiento

- [ ] Dominio apunta a la IP del VPS (`dig worklist.tudominio.com`)
- [ ] Certificado SSL activo (`https://` carga sin error)
- [ ] Login con email funciona (recibe magic link)
- [ ] Login con Google funciona (URL de callback configurada en Google Console)
- [ ] Crear workspace, columnas y tarjetas
- [ ] Subir imagen/PDF como adjunto → aparece en el grid
- [ ] Tiempo real: abrir el tablero en dos pestañas, mover tarjeta → se actualiza en ambas
- [ ] Variables de R2 configuradas y archivos se sirven desde `r2.dev`
- [ ] Backup manual ejecutado y restaurado correctamente

---

## 12. Solución de problemas comunes

### La app no arranca

```bash
docker compose -f docker-compose.prod.yml logs app --tail 50
```

Causas frecuentes:
- `.env` falta o tiene errores de sintaxis
- `DATABASE_URL` no conecta (Postgres no levantó aún)
- Puerto 3000 ocupado por otro proceso

### Socket.io no conecta (tiempo real no funciona)

Verificar que Nginx tiene los headers `Upgrade` y `Connection` correctos. Probar:
```bash
curl -i https://worklist.tudominio.com/socket.io/?EIO=4&transport=polling
```
Debe responder con `200` y JSON, no `502`.

### Prisma no encuentra el cliente generado

```bash
docker compose -f docker-compose.prod.yml run --rm app npx prisma generate
docker compose -f docker-compose.prod.yml restart app
```

### Error de permisos en uploads (solo si usas disco local en dev)

```bash
chmod -R 755 /opt/worklist/public/uploads
```

---

## Arquitectura final en producción

```
Internet
   │ HTTPS 443
   ▼
┌──────────┐
│  Nginx   │  ← SSL termination, proxy, max 25 MB body
└────┬─────┘
     │ HTTP 3000 (localhost only)
     ▼
┌──────────────────────┐
│  Next.js App         │  ← server.ts + Socket.io (tsx)
│  (Docker container)  │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌──────────────┐
│ Postgres│  │ Cloudflare R2│  ← archivos adjuntos (CDN global)
│ (Docker)│  │  (externo)   │
└─────────┘  └──────────────┘
```
