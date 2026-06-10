"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardItem } from "./card-item";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CARD_COLORS, type CardColorKey } from "@/lib/card-colors";
import { SOLID_PRESETS } from "@/lib/board-backgrounds";
import type { CardData, ColumnData, ColumnWidth, WorkspaceData } from "@/app/w/[id]/board-client";

const COL_WIDTH: Record<ColumnWidth, string> = {
  sm: "w-64",
  md: "w-80",
  lg: "w-96",
};

interface Props {
  column: ColumnData;
  workspaceId: string;
  columnWidth: ColumnWidth;
  onCardClick: (cardId: string) => void;
}

function ArchivedCardsSection({ columnId, workspaceId }: { columnId: string; workspaceId: string }) {
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery<CardData[]>({
    queryKey: ["archived-cards", columnId],
    queryFn: () => fetch(`/api/columns/${columnId}/archived-cards`).then((r) => r.json()),
  });

  const unarchive = useMutation({
    mutationFn: (cardId: string) =>
      fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      }).then((r) => r.json()),
    onSuccess: (card: CardData) => {
      qc.setQueryData<CardData[]>(["archived-cards", columnId], (prev) =>
        prev?.filter((c) => c.id !== card.id) ?? [],
      );
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, cards: [...col.cards, card] } : col,
          ),
        } : prev,
      );
    },
  });

  const getColorKey = (key: string): CardColorKey =>
    (key as CardColorKey) in CARD_COLORS ? (key as CardColorKey) : "none";

  return (
    <div className="mt-1 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-1 mb-1.5">
        Archivadas
      </p>
      {isLoading ? (
        <p className="text-xs text-gray-400 px-1 py-1">Cargando…</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 px-1 py-1">Sin tarjetas archivadas</p>
      ) : (
        <div className="space-y-1">
          {cards.map((card) => {
            const ck = getColorKey(card.color);
            const hasColor = ck !== "none";
            return (
              <div
                key={card.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/50"
              >
                {hasColor && (
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 opacity-60", CARD_COLORS[ck].dot)} />
                )}
                <span className="flex-1 truncate text-xs text-gray-400 dark:text-gray-600 line-through">
                  {card.title}
                </span>
                <button
                  onClick={() => unarchive.mutate(card.id)}
                  disabled={unarchive.isPending}
                  className="shrink-0 text-gray-300 hover:text-blue-500 dark:text-gray-700 dark:hover:text-blue-400 transition-colors text-sm leading-none cursor-pointer"
                  title="Restaurar tarjeta"
                >
                  ↩
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BoardColumn({ column, workspaceId, columnWidth, onCardClick }: Props) {
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [colName, setColName] = useState(column.name);
  const [colColor, setColColor] = useState(column.color ?? "");
  // Keep local color in sync when the cache is updated externally (socket, refetch)
  useEffect(() => { setColColor(column.color ?? ""); }, [column.color]);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteCol, setConfirmDeleteCol] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const hasColor = colColor !== "";
  // Text/icon color: white when header has a background color, gray otherwise
  const headerText = hasColor ? "text-white/90" : "text-gray-700 dark:text-gray-200";
  const headerMuted = hasColor ? "text-white/60" : "text-gray-400 dark:text-gray-500";
  const headerBtn = hasColor
    ? "text-white/60 hover:text-white hover:bg-white/20"
    : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400";

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

  const updateColumnColor = useMutation({
    mutationFn: (color: string) =>
      fetch(`/api/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? { ...prev, columns: prev.columns.map((c) => c.id === column.id ? { ...c, color: updated.color } : c) } : prev
      );
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
    <div ref={setNodeRef} style={style} data-board-column="true" className={cn("shrink-0 flex flex-col max-h-full", COL_WIDTH[columnWidth])}>
      {/* Column header */}
      <div
        {...attributes}
        {...listeners}
        style={hasColor ? { backgroundColor: colColor } : undefined}
        className={cn(
          "group/header flex items-center justify-between px-3 py-2 rounded-t-xl cursor-grab active:cursor-grabbing transition-colors",
          hasColor ? "" : "bg-gray-100 dark:bg-gray-800",
        )}
      >
        {editingName ? (
          <input
            ref={inputRef}
            className="flex-1 bg-white/20 dark:bg-white/10 text-white rounded px-2 py-0.5 text-sm font-medium border border-white/40 outline-none placeholder:text-white/50"
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
            className={cn("flex-1 text-sm font-semibold truncate", headerText)}
            onDoubleClick={() => setEditingName(true)}
          >
            {column.name}
          </span>
        )}

        <span className={cn("text-xs ml-2 shrink-0", headerMuted)}>{column.cards.length}</span>

        {/* Archive toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowArchived((v) => !v); }}
          className={cn(
            "ml-1 text-xs leading-none px-1.5 py-0.5 rounded transition-colors shrink-0",
            showArchived
              ? hasColor
                ? "bg-white/20 text-white"
                : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
              : headerBtn,
          )}
          title={showArchived ? "Ocultar archivadas" : "Ver archivadas"}
        >
          ▣
        </button>

        {/* Settings popover */}
        <Popover>
          <PopoverTrigger
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "ml-1 text-xs leading-none w-6 h-6 flex items-center justify-center rounded transition-all shrink-0 cursor-pointer",
              "opacity-60 hover:opacity-100",
              headerBtn,
            )}
            title="Configuración de columna"
          >
            ⚙
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-56 p-3 space-y-3">
            {/* Color section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                Color de columna
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {/* None / reset */}
                <button
                  onClick={() => { setColColor(""); updateColumnColor.mutate(""); }}
                  title="Sin color"
                  className={cn(
                    "h-7 rounded-md border-2 text-xs font-bold transition-all cursor-pointer",
                    !colColor
                      ? "border-blue-500 bg-gray-100 dark:bg-gray-800 text-gray-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-300 hover:border-gray-400",
                  )}
                >
                  ✕
                </button>
                {SOLID_PRESETS.map(({ label, value }) => (
                  <button
                    key={value}
                    title={label}
                    onClick={() => { setColColor(value); updateColumnColor.mutate(value); }}
                    style={{ backgroundColor: value }}
                    className={cn(
                      "h-7 rounded-md border-2 transition-all cursor-pointer",
                      colColor === value
                        ? "border-blue-400 scale-110 shadow-md"
                        : "border-transparent hover:scale-105 hover:shadow-sm",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
              {!confirmDeleteCol ? (
                <button
                  onClick={() => setConfirmDeleteCol(true)}
                  className="w-full text-left text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  🗑 Eliminar columna
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-snug">
                    ¿Eliminar &ldquo;{column.name}&rdquo;? Las tarjetas se perderán.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteCol(false)}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => deleteColumn.mutate()}
                      disabled={deleteColumn.isPending}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {deleteColumn.isPending ? "…" : "Eliminar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Cards area */}
      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 px-2 pt-2 pb-2 space-y-2 min-h-[40px]">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} onClick={() => onCardClick(card.id)} />
          ))}
        </SortableContext>

        {showArchived && (
          <ArchivedCardsSection columnId={column.id} workspaceId={workspaceId} />
        )}

        {addingCard ? (
          <div className="space-y-2 pt-1">
            <Input
              className="bg-white dark:bg-gray-700 dark:text-white border-0 text-sm shadow-sm"
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
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-2 py-1.5 transition-colors"
          >
            + Agregar tarjeta
          </button>
        )}
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-b-xl" />
    </div>
  );
}
