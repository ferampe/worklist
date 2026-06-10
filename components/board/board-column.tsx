"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardItem } from "./card-item";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ColumnData, WorkspaceData } from "@/app/w/[id]/board-client";

interface Props {
  column: ColumnData;
  workspaceId: string;
  onCardClick: (cardId: string) => void;
}

export function BoardColumn({ column, workspaceId, onCardClick }: Props) {
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [colName, setColName] = useState(column.name);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const renameColumn = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? { ...prev, columns: prev.columns.map((c) => c.id === column.id ? { ...c, name: colName } : c) } : prev
      );
      setEditingName(false);
    },
  });

  const deleteColumn = useMutation({
    mutationFn: () => fetch(`/api/columns/${column.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? { ...prev, columns: prev.columns.filter((c) => c.id !== column.id) } : prev
      );
    },
  });

  const addCard = useMutation({
    mutationFn: (title: string) =>
      fetch(`/api/columns/${column.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).then((r) => r.json()),
    onSuccess: (card) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((c) => c.id === column.id ? { ...c, cards: [...c.cards, card] } : c),
        } : prev
      );
      setAddingCard(false);
      setNewCardTitle("");
    },
  });

  return (
    <div ref={setNodeRef} style={style} className="shrink-0 w-64 flex flex-col max-h-full">
      {/* Column header */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded-t-xl cursor-grab active:cursor-grabbing"
      >
        {editingName ? (
          <input
            ref={inputRef}
            className="flex-1 bg-white rounded px-2 py-0.5 text-sm font-medium border border-blue-400 outline-none"
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            onBlur={() => colName.trim() ? renameColumn.mutate(colName) : setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") colName.trim() ? renameColumn.mutate(colName) : setEditingName(false);
              if (e.key === "Escape") { setColName(column.name); setEditingName(false); }
            }}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-gray-700 truncate"
            onDoubleClick={() => setEditingName(true)}
          >
            {column.name}
          </span>
        )}
        <span className="text-xs text-gray-400 ml-2">{column.cards.length}</span>
        <button
          onClick={() => { if (confirm(`¿Eliminar columna "${column.name}"?`)) deleteColumn.mutate(); }}
          className="ml-2 text-gray-300 hover:text-red-400 text-xs leading-none"
          title="Eliminar columna"
        >
          ✕
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-2 pb-2 space-y-2 min-h-[40px]">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} onClick={() => onCardClick(card.id)} />
          ))}
        </SortableContext>

        {addingCard ? (
          <div className="space-y-2 pt-1">
            <Input
              className="bg-white border-0 text-sm shadow-sm"
              placeholder="Título de la tarjeta…"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCardTitle.trim()) addCard.mutate(newCardTitle);
                if (e.key === "Escape") setAddingCard(false);
              }}
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="text-xs h-7"
                onClick={() => newCardTitle.trim() && addCard.mutate(newCardTitle)}
                disabled={addCard.isPending}
              >
                Agregar
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAddingCard(false)}>
                ✕
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded px-2 py-1.5 transition-colors"
          >
            + Agregar tarjeta
          </button>
        )}
      </div>
      <div className="h-2 bg-gray-100 rounded-b-xl" />
    </div>
  );
}
