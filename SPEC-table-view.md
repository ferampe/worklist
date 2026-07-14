# SPEC — Vista de tabla para el tablero

> Fecha: 2026-07-02 · Estado: **implementado**
> Feature aislada sobre el board actual (`app/w/[id]/board-client.tsx`).
> Decisión §5 resuelta: **Opción A** — campo `creator` añadido al schema.

## 1. Objetivo

Añadir un **segundo modo de vista** al tablero de un workspace. Hoy solo existe la
vista Kanban (columnas horizontales con tarjetas). Se añade una vista de **tabla**
que lista columnas y tareas de forma vertical y ordenada, mostrando más metadatos
por tarea en un formato denso y escaneable.

El usuario alterna entre ambas vistas con un **botón/selector en la cabecera** del
tablero.

## 2. Alcance

### Incluye
- Selector de modo de vista en el header: **Tablero** (Kanban, actual) ↔ **Tabla** (nuevo).
- Vista de tabla que agrupa por columna:
  - Una **fila de encabezado por columna** con su nombre, su color y el nº de tareas.
  - Debajo, **una fila por tarea** de esa columna, en el orden actual (`position`).
- Columnas de datos por tarea:
  1. **Título** de la tarea.
  2. **Creador** — usuario que creó la tarea *(requiere cambio de schema, ver §5)*.
  3. **Asignado** — usuario asignado (`assignee`, ya existe).
  4. Indicadores existentes reutilizables: estado (`isDone`), fecha límite (`dueDate`),
     nº de subtareas. *(opcionales, ver §4)*.
- **Respeto del color** asignado:
  - La fila de encabezado de columna usa el color de columna (hex) igual que el header Kanban.
  - Cada fila de tarea refleja el color de tarjeta (`card.color` → `CARD_COLORS`) mediante
    un borde/acento izquierdo, consistente con `CardItem`.
- **Clic en una fila de tarea** abre el **mismo `CardModal`** que la vista Kanban
  (reutiliza `selectedCardId` / `onCardClick`), sin lógica nueva de edición.
- Persistir el modo de vista elegido en `localStorage` por workspace (sin tocar la BD).

### No incluye (v1)
- Ordenar / filtrar / agrupar por otras columnas (solo el orden natural por columna → position).
- Editar campos inline en la tabla (el modal sigue siendo el único punto de edición).
- Drag & drop en la vista tabla (reordenar sigue siendo exclusivo del Kanban).
- Exportar a CSV/Excel.
- Real-time diferenciado: la tabla se alimenta de la **misma** query
  `["workspace", workspaceId]`, así que los eventos de socket ya existentes la
  actualizan sin trabajo extra.

## 3. UX / diseño

### Selector de vista (header)
- Ubicado en `board-client.tsx`, en el `<header>`, junto a la búsqueda / ⚙ / tema.
- Toggle de dos segmentos con iconos + etiqueta: `▦ Tablero` | `☰ Tabla`.
- Estado local `viewMode: "board" | "table"`, inicializado desde
  `localStorage[`viewMode:${workspaceId}`]` (default `"board"`).

### Layout de la tabla
- Contenedor scrolleable vertical (a diferencia del Kanban que es horizontal).
- Ancho máximo centrado (legible), fondo semitransparente sobre el `boardBackground`
  para mantener coherencia visual con el board.
- Estructura por columna:

```
┌──────────────────────────────────────────────────────────────┐
│ ● Nombre de columna                                    (3)     │  ← fila encabezado (color de columna)
├──────────────┬──────────────┬──────────────┬─────────┬────────┤
│ Título        │ Creador      │ Asignado     │ Vence   │ Estado │  ← cabecera de campos (una vez, arriba)
├──────────────┼──────────────┼──────────────┼─────────┼────────┤
│▎Tarea 1       │ Ana          │ Beto         │ 5 jul   │ ○      │  ← fila tarea (acento = color tarjeta)
│▎Tarea 2       │ Ana          │ —            │ —       │ ✓      │
└──────────────┴──────────────┴──────────────┴─────────┴────────┘
```

