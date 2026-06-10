"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "./rich-editor";
import type { WorkspaceData } from "@/app/w/[id]/board-client";

interface CardDetail {
  id: string;
  columnId: string;
  title: string;
  description: unknown;
  isDone: boolean;
  dueDate: string | null;
}

interface Props {
  cardId: string;
  workspaceId: string;
  onClose: () => void;
}

export function CardModal({ cardId, workspaceId, onClose }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<unknown>(null);
  const [isDone, setIsDone] = useState(false);

  const { data: card, isLoading } = useQuery<CardDetail>({
    queryKey: ["card", cardId],
    queryFn: () => fetch(`/api/cards/${cardId}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setIsDone(card.isDone);
    }
  }, [card]);

  const update = useMutation({
    mutationFn: (data: Partial<CardDetail>) =>
      fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            cards: col.cards.map((c) => c.id === cardId ? { ...c, ...updated } : c),
          })),
        } : prev
      );
      qc.setQueryData(["card", cardId], updated);
      toast.success("Guardado");
    },
  });

  const deleteCard = useMutation({
    mutationFn: () => fetch(`/api/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            cards: col.cards.filter((c) => c.id !== cardId),
          })),
        } : prev
      );
      onClose();
      toast.success("Tarjeta eliminada");
    },
  });

  function save() {
    update.mutate({ title, description, isDone });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Editar tarjeta</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Cargando…</div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isDone}
                onChange={(e) => setIsDone(e.target.checked)}
                className="mt-1.5 w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
              />
              <input
                className={`flex-1 text-lg font-semibold text-gray-900 outline-none border-b border-transparent focus:border-blue-400 pb-0.5 bg-transparent ${
                  isDone ? "line-through text-gray-400" : ""
                }`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 mt-2">
              <RichEditor
                content={description}
                onChange={setDescription}
                onBlur={save}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => { if (confirm("¿Eliminar esta tarjeta?")) deleteCard.mutate(); }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Eliminar tarjeta
              </button>
              <Button size="sm" onClick={save} disabled={update.isPending}>
                {update.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
