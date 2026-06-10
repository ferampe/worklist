# Worklist — Especificación del Proyecto

> Herramienta de gestión de tareas y notas colaborativa, inspirada en Wunderlist,
> con espacios de trabajo compartidos, editor de texto enriquecido (con pegado de
> imágenes) y organización por columnas tipo Kanban.

**Versión:** 0.1 (borrador)
**Fecha:** 2026-06-09

---

## 1. Visión general

Worklist es una aplicación web para organizar tareas, listas y notas dentro de
**espacios de trabajo** (workspaces) que pueden ser **privados** o **públicos**,
y que se pueden **compartir** con otros usuarios. Cada espacio organiza el trabajo
en **columnas** reordenables (estilo Kanban/Trello), y cada tarea admite contenido
rico mediante un **editor de texto potente** que permite pegar imágenes directamente
con `Ctrl+C` / `Ctrl+V`.

## 2. Objetivos

- Gestionar tareas y notas en espacios organizados por columnas.
- Compartir espacios y colaborar (lectura/edición) con otros usuarios.
- Distinguir espacios privados (solo invitados) y públicos (cualquiera con el enlace).
- Ofrecer un editor enriquecido con soporte de imágenes pegadas desde el portapapeles.
- Reorganizar columnas y tarjetas mediante arrastrar y soltar (drag & drop).

### Fuera de alcance (v1)
- Apps nativas móviles (la web responsive cubre móvil en v1).
- Edición colaborativa simultánea carácter a carácter (CRDT) — se evalúa en v2.
- Integraciones externas (calendarios, Slack, etc.).

## 3. Requisitos funcionales

### 3.1 Cuentas y autenticación
- RF-01: Registro e inicio de sesión por email/contraseña.
- RF-02: Inicio de sesión con Google (OAuth).
- RF-03: Cierre de sesión y recuperación de contraseña.

### 3.2 Espacios de trabajo (workspaces)
- RF-10: Crear, renombrar y eliminar un espacio.
- RF-11: Un espacio es **privado** (solo miembros invitados) o **público**
  (accesible por enlace, opcionalmente solo lectura).
- RF-12: Invitar usuarios a un espacio por email con un **rol**: `owner`, `editor`, `viewer`.
- RF-13: Generar/revocar un enlace público de solo lectura.
- RF-14: Listar los espacios a los que pertenece el usuario.

### 3.3 Columnas
- RF-20: Crear, renombrar y eliminar columnas dentro de un espacio.
- RF-21: Reordenar columnas mediante arrastrar y soltar; el orden persiste.

### 3.4 Tarjetas / tareas
- RF-30: Crear, editar, completar y eliminar tarjetas dentro de una columna.
- RF-31: Mover tarjetas entre columnas y reordenarlas (drag & drop); el orden persiste.
- RF-32: Cada tarjeta tiene: título, descripción (editor rico), estado (completada/no),
  fecha de vencimiento opcional, y asignado opcional.
- RF-33: Subtareas (checklist) dentro de una tarjeta.

### 3.5 Editor de texto enriquecido
- RF-40: Formato básico: negrita, cursiva, subrayado, tachado, encabezados, listas,
  citas, código, enlaces.
- RF-41: **Pegar imágenes con `Ctrl+V`** desde el portapapeles: la imagen se sube
  al almacenamiento y se inserta en línea por su URL.
- RF-42: Arrastrar y soltar archivos de imagen sobre el editor para insertarlos.
- RF-43: Las imágenes se almacenan de forma persistente (no como base64 en la BD).

### 3.6 Colaboración en tiempo real
- RF-50: Los cambios en columnas/tarjetas de un espacio compartido se reflejan
  en vivo para los demás miembros conectados (sincronización a nivel de entidad).

## 4. Requisitos no funcionales

- RNF-01: **Seguridad** — el control de acceso a cada espacio/tarjeta se aplica en
  la base de datos mediante Row Level Security (no solo en el frontend).
- RNF-02: **Rendimiento** — carga inicial del tablero < 1.5 s con datos típicos.
- RNF-03: **Responsive** — usable en escritorio y móvil.
- RNF-04: **Subida de imágenes** — límite configurable (p. ej. 10 MB), validación de tipo.
- RNF-05: **Despliegue en VPS propio** — la app corre en un servidor Linux propio con Docker + Nginx como reverse proxy.

## 5. Stack tecnológico

**Librería de UI: React** (con TypeScript). Toda la interfaz se construye con
componentes de React.

**Framework: Next.js 15**, que es React + enrutamiento + backend (API) + renderizado
en servidor en un solo proyecto. Es decir, se programa en React; Next.js solo añade
encima el routing, la capa de API y el SSR para no montar un backend aparte.

**Lenguaje único: TypeScript** (frontend + backend), por su ecosistema y porque las
librerías clave (editor con pegado de imágenes, drag & drop) son nativas del
ecosistema React/JS/TS.

| Capa | Tecnología | Por qué |
|------|------------|---------|
| **Librería de UI** | **React 19** (con TypeScript) | Componentes; base de todo el frontend |
| Framework web | **Next.js 15** (App Router) | React + routing + API + SSR en un solo proyecto |
| Estilos / componentes | **Tailwind CSS + shadcn/ui** | UI rápida y consistente sobre React |
| Editor de texto | **TipTap** (React, sobre ProseMirror) | Pegado de imágenes Ctrl+V nativo y extensible |
| Drag & drop | **dnd-kit** (React) | Reordenar columnas y tarjetas, accesible |
| Estado de servidor | **TanStack Query** (React) | Caché y sincronización de datos |
| **Backend** | **Next.js API Routes** (TypeScript) | El backend vive dentro del mismo proyecto; cada endpoint es código nuestro |
| ORM | **Prisma** | Tipado automático, migraciones, queries con autocompletado |
| Base de datos | **PostgreSQL** | Relacional, robusto, gratuito (Railway/Neon/Render para hosting) |
| Auth | **Auth.js v5** (NextAuth) | Email + Google OAuth, integrado nativamente con Next.js |
| Contraseñas | **bcrypt** | Hash seguro de contraseñas |
| Almacenamiento de imágenes | **Cloudflare R2** o **AWS S3** | Almacenamiento de objetos; R2 no cobra por egress |
| Tiempo real | **Socket.io** | Websockets para sincronización en vivo entre usuarios |

