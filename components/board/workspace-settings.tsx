"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_BG, GRADIENT_PRESETS, SOLID_PRESETS } from "@/lib/board-backgrounds";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member { id: string; name: string | null; email: string; role: string }
type ColumnWidth = "sm" | "md" | "lg";
interface WorkspaceSummary { id: string; name: string; visibility: string; publicToken: string | null; columnWidth: ColumnWidth; boardBackground: string }

interface Props {
  workspaceId: string;
  onClose: () => void;
}

const ROLES = ["viewer", "editor", "owner"] as const;
type Role = typeof ROLES[number];

export function WorkspaceSettings({ workspaceId, onClose }: Props) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const { data: members = [], isLoading: loadingMembers } = useQuery<Member[]>({
    queryKey: ["members", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/members`).then((r) => r.json()),
  });

  const { data: workspace } = useQuery<WorkspaceSummary>({
    queryKey: ["workspace-meta", workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
  });

  const invite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: Role }) =>
      fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        return data;
      }),
    onSuccess: (member) => {
      qc.setQueryData<Member[]>(["members", workspaceId], (prev) => [...(prev ?? []), member]);
      setInviteEmail("");
      toast.success("Miembro agregado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_, { userId, role }) => {
      qc.setQueryData<Member[]>(["members", workspaceId], (prev) =>
        prev?.map((m) => m.id === userId ? { ...m, role } : m),
      );
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_, userId) => {
      qc.setQueryData<Member[]>(["members", workspaceId], (prev) => prev?.filter((m) => m.id !== userId));
      toast.success("Miembro eliminado");
    },
  });

  const setColumnWidth = useMutation({
    mutationFn: (columnWidth: ColumnWidth) =>
      fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnWidth }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<WorkspaceSummary>(["workspace-meta", workspaceId], updated);
      // Sync the board cache so columns resize immediately
      qc.setQueryData(["workspace", workspaceId], (prev: { columnWidth?: string } | undefined) =>
        prev ? { ...prev, columnWidth: updated.columnWidth } : prev,
      );
    },
  });

  const setBoardBackground = useMutation({
    mutationFn: (boardBackground: string) =>
      fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardBackground }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<WorkspaceSummary>(["workspace-meta", workspaceId], updated);
      qc.setQueryData(["workspace", workspaceId], (prev: { boardBackground?: string } | undefined) =>
        prev ? { ...prev, boardBackground: updated.boardBackground } : prev,
      );
    },
  });

  const setVisibility = useMutation({
    mutationFn: (visibility: "private" | "public") =>
      fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<WorkspaceSummary>(["workspace-meta", workspaceId], updated);
      toast.success(updated.visibility === "public" ? "Ahora es público" : "Ahora es privado");
    },
  });

  const publicUrl = workspace?.publicToken ? `${origin}/p/${workspace.publicToken}` : null;

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isPublic = workspace?.visibility === "public";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[90vw] sm:max-w-lg bg-white dark:bg-gray-900 gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuración del espacio
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] px-6 py-5 space-y-6">

          {/* Board background */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Fondo del tablero</p>

            {/* Live preview strip */}
            <div
              className="w-full h-14 rounded-xl mb-4 shadow-inner transition-all duration-300 flex items-center justify-center"
              style={{ background: workspace?.boardBackground || DEFAULT_BG }}
            >
              <span className="text-white/70 text-xs font-medium drop-shadow">Vista previa</span>
            </div>

            {/* Gradients */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">Gradientes</p>
            <div className="grid grid-cols-6 gap-1.5 mb-4">
              {GRADIENT_PRESETS.map((preset) => {
                const active = workspace?.boardBackground === preset.value;
                return (
                  <button
                    key={preset.value}
                    title={preset.label}
                    onClick={() => setBoardBackground.mutate(preset.value)}
                    className={cn(
                      "h-8 rounded-lg transition-all hover:scale-105",
                      active ? "ring-2 ring-offset-2 ring-white dark:ring-offset-gray-900 scale-105" : "",
                    )}
                    style={{ background: preset.value }}
                  />
                );
              })}
            </div>

            {/* Solid colors */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">Sólidos</p>
            <div className="grid grid-cols-8 gap-1.5 mb-3">
              {SOLID_PRESETS.map((preset) => {
                const active = workspace?.boardBackground === preset.value;
                return (
                  <button
                    key={preset.value}
                    title={preset.label}
                    onClick={() => setBoardBackground.mutate(preset.value)}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all hover:scale-110",
                      active ? "ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-300 dark:ring-offset-gray-900 scale-110" : "",
                    )}
                    style={{ background: preset.value }}
                  />
                );
              })}

              {/* Custom color picker */}
              <label
                title="Color personalizado"
                className="h-7 w-7 rounded-full cursor-pointer transition-all hover:scale-110 relative overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gradient-to-br from-red-400 via-green-400 to-blue-400"
              >
                <span className="text-white text-[10px] font-bold drop-shadow leading-none">+</span>
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  value={
                    workspace?.boardBackground?.startsWith("#") && workspace.boardBackground.length === 7
                      ? workspace.boardBackground
                      : "#2563eb"
                  }
                  onChange={(e) => setBoardBackground.mutate(e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Column width */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Ancho de columnas</p>
            <div className="flex gap-2">
              {(["sm", "md", "lg"] as ColumnWidth[]).map((w) => {
                const labels: Record<ColumnWidth, string> = { sm: "Pequeño", md: "Mediano", lg: "Grande" };
                const widths: Record<ColumnWidth, string> = { sm: "256 px", md: "320 px", lg: "384 px" };
                const active = (workspace?.columnWidth ?? "sm") === w;
                return (
                  <button
                    key={w}
                    onClick={() => setColumnWidth.mutate(w)}
                    disabled={setColumnWidth.isPending}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-colors",
                      active
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                    )}
                  >
                    {/* Mini preview of column width */}
                    <div className="flex gap-0.5 items-end h-6">
                      {[0.4, 0.65, 1].map((scale, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-sm transition-all",
                            active ? "bg-blue-400 dark:bg-blue-500" : "bg-gray-300 dark:bg-gray-600",
                          )}
                          style={{
                            width: `${(w === "sm" ? 8 : w === "md" ? 11 : 14) * (i === 0 ? 0.5 : i === 1 ? 0.75 : 1)}px`,
                            height: `${12 + i * 4}px`,
                          }}
                        />
                      ))}
                    </div>
                    <span className={cn("text-sm font-semibold", active ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400")}>
                      {labels[w]}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600">{widths[w]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Visibility */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Visibilidad</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setVisibility.mutate(isPublic ? "private" : "public")}
                disabled={setVisibility.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span className={`inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {isPublic ? "Público — cualquiera con el enlace puede ver" : "Privado — solo miembros invitados"}
              </span>
            </div>

            {isPublic && publicUrl && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 font-mono truncate"
                />
                <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? "¡Copiado!" : "Copiar"}
                </Button>
              </div>
            )}
          </section>

          {/* Members */}
          <section>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Miembros</p>

            {loadingMembers ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : (
              <div className="space-y-1 mb-4">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group">
                    <span className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-semibold shrink-0">
                      {(m.name ?? m.email)[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.name ?? m.email}</p>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                    {m.role === "owner" ? (
                      <span className="text-xs text-amber-500 font-medium shrink-0">owner</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={m.role}
                          onChange={(e) => changeRole.mutate({ userId: m.id, role: e.target.value as Role })}
                          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        >
                          <option value="viewer">viewer</option>
                          <option value="editor">editor</option>
                          <option value="owner">owner</option>
                        </select>
                        <button
                          onClick={() => { if (confirm(`¿Eliminar a ${m.name ?? m.email}?`)) removeMember.mutate(m.id); }}
                          className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar miembro"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Invite */}
            <div className="flex gap-2">
              <Input
                placeholder="Email del usuario…"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inviteEmail.trim() && invite.mutate({ email: inviteEmail, role: inviteRole })}
                className="h-9 text-sm flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 h-9"
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="owner">owner</option>
              </select>
              <Button
                size="sm"
                className="h-9 shrink-0"
                onClick={() => inviteEmail.trim() && invite.mutate({ email: inviteEmail, role: inviteRole })}
                disabled={!inviteEmail.trim() || invite.isPending}
              >
                Invitar
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
