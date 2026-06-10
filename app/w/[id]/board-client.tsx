"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { BoardColumn } from "@/components/board/board-column";
import { CardItem } from "@/components/board/card-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/board/card-modal";
import { WorkspaceSettings } from "@/components/board/workspace-settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_BG } from "@/lib/board-backgrounds";

export interface CardData {
  id: string;
  columnId: string;
  title: string;
  isDone: boolean;
  isArchived: boolean;
  color: string;
  description: unknown;
  position: number;
  dueDate: string | null;
  assignee: { id: string; name: string | null; image: string | null } | null;
  _count: { subtasks: number };
}

export interface ColumnData {
  id: string;
  name: string;
  color: string;
  position: number;
  cards: CardData[];
}

export type ColumnWidth = "sm" | "md" | "lg";

export interface WorkspaceData {
  id: string;
  name: string;
  columnWidth: ColumnWidth;
  boardBackground: string;
  columns: ColumnData[];
}

export function BoardClient({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panOriginRef = useRef({ x: 0, scrollLeft: 0 });

  const { data: workspace, isLoading } = useQuery<WorkspaceData>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
  });

  // Board pan-to-scroll: drag on empty board space scrolls horizontally
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isPanningRef.current || !scrollRef.current) return;
      const dx = e.clientX - panOriginRef.current.x;
      scrollRef.current.scrollLeft = panOriginRef.current.scrollLeft - dx;
    }
    function onMouseUp() {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Only left button; ignore if click originated inside a column or its children
    if (e.button !== 0) return;
    if ((e.target as Element).closest("[data-board-column]")) return;
    // Also ignore clicks on interactive elements (buttons, inputs)
    const tag = (e.target as Element).tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;

    const el = scrollRef.current!;
    if (el.scrollWidth <= el.clientWidth) return;

    isPanningRef.current = true;
    panOriginRef.current = { x: e.clientX, scrollLeft: el.scrollLeft };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    let socket: import("socket.io-client").Socket;
    import("socket.io-client").then(({ io }) => {
      socket = io({ path: "/api/socket" });
      socket.emit("join-workspace", workspaceId);

    socket.on("card:created", (card: CardData) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === card.columnId ? { ...col, cards: [...col.cards.filter((c) => c.id !== card.id), card] } : col,
          ),
        } : prev,
      );
    });

    socket.on("card:updated", (card: CardData & { isArchived?: boolean }) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            cards: card.isArchived
              ? col.cards.filter((c) => c.id !== card.id)
              : col.cards.map((c) => c.id === card.id ? { ...c, ...card } : c),
          })),
        };
      });
    });

    socket.on("card:deleted", ({ id }: { id: string }) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== id) })),
        } : prev,
      );
    });

    socket.on("column:updated", (column: { id: string; name: string; color: string; position: number }) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => col.id === column.id ? { ...col, ...column } : col),
        } : prev,
      );
    });

    socket.on("column:deleted", ({ id }: { id: string }) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? { ...prev, columns: prev.columns.filter((col) => col.id !== id) } : prev,
      );
    });

    });
    return () => {
      socket?.emit("leave-workspace", workspaceId);
      socket?.disconnect();
    };
  }, [workspaceId, qc]);

  const addColumn = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/workspaces/${workspaceId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setAddingColumn(false);
      setNewColName("");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function findColumn(cardId: string) {
    return workspace?.columns.find((c) => c.cards.some((card) => card.id === cardId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over || !workspace) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Column reorder
    if (active.data.current?.type === "column") {
      const cols = workspace.columns;
      const oldIdx = cols.findIndex((c) => c.id === activeId);
      const newIdx = cols.findIndex((c) => c.id === overId);
      if (oldIdx === newIdx) return;

      const reordered = arrayMove(cols, oldIdx, newIdx);
      const updates = reordered.map((col, i) => ({ id: col.id, position: (i + 1) * 1000 }));

      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? { ...prev, columns: reordered.map((c, i) => ({ ...c, position: (i + 1) * 1000 })) } : prev
      );

      await Promise.all(
        updates.map(({ id, position }) =>
          fetch(`/api/columns/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position }),
          })
        )
      );
      return;
    }

    // Card move/reorder
    if (active.data.current?.type === "card") {
      const sourceCol = findColumn(activeId);
      if (!sourceCol) return;

      const targetCol = workspace.columns.find((c) => c.id === overId) ??
        workspace.columns.find((c) => c.cards.some((card) => card.id === overId));
      if (!targetCol) return;

      const isSameCol = sourceCol.id === targetCol.id;
      const targetCards = targetCol.cards.filter((c) => c.id !== activeId);
      const overCardIdx = targetCards.findIndex((c) => c.id === overId);
      const insertIdx = overCardIdx === -1 ? targetCards.length : overCardIdx;

      targetCards.splice(insertIdx, 0, { ...sourceCol.cards.find((c) => c.id === activeId)!, columnId: targetCol.id });
      const newPositions = targetCards.map((c, i) => ({ id: c.id, position: (i + 1) * 1000 }));

      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === sourceCol.id && !isSameCol) {
              return { ...col, cards: col.cards.filter((c) => c.id !== activeId) };
            }
            if (col.id === targetCol.id) {
              return { ...col, cards: targetCards.map((c, i) => ({ ...c, position: (i + 1) * 1000 })) };
            }
            return col;
          }),
        };
      });

      await Promise.all(
        newPositions.map(({ id, position }) =>
          fetch(`/api/cards/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position, columnId: id === activeId ? targetCol.id : undefined }),
          })
        )
      );
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "card") {
      setActiveCard(event.active.data.current.card);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Cargando tablero…</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Espacio no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: workspace.boardBackground || DEFAULT_BG }}>
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-black/20 text-white shrink-0 backdrop-blur-sm">
        <Link href="/dashboard" className="text-blue-200 hover:text-white text-sm shrink-0">
          ← Inicio
        </Link>
        <h1 className="font-bold text-lg shrink-0">{workspace.name}</h1>
        <div className="flex-1 max-w-xs ml-auto">
          <input
            placeholder="Buscar tarjetas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/20 placeholder-blue-200 text-white text-sm px-3 py-1.5 rounded-lg outline-none focus:bg-white/30 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/20 transition-colors text-base"
          title="Configuración del espacio"
        >
          ⚙
        </button>
        <ThemeToggle className="text-white hover:bg-white/20" />
      </header>

      {/* Board */}
      <div
        ref={scrollRef}
        onMouseDown={handleBoardMouseDown}
        className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 cursor-grab active:cursor-grabbing"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workspace.columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 h-full items-start">
              {workspace.columns.map((col) => {
                const filteredCol = search.trim()
                  ? { ...col, cards: col.cards.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) }
                  : col;
                return (
                  <BoardColumn
                    key={col.id}
                    column={filteredCol}
                    workspaceId={workspaceId}
                    columnWidth={workspace.columnWidth ?? "sm"}
                    onCardClick={(cardId) => setSelectedCardId(cardId)}
                  />
                );
              })}

              {/* Add column */}
              <div className={`shrink-0 ${{ sm: "w-64", md: "w-80", lg: "w-96" }[workspace.columnWidth ?? "sm"]}`}>
                {addingColumn ? (
                  <div className="bg-white/20 rounded-xl p-2 space-y-2">
                    <Input
                      className="bg-white text-gray-900 border-0"
                      placeholder="Nombre de la columna"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newColName.trim()) addColumn.mutate(newColName);
                        if (e.key === "Escape") setAddingColumn(false);
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-white text-gray-900 hover:bg-gray-100"
                        onClick={() => newColName.trim() && addColumn.mutate(newColName)}
                        disabled={addColumn.isPending}
                      >
                        Agregar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => setAddingColumn(false)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="w-full text-left px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
                  >
                    + Agregar columna
                  </button>
                )}
              </div>
            </div>
          </SortableContext>

          <DragOverlay>
            {activeCard && <CardItem card={activeCard} overlay />}
          </DragOverlay>
        </DndContext>
      </div>

      {showSettings && (
        <WorkspaceSettings workspaceId={workspaceId} onClose={() => setShowSettings(false)} />
      )}

      {selectedCardId && (
        <CardModal
          cardId={selectedCardId}
          workspaceId={workspaceId}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}
