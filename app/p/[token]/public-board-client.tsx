"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CARD_COLORS, type CardColorKey } from "@/lib/card-colors";
import type { WorkspaceData, CardData } from "@/app/w/[id]/board-client";

function PublicCard({ card }: { card: CardData }) {
  const colorKey = (card.color as CardColorKey) ?? "none";
  const color = CARD_COLORS[colorKey] ?? CARD_COLORS.none;
  const hasColor = colorKey !== "none";
  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && !card.isDone;

  const hasDescription = (() => {
    const doc = card.description as { content?: { content?: unknown[] }[] } | null;
    return doc?.content?.some((node) => (node.content?.length ?? 0) > 0) ?? false;
  })();

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 shadow-sm select-none",
        hasColor ? color.bg : "bg-white dark:bg-gray-800",
        "ring-1 ring-gray-200 dark:ring-gray-700",
        card.isDone && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {hasColor && <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", color.dot)} />}
        <p className={cn("text-sm leading-snug", card.isDone
          ? "line-through text-gray-400 dark:text-gray-500"
          : "text-gray-800 dark:text-gray-100")}>
          {card.title}
        </p>
      </div>
      {(dueDate || hasDescription || card._count.subtasks > 0 || card.assignee) && (
        <div className="flex items-center gap-2 mt-1.5">
          {hasDescription && <span className="text-xs text-gray-400 dark:text-gray-500">≡</span>}
          {dueDate && (
            <span className={cn("text-xs", isOverdue ? "text-red-500 font-medium" : "text-gray-400 dark:text-gray-500")}>
              {dueDate.toLocaleDateString("es", { month: "short", day: "numeric" })}
            </span>
          )}
          {card._count.subtasks > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">☑ {card._count.subtasks}</span>
          )}
          {card.assignee && (
            <span className="ml-auto w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0" title={card.assignee.name ?? ""}>
              {(card.assignee.name ?? "?")[0].toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PublicBoardClient({ token }: { token: string }) {
  const { data: workspace, isLoading, isError } = useQuery<WorkspaceData>({
    queryKey: ["public-board", token],
    queryFn: () => fetch(`/api/workspaces/public/${token}`).then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-600">
        <p className="text-blue-200">Cargando tablero…</p>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-600">
        <p className="text-blue-200">Este enlace no es válido o el tablero ya no es público.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-blue-600">
      <header className="flex items-center gap-4 px-6 py-3 bg-blue-700/50 text-white shrink-0">
        <h1 className="font-bold text-lg">{workspace.name}</h1>
        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full text-blue-100">Solo lectura</span>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
        <div className="flex gap-3 h-full items-start">
          {workspace.columns.map((col) => (
            <div key={col.id} className="shrink-0 w-64 flex flex-col max-h-full">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-t-xl">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{col.name}</span>
                <span className="text-xs text-gray-400 ml-2">{col.cards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 px-2 pb-2 space-y-2 min-h-[40px]">
                {col.cards.map((card) => (
                  <PublicCard key={card.id} card={card} />
                ))}
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-b-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