- Cabecera de campos: sticky arriba; cada grupo de columna repite su fila de encabezado.
- Fila de tarea:
  - `hover` resalta la fila; `cursor-pointer`.
  - Título con `line-through` + atenuado si `isDone` (igual que `CardItem`).
  - Creador / Asignado: avatar-inicial (mismo patrón que `CardItem`) + nombre; `—` si no hay.
  - Fecha con color rojo si vencida y no hecha (misma regla que `CardItem`).
- Búsqueda del header (`search`) también filtra las filas de la tabla (mismo filtro por título).
- Estados vacíos: columna sin tareas → fila tenue "Sin tareas".

### Responsive
- En pantallas estrechas, la tabla permite scroll horizontal dentro de su propio
  contenedor (`overflow-x-auto`); las columnas de metadatos menos críticas
  (Estado, Vence) pueden ocultarse por breakpoint.

## 4. Datos disponibles vs. necesarios

`CardData` (en `board-client.tsx`) ya trae:
`id, columnId, title, isDone, isArchived, color, description, position, dueDate,
assignee{ id,name,image }, _count.subtasks`.

Para la vista tabla **falta**: el **creador** de la tarea.

## 5. Cambio de schema — campo creador (decisión clave)

El modelo `Card` (`prisma/schema.prisma`) hoy **no** almacena quién creó la tarjeta.
Para la columna "usuario que lo creó" se propone:

```prisma
model Card {
  ...
  creatorId String?
  creator   User?   @relation("CardCreator", fields: [creatorId], references: [id], onDelete: SetNull)
  ...
}

model User {
  ...
  createdCards Card[] @relation("CardCreator")
  // (la relación existente de assignee se mantiene aparte)
}
```

Trabajo asociado:
1. Añadir `creatorId` + relación `CardCreator` en `schema.prisma` y `prisma db push`
   (el repo usa `db push`, sin migraciones versionadas).
2. Al **crear** una tarjeta (`POST /api/columns/[id]/cards`), setear
   `creatorId` = usuario de la sesión.
3. Incluir `creator { id, name, image }` en:
   - `GET /api/workspaces/[id]` (para alimentar la tabla), y
   - añadir `creator` a la interfaz `CardData`.

**Limitación:** las tarjetas **ya existentes** quedarán con `creatorId = null` y
mostrarán `—` en la columna Creador (no hay dato histórico para backfill fiable).

> ⚠️ Decisión a confirmar antes de implementar:
> **(A)** Incluir el campo creador ahora (schema + backfill nulo) — *recomendado*, o
> **(B)** Lanzar la vista tabla sin la columna Creador y añadirla después.

## 6. Cambios por archivo (plan de implementación)

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | (Opción A) `creatorId` + relación `CardCreator` en `Card`/`User`. |
| `app/api/columns/[id]/cards/route.ts` | (Opción A) setear `creatorId` desde la sesión al crear. |
| `app/api/workspaces/[id]/route.ts` | (Opción A) incluir `creator` en el `include` de cards. |
| `app/w/[id]/board-client.tsx` | Añadir `creator` a `CardData`; estado `viewMode` + persistencia; selector en header; render condicional Kanban vs `BoardTable`; pasar `onCardClick`. |
| `components/board/board-table.tsx` **(nuevo)** | Componente de la vista tabla: agrupa por columna, filas de tarea, colores, clic → `onCardClick`. |
| `lib/card-colors.ts` | Reutilizar `CARD_COLORS` (posible helper para el acento de fila). Sin cambios estructurales previstos. |

El `CardModal` **no se modifica**: la tabla reutiliza el mismo `selectedCardId`.

## 7. Criterios de aceptación

- [ ] Existe un selector Tablero/Tabla en el header; alterna la vista sin recargar.
- [ ] La preferencia de vista persiste al recargar (por workspace).
- [ ] La tabla lista, por cada columna, su encabezado + sus tareas en orden.
- [ ] Cada tarea muestra título, creador, asignado (y vence/estado según §4).
- [ ] La fila respeta el color de tarjeta; el encabezado respeta el color de columna.
- [ ] Clic en una fila abre el `CardModal` correcto.
- [ ] La búsqueda del header filtra también en la tabla.
- [ ] Eventos real-time (card:created/updated/deleted) refrescan la tabla.
- [ ] Vista tabla es solo-lectura salvo por abrir el modal (sin drag & drop).
```
