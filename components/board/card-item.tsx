"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { CardData } from "@/app/w/[id]/board-client";
import { CARD_COLORS, type CardColorKey } from "@/lib/card-colors";

interface Props {
  card: CardData;
  onClick?: () => void;
  overlay?: boolean;
}

export function CardItem({ card, onClick, overlay }: Props) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const colorKey = (card.color as CardColorKey) ?? "none";
  const color = CARD_COLORS[colorKey] ?? CARD_COLORS.none;
  const hasColor = colorKey !== "none";

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const isOverdue = now && dueDate && dueDate < now && !card.isDone;

  // A TipTap doc is empty when it has no content or only empty paragraphs
  const hasDescription = (() => {
    const doc = card.description as { content?: { content?: unknown[] }[] } | null;
    return doc?.content?.some((node) => (node.content?.length ?? 0) > 0) ?? false;
  })();

  return (
    <div
      ref={!overlay ? setNodeRef : undefined}
      style={!overlay ? style : undefined}
      {...(!overlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2.5 shadow-sm cursor-pointer select-none transition-colors",
        hasColor ? color.bg : "bg-white dark:bg-gray-800",
        "ring-1 ring-transparent hover:ring-blue-300 dark:hover:ring-blue-500",
        overlay && "ring-blue-300 rotate-1 shadow-lg",
        card.isDone && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {hasColor && (
          <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", color.dot)} />
        )}
        <p className={cn(
          "text-sm leading-snug",
          card.isDone
            ? "line-through text-gray-400 dark:text-gray-500"
            : "text-gray-800 dark:text-gray-100",
        )}>
          {card.title}
        </p>
      </div>
      {(dueDate || hasDescription || card._count.subtasks > 0 || card.assignee) && (
        <div className="flex items-center gap-2 mt-1.5">
          {hasDescription && (
            <span className="text-xs text-gray-400 dark:text-gray-500" title="Tiene descripción">≡</span>
          )}
          {dueDate && (
            <span className={cn(
              "text-xs",
              isOverdue ? "text-red-500 font-medium" : "text-gray-400 dark:text-gray-500",
            )}>
              {dueDate.toLocaleDateString("es", { month: "short", day: "numeric" })}
            </span>
          )}
          {card._count.subtasks > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">☑ {card._count.subtasks}</span>
          )}
          {card.assignee && (
            <span
              className="ml-auto w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
              title={card.assignee.name ?? ""}
            >
              {(card.assignee.name ?? "?")[0].toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