> **Por qué React:** todas las piezas críticas (TipTap para el editor, dnd-kit para el
> drag & drop, shadcn/ui para la interfaz) son nativas de su ecosistema, lo que hace la
> implementación más rápida. Next.js no sustituye a React: lo envuelve para agregar
> routing, SSR y el backend propio en un solo proyecto.

> **Arquitectura del backend:** un solo proyecto Next.js. Las API Routes en `app/api/`
> son el backend — cada endpoint lo escribimos nosotros en TypeScript, con Prisma para
> acceder a Postgres y Auth.js para gestionar sesiones. No hay servicios externos
> gestionando la lógica; el control es total.

## 6. Modelo de datos (borrador)

```
users            (gestionado por Auth.js + Prisma)
  id, email, name, avatar_url, password_hash (nullable para OAuth)

workspaces
  id, name, owner_id -> users.id
  visibility: 'private' | 'public'
  public_token (nullable, para enlace público de solo lectura)
  created_at

workspace_members
  workspace_id -> workspaces.id
  user_id      -> users.id
  role: 'owner' | 'editor' | 'viewer'
  (PK compuesta workspace_id + user_id)

columns
  id, workspace_id -> workspaces.id
  name, position (float/int para ordenar)
  created_at

cards
  id, column_id -> columns.id
  title
  description (JSON del documento TipTap)
  is_done (bool)
  due_date (nullable)
  assignee_id -> users.id (nullable)
  position
  created_at, updated_at

subtasks
  id, card_id -> cards.id
  text, is_done, position

attachments  (metadatos de imágenes subidas)
  id, card_id -> cards.id
  storage_path, url, mime_type, size, created_at
```

**Control de acceso:** la lógica de permisos se aplica en las API Routes del backend —
cada endpoint verifica la sesión del usuario y su rol en `workspace_members` antes de
operar. Para workspaces públicos basta con el `public_token` en la URL.

## 7. Decisiones técnicas clave

### 7.1 Pegado de imágenes en el editor
1. TipTap captura el evento `paste`/`drop`.
2. Si el portapapeles contiene un archivo de imagen, se intercepta antes de la inserción.
3. La imagen se sube a Cloudflare R2 / AWS S3 vía un endpoint propio en `app/api/upload`.
4. Se obtiene la URL y se inserta un nodo `image` en el documento.
5. El documento (JSON de ProseMirror) se guarda en `cards.description`.

> Las imágenes **no** se guardan como base64 en la base de datos, para mantenerla ligera.

### 7.2 Orden de columnas y tarjetas
- Campo `position` por entidad. Al arrastrar, se recalcula la posición (estrategia de
  índice fraccional para evitar reescribir toda la lista).

### 7.3 Privado vs. público
- `visibility = 'private'`: acceso solo vía `workspace_members`.
- `visibility = 'public'`: lectura mediante `public_token` en la URL; escritura sigue
  requiriendo membresía.

## 8. Roadmap por fases

**Fase 0 — Base**
- Proyecto Next.js + Prisma + Postgres local, autenticación email + Google (Auth.js).

**Fase 1 — MVP**
- Crear workspaces privados, columnas y tarjetas.
- Drag & drop de columnas y tarjetas.
- Editor TipTap con formato básico + pegado de imágenes.

**Fase 2 — Colaboración**
- Invitar miembros y roles, compartir.
- Workspaces públicos con enlace de solo lectura.
- Sincronización en tiempo real.

**Fase 3 — Mejoras**
- Subtareas, fechas de vencimiento, asignados, búsqueda, móvil pulido.

## 9. Infraestructura y despliegue (VPS propio)

```
VPS Linux (Ubuntu)
├── Nginx                  ← reverse proxy + SSL (Let's Encrypt)
│   └── proxy_pass → localhost:3000
├── Next.js (next start)   ← app + API Routes + Socket.io
│   └── puerto 3000
├── PostgreSQL             ← base de datos local en el VPS
└── Almacenamiento local   ← imágenes en disco (o montaje S3-compatible)
```

**Herramientas de operación:**
- **Docker + Docker Compose** — para levantar Postgres y la app de forma reproducible.
- **PM2 o Docker** — para mantener el proceso Node.js corriendo (reinicio automático).
- **Nginx** — reverse proxy, SSL terminado con Certbot (Let's Encrypt, gratuito).
- **Backups de Postgres** — `pg_dump` programado con cron.

**Ventajas de VPS propio:** sin costes de plataforma, control total de los datos,
Socket.io sin restricciones serverless, almacenamiento de imágenes en disco propio.

## 10. Riesgos y consideraciones

- **Edición colaborativa simultánea del texto**: la sync a nivel de entidad (v1) no
  resuelve dos personas editando la misma nota a la vez. Para eso se necesitaría Yjs/CRDT (v2).
- **Almacenamiento de imágenes** — en VPS el disco es finito; definir límites por usuario y política de limpieza.
- **Backups** — responsabilidad propia; programar `pg_dump` diario y backup del almacenamiento.
