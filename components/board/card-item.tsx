"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardData } from "@/app/w/[id]/board-client";

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

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && !card.isDone;

  return (
    <div
      ref={!overlay ? setNodeRef : undefined}
      style={!overlay ? style : undefined}
      {...(!overlay ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={`bg-white rounded-lg px-3 py-2.5 shadow-sm border border-transparent hover:border-blue-300 cursor-pointer select-none transition-colors ${
        overlay ? "shadow-lg rotate-1 border-blue-300" : ""
      } ${card.isDone ? "opacity-60" : ""}`}
    >
      <p className={`text-sm text-gray-800 leading-snug ${card.isDone ? "line-through text-gray-400" : ""}`}>
        {card.title}
      </p>
      {(dueDate || card._count.subtasks > 0) && (
        <div className="flex items-center gap-2 mt-1.5">
          {dueDate && (
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {dueDate.toLocaleDateString("es", { month: "short", day: "numeric" })}
            </span>
          )}
          {card._count.subtasks > 0 && (
            <span className="text-xs text-gray-400">☑ {card._count.subtasks}</span>
          )}
        </div>
      )}
    </div>
  );
}
