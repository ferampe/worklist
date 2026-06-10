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
import { AttachmentsZone } from "./attachments-zone";
import { CARD_COLORS, COLOR_KEYS, type CardColorKey } from "@/lib/card-colors";
import type { WorkspaceData } from "@/app/w/[id]/board-client";

interface Subtask { id: string; text: string; isDone: boolean; position: number }
interface Member { id: string; name: string | null; email: string; image: string | null; role: string }
interface CardDetail {
  id: string; columnId: string; title: string; description: unknown; color: string;
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
  const [cardColor, setCardColor] = useState<CardColorKey>("none");
  const [calOpen, setCalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setCardColor((card.color as CardColorKey) ?? "none");
      setSubtasks(card.subtasks ?? []);
    }
  }, [card]);

  function syncBoard(patch: object) {
    qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
      prev ? {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c.id === cardId ? { ...c, ...patch } : c),
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
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      fetch(`/api/subtasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone }),
      }).then((r) => r.json()),
    onSuccess: (updated) => setSubtasks((prev) => prev.map((s) => s.id === updated.id ? updated : s)),
  });

  const deleteSubtask = useMutation({
    mutationFn: (id: string) => fetch(`/api/subtasks/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => setSubtasks((prev) => prev.filter((s) => s.id !== id)),
  });

  const archiveCard = useMutation({
    mutationFn: () =>
      fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
        } : prev
      );
      onClose();
      toast.success("Tarjeta archivada");
    },
  });

  const deleteCard = useMutation({
    mutationFn: () => fetch(`/api/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<WorkspaceData>(["workspace", workspaceId], (prev) =>
        prev ? {
          ...prev,
          columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
        } : prev
      );
      onClose();
      toast.success("Tarjeta eliminada");
    },
  });

  function save() {
    updateCard.mutate({ title, description, isDone, dueDate: dueDate ? dueDate.toISOString() : null, assigneeId, color: cardColor });
  }

  const doneCount = subtasks.filter((s) => s.isDone).length;
  const isOverdue = dueDate && dueDate < new Date() && !isDone; // solo se usa client-side, sin SSR risk
  const assignee = members.find((m) => m.id === assigneeId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="w-[90vw] sm:max-w-5xl max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0 bg-white dark:bg-gray-900"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-7 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <input
            type="checkbox"
            checked={isDone}
            onChange={(e) => { setIsDone(e.target.checked); updateCard.mutate({ isDone: e.target.checked }); }}
            className="w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
          />
          <input
            className={`flex-1 text-xl font-semibold outline-none bg-transparent border-b border-transparent focus:border-blue-400 pb-0.5 transition-colors
              ${isDone ? "line-through text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-gray-50"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Título de la tarjeta"
          />
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 text-xl leading-none ml-2 cursor-pointer transition-colors"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 py-16">Cargando…</div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ── Left: main content ── */}
            <div className="flex-1 overflow-y-auto px-7 py-5 min-w-0 space-y-5">

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Descripción</p>
                <div className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                  <RichEditor content={description} onChange={setDescription} onBlur={save} />
                </div>
              </div>

              {/* Attachments */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Adjuntos</p>
                <AttachmentsZone cardId={cardId} />
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Subtareas</p>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{doneCount}/{subtasks.length}</span>
                  )}
                </div>

                <div className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                  {subtasks.length > 0 && (
                    <div className="px-3 pt-3 pb-2">
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                        />
                      </div>
                      <div className="space-y-0.5">
                        {subtasks.map((st) => (
                          <div key={st.id} className="flex items-center gap-3 group/st py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <input
                              type="checkbox"
                              checked={st.isDone}
                              onChange={(e) => toggleSubtask.mutate({ id: st.id, isDone: e.target.checked })}
                              className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                            />
                            <span className={`flex-1 text-sm ${st.isDone ? "line-through text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-200"}`}>
                              {st.text}
                            </span>
                            <button
                              onClick={() => deleteSubtask.mutate(st.id)}
                              className="opacity-0 group-hover/st:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm transition-all cursor-pointer"
                              aria-label="Eliminar subtarea"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={`flex gap-2 p-3 ${subtasks.length > 0 ? "border-t border-gray-200 dark:border-gray-700" : ""}`}>
                    <Input
                      placeholder="Nueva subtarea… (Enter para agregar)"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newSubtask.trim() && addSubtask.mutate(newSubtask)}
                      className="h-8 text-sm border-gray-300 dark:border-gray-600"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 shrink-0 border-gray-300 dark:border-gray-600 cursor-pointer"
                      onClick={() => newSubtask.trim() && addSubtask.mutate(newSubtask)}
                      disabled={!newSubtask.trim() || addSubtask.isPending}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: metadata sidebar ── */}
            <div className="w-64 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-5 overflow-y-auto space-y-4">

              {/* Color picker */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2.5">Color</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_KEYS.map((key) => {
                    const c = CARD_COLORS[key];
                    const isSelected = cardColor === key;
                    return (
                      <button
                        key={key}
                        title={c.label}
                        onClick={() => {
                          setCardColor(key);
                          updateCard.mutate({ color: key });
                        }}
                        className={`w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer ${c.dot} ${
                          isSelected
                            ? "ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-300 dark:ring-offset-gray-900 scale-110"
                            : "hover:scale-110 opacity-70 hover:opacity-100"
                        }`}
                      >
                        {isSelected && (
                          <span className="text-white text-xs font-bold drop-shadow">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due date */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2.5">Vencimiento</p>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border-2 transition-colors font-medium cursor-pointer ${
                      dueDate
                        ? isOverdue
                          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950/50 dark:text-red-400"
                          : "border-gray-300 bg-gray-50 text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        : "border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-blue-400 hover:text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {dueDate
                      ? `${isOverdue ? "⚠ " : "📅 "}${format(dueDate, "d 'de' MMMM yyyy", { locale: es })}`
                      : "📅 Añadir fecha"}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => {
                        setDueDate(d);
                        setCalOpen(false);
                        updateCard.mutate({ dueDate: d ? d.toISOString() : null });
                      }}
                    />
                    {dueDate && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <button
                          className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                          onClick={() => {
                            setDueDate(undefined);
                            setCalOpen(false);
                            updateCard.mutate({ dueDate: null });
                          }}
                        >
                          Quitar fecha
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignee */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2.5">Asignado</p>
                {assignee && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-50 border border-blue-200 mb-2 dark:bg-blue-950/40 dark:border-blue-700">
                    <span className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-semibold shrink-0">
                      {(assignee.name ?? assignee.email)[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{assignee.name ?? assignee.email}</p>
                      <p className="text-xs text-blue-500 dark:text-blue-400 truncate capitalize">{assignee.role}</p>
                    </div>
                    <button
                      onClick={() => { setAssigneeId(null); updateCard.mutate({ assigneeId: null }); }}
                      className="w-6 h-6 flex items-center justify-center rounded text-blue-300 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm cursor-pointer transition-colors shrink-0"
                      aria-label="Quitar asignado"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="space-y-0.5">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        const next = assigneeId === m.id ? null : m.id;
                        setAssigneeId(next);
                        updateCard.mutate({ assigneeId: next });
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                        assigneeId === m.id
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium shrink-0 ${
                        assigneeId === m.id ? "bg-blue-500" : "bg-gray-400 dark:bg-gray-500"
                      }`}>
                        {(m.name ?? m.email)[0].toUpperCase()}
                      </span>
                      <span className="truncate text-sm">{m.name ?? m.email}</span>
                      {assigneeId === m.id && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                    </button>
                  ))}
                  {members.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 py-1">Sin miembros</p>
                  )}
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm space-y-2">
                {!confirmDelete ? (
                  <>
                    <button
                      onClick={() => archiveCard.mutate()}
                      disabled={archiveCard.isPending}
                      className="w-full text-left text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      📦 Archivar tarjeta
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      🗑 Eliminar tarjeta
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-snug">
                      ¿Eliminar esta tarjeta? Esta acción no se puede deshacer.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => deleteCard.mutate()}
                        disabled={deleteCard.isPending}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {deleteCard.isPending ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {updateCard.isPending ? "Guardando…" : "Los cambios se guardan al hacer blur"}
          </p>
          <Button size="sm" onClick={save} disabled={updateCard.isPending}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
