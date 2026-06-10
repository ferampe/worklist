@AGENTS.md

# Worklist — CLAUDE.md

App web de gestión de tareas colaborativa estilo Kanban. Spec completo en `SPEC.md`.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Editor | TipTap (pegado de imágenes Ctrl+V) |
| Drag & drop | dnd-kit |
| Estado servidor | TanStack Query |
| ORM | Prisma |
| Base de datos | PostgreSQL (local en VPS) |
| Auth | Auth.js v5 (email + Google OAuth) |
| Almacenamiento imágenes | Cloudflare R2 o AWS S3 |
| Tiempo real | Socket.io |
| Deploy | VPS propio — Docker + Nginx + SSL (Let's Encrypt) |

TypeScript en todo (frontend + backend). Backend = Next.js API Routes en `app/api/`.

## Estructura esperada del proyecto

```
app/
  api/          ← API Routes (backend TypeScript)
  (auth)/       ← páginas de login/registro
  dashboard/    ← workspaces del usuario
  w/[id]/       ← tablero de un workspace
components/
  ui/           ← shadcn/ui (no tocar)
  board/        ← columnas, tarjetas, editor
lib/
  prisma.ts     ← cliente Prisma singleton
  auth.ts       ← config Auth.js
prisma/
  schema.prisma
```

## Modelo de datos

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  avatarUrl     String?
  passwordHash  String?  // null para OAuth
}

model Workspace {
  id          String     @id @default(cuid())
  name        String
  ownerId     String
  visibility  String     // 'private' | 'public'
  publicToken String?
  createdAt   DateTime   @default(now())
  members     WorkspaceMember[]
  columns     Column[]
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        String     // 'owner' | 'editor' | 'viewer'
  @@id([workspaceId, userId])
}

model Column {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  position    Float
  cards       Card[]
}

model Card {
  id          String   @id @default(cuid())
  columnId    String
  title       String
  description Json?    // documento TipTap (ProseMirror JSON)
  isDone      Boolean  @default(false)
  dueDate     DateTime?
  assigneeId  String?
  position    Float
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  subtasks    Subtask[]
  attachments Attachment[]
}

model Subtask {
  id       String  @id @default(cuid())
  cardId   String
  text     String
  isDone   Boolean @default(false)
  position Float
}

model Attachment {
  id          String   @id @default(cuid())
  cardId      String
  storagePath String
  url         String
  mimeType    String
  size        Int
  createdAt   DateTime @default(now())
}
```

## Decisiones técnicas clave

**Imágenes en el editor:**
1. TipTap intercepta `paste`/`drop` con imagen.
2. Se sube a R2/S3 vía `POST /api/upload`.
3. La URL se inserta como nodo `image` en el documento.
4. `cards.description` guarda el JSON de ProseMirror — jamás base64.

**Ordenación (columnas y tarjetas):** campo `position: Float`. Al mover, se usa índice fraccional (promedio de posiciones adyacentes) para evitar reescribir toda la lista.

**Control de acceso:** cada API Route verifica la sesión + rol en `workspace_members`. Los workspaces públicos usan `public_token` en la URL. No hay RLS en Postgres — la lógica vive en el backend.

**Tiempo real:** Socket.io emite eventos de entidad (`card:updated`, `column:moved`, etc.) al room del workspace. No hay CRDT — si dos usuarios editan el mismo campo simultáneamente, gana el último guardado.

## Fase actual: **Fase 0 — Base**

Lo que hay que construir ahora:
1. ~~`npx create-next-app@latest`~~ — hecho.
2. Instalar y configurar Prisma + schema inicial.
3. Levantar PostgreSQL local con Docker Compose.
4. Configurar Auth.js v5 con provider Email + Google.
5. Páginas de login/registro funcionales.
6. Middleware de sesión para rutas protegidas.

La Fase 1 (workspaces, columnas, tarjetas, drag & drop, editor) empieza después.

## Convenciones

- Server Components por defecto; `"use client"` solo donde hay interactividad.
- Mutations vía Server Actions o API Routes — no fetch directo desde cliente a Prisma.
- shadcn/ui para todos los componentes base (no reinventar botones, modals, etc.).
- Nombres en inglés en código; español solo en comentarios y UI visible.
