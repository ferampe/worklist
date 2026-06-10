"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export interface CardData {
  id: string;
  columnId: string;
  title: string;
  isDone: boolean;
  position: number;
  dueDate: string | null;
  assignee: { id: string; name: string | null; image: string | null } | null;
  _count: { subtasks: number };
}

export interface ColumnData {
  id: string;
  name: string;
  position: number;
  cards: CardData[];
}

export interface WorkspaceData {
  id: string;
  name: string;
  columns: ColumnData[];
}

export function BoardClient({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { data: workspace, isLoading } = useQuery<WorkspaceData>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
  });

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
    <div className="flex flex-col h-screen bg-blue-600">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 bg-blue-700/50 text-white shrink-0">
        <Link href="/dashboard" className="text-blue-200 hover:text-white text-sm">
          ← Inicio
        </Link>
        <h1 className="font-bold text-lg">{workspace.name}</h1>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
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
              {workspace.columns.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  workspaceId={workspaceId}
                  onCardClick={(cardId) => setSelectedCardId(cardId)}
                />
              ))}

              {/* Add column */}
              <div className="shrink-0 w-64">
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
