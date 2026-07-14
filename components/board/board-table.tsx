"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CARD_COLORS, type CardColorKey } from "@/lib/card-colors";
import type { CardData, ColumnData } from "@/app/w/[id]/board-client";

interface Props {
  columns: ColumnData[];
  search: string;
  onCardClick: (cardId: string) => void;
}

function isLightColor(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 150;
}

function UserCell({ user }: { user: CardData["assignee"] }) {
  if (!user) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span
        className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
        title={user.name ?? ""}
      >
        {(user.name ?? "?")[0].toUpperCase()}
      </span>
      <span className="truncate text-gray-600 dark:text-gray-300">{user.name ?? "—"}</span>
    </span>
  );
}

function TaskRow({ card, onCardClick }: { card: CardData; onCardClick: (id: string) => void }) {
  const colorKey = (card.color as CardColorKey) ?? "none";
  const color = CARD_COLORS[colorKey] ?? CARD_COLORS.none;
  const hasColor = colorKey !== "none";

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const isOverdue = now && dueDate && dueDate < now && !card.isDone;

  return (
    <tr
      onClick={() => onCardClick(card.id)}
      className="group cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors"
    >
      {/* Título con acento de color de tarjeta */}
      <td className="py-2 pl-3 pr-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn("w-1 self-stretch rounded-full shrink-0", hasColor ? color.dot : "bg-transparent")}
            style={{ minHeight: "1.25rem" }}
          />
          <span className={cn(
            "truncate text-sm",
            card.isDone
              ? "line-through text-gray-400 dark:text-gray-500"
              : "text-gray-800 dark:text-gray-100",
          )}>
            {card.title}
          </span>
        </div>
      </td>
      {/* Creador */}
      <td className="py-2 px-3 text-sm max-w-[10rem]"><UserCell user={card.creator} /></td>
      {/* Asignado */}
      <td className="py-2 px-3 text-sm max-w-[10rem]"><UserCell user={card.assignee} /></td>
      {/* Vence */}
      <td className="py-2 px-3 text-sm whitespace-nowrap">
        {dueDate ? (
          <span className={cn(isOverdue ? "text-red-500 font-medium" : "text-gray-500 dark:text-gray-400")}>
            {dueDate.toLocaleDateString("es", { month: "short", day: "numeric" })}
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      {/* Estado */}
      <td className="py-2 px-3 text-sm text-center">
        {card.isDone ? (
          <span className="text-emerald-500" title="Hecha">✓</span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600" title="Pendiente">○</span>
        )}
      </td>
    </tr>
  );
}

export function BoardTable({ columns, search, onCardClick }: Props) {
  const q = search.trim().toLowerCase();

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-4xl space-y-6">
        {columns.map((col) => {
          const cards = q
            ? col.cards.filter((c) => c.title.toLowerCase().includes(q))
            : col.cards;
          const hasColor = col.color !== "";
          const light = hasColor && isLightColor(col.color);

          return (
            <div
              key={col.id}
              className="overflow-hidden shadow-sm bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
            >
              {/* Encabezado de columna (respeta color de columna) */}
              <div
                style={hasColor ? { backgroundColor: col.color } : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5",
                  hasColor ? "" : "bg-gray-100 dark:bg-gray-800",
                )}
              >
                <span className={cn(
                  "font-semibold text-sm",
                  !hasColor ? "text-gray-700 dark:text-gray-200" : light ? "text-gray-800/90" : "text-white/90",
                )}>
                  {col.name}
                </span>
                <span className={cn(
                  "ml-auto min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold",
                  hasColor
                    ? light ? "bg-black/10 text-gray-800" : "bg-white/25 text-white"
                    : "bg-gray-300/70 text-gray-600 dark:bg-gray-600/70 dark:text-gray-300",
                )}>
                  {cards.length}
                </span>
              </div>

              {/* Tabla de tareas */}
              {cards.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-600">
                  {q ? "Sin coincidencias" : "Sin tareas"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="font-semibold py-2 pl-3 pr-3">Título</th>
                        <th className="font-semibold py-2 px-3">Creador</th>
                        <th className="font-semibold py-2 px-3">Asignado</th>
                        <th className="font-semibold py-2 px-3">Vence</th>
                        <th className="font-semibold py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="px-3">
                      {cards.map((card) => (
                        <TaskRow key={card.id} card={card} onCardClick={onCardClick} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
