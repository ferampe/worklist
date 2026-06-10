"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RichEditor } from "./rich-editor";
import type { WorkspaceData } from "@/app/w/[id]/board-client";

interface Subtask { id: string; text: string; isDone: boolean; position: number }
interface Member { id: string; name: string | null; email: string; image: string | null; role: string }
interface CardDetail {
  id: string; columnId: string; title: string; description: unknown;
  isDone: boolean; dueDate: string | null; assigneeId: string | null;
  subtasks: Subtask[];
}

interface Props { cardId: string; workspaceId: string; onClose: () => void }

export function CardModal({ cardId, workspaceId, onClose }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<unknown>(null);
  const [isDone, setIsDone] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [calOpen, setCalOpen] = useState(false);

  const { data: card, isLoading } = useQuery<CardDetail>({
    queryKey: ["card", cardId],
    queryFn: () => fetch(`/api/cards/${cardId}`).then((r) => r.json()),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/members`).then((r) => r.json()),
  });

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setIsDone(card.isDone);
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
      setAssigneeId(card.assigneeId);
      setSubtasks(card.subtasks ?? []);
    }
  }, [card]);

  function syncBoard(updated: Partial<CardDetail>) {
    qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
      prev ? {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c.id === cardId ? { ...c, ...updated } : c),
        })),
      } : prev
    );
  }

  const updateCard = useMutation({
    mutationFn: (data: object) =>
      fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData(["card", cardId], (prev: CardDetail) => ({ ...prev, ...updated }));
      syncBoard(updated);
      toast.success("Guardado");
    },
  });

  const addSubtask = useMutation({
    mutationFn: (text: string) =>
      fetch(`/api/cards/${cardId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then((r) => r.json()),
    onSuccess: (subtask) => {
      setSubtasks((prev) => [...prev, subtask]);
      setNewSubtask("");
      qc.setQueryData<CardDetail>(["card", cardId], (prev) =>
        prev ? { ...prev, subtasks: [...(prev.subtasks ?? []), subtask] } : prev
      );
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      fetch(`/api/subtasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      setSubtasks((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: (id: string) => fetch(`/api/subtasks/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => setSubtasks((prev) => prev.filter((s) => s.id !== id)),
  });

  const deleteCard = useMutation({
    mutationFn: () => fetch(`/api/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => {
      syncBoard({ id: cardId } as Partial<CardDetail>);
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col, cards: col.cards.filter((c) => c.id !== cardId),
          })),
        } : prev
      );
      onClose();
      toast.success("Tarjeta eliminada");
    },
  });

  function save() {
    updateCard.mutate({
      title, description, isDone,
      dueDate: dueDate ? dueDate.toISOString() : null,
      assigneeId,
    });
  }

  const doneCount = subtasks.filter((s) => s.isDone).length;
  const isOverdue = dueDate && dueDate < new Date() && !isDone;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
          <input
            type="checkbox"
            checked={isDone}
            onChange={(e) => { setIsDone(e.target.checked); updateCard.mutate({ isDone: e.target.checked }); }}
            className="mt-1.5 w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
          />
          <input
            className={`flex-1 text-xl font-semibold text-gray-900 outline-none bg-transparent border-b border-transparent focus:border-blue-400 pb-0.5 ${isDone ? "line-through text-gray-400" : ""}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 py-12">Cargando…</div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: description */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Descripción</p>
              <RichEditor content={description} onChange={setDescription} onBlur={save} />

              {/* Subtasks */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Subtareas {subtasks.length > 0 && <span className="text-gray-500 normal-case font-normal ml-1">{doneCount}/{subtasks.length}</span>}
                  </p>
                </div>

                {subtasks.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: subtasks.length ? `${(doneCount / subtasks.length) * 100}%` : "0%" }}
                      />
                    </div>
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 group/st py-0.5">
                        <input
                          type="checkbox"
                          checked={st.isDone}
                          onChange={(e) => toggleSubtask.mutate({ id: st.id, isDone: e.target.checked })}
                          className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer shrink-0"
                        />
                        <span className={`flex-1 text-sm ${st.isDone ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {st.text}
                        </span>
                        <button
                          onClick={() => deleteSubtask.mutate(st.id)}
                          className="opacity-0 group-hover/st:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva subtarea…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newSubtask.trim() && addSubtask.mutate(newSubtask)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => newSubtask.trim() && addSubtask.mutate(newSubtask)}
                    disabled={!newSubtask.trim()}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: metadata */}
            <div className="w-52 shrink-0 border-l border-gray-100 px-4 py-4 space-y-4 overflow-y-auto">

              {/* Due date */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Vencimiento</p>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger
                    className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
                      dueDate
                        ? isOverdue
                          ? "border-red-200 bg-red-50 text-red-600"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                        : "border-dashed border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {dueDate ? format(dueDate, "d MMM yyyy", { locale: es }) : "Sin fecha"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => { setDueDate(d); setCalOpen(false); }}
                      initialFocus
                    />
                    {dueDate && (
                      <div className="px-3 pb-3">
                        <button
                          className="text-xs text-gray-400 hover:text-red-500"
                          onClick={() => { setDueDate(undefined); setCalOpen(false); }}
                        >
                          Quitar fecha
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignee */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Asignado</p>
                <div className="space-y-1">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setAssigneeId(assigneeId === m.id ? null : m.id); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        assigneeId === m.id
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0 font-medium">
                        {(m.name ?? m.email)[0].toUpperCase()}
                      </span>
                      <span className="truncate text-xs">{m.name ?? m.email}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => { if (confirm("¿Eliminar esta tarjeta?")) deleteCard.mutate(); }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Eliminar tarjeta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-100">
          <Button size="sm" onClick={save} disabled={updateCard.isPending}>
            {updateCard.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
