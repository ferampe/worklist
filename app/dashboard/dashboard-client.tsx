"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Workspace {
  id: string;
  name: string;
  role: string;
  _count: { columns: number };
  createdAt: string;
}

export function DashboardClient() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null);
  const [renameName, setRenameName] = useState("");
  const [search, setSearch] = useState("");

  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => fetch("/api/workspaces").then((r) => r.json()),
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setCreateOpen(false);
      setNewName("");
      toast.success("Espacio creado");
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData<Workspace[]>(["workspaces"], (prev) =>
        prev?.map((w) => (w.id === updated.id ? { ...w, name: updated.name } : w))
      );
      setRenameTarget(null);
      toast.success("Espacio renombrado");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/workspaces/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<Workspace[]>(["workspaces"], (prev) =>
        prev?.filter((w) => w.id !== id)
      );
      toast.success("Espacio eliminado");
    },
  });

  const filtered = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900 shrink-0">Mis espacios</h2>
        <div className="flex items-center gap-3 flex-1 max-w-sm ml-auto">
          <Input
            placeholder="Buscar espacios…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            + Nuevo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {search ? (
            <p className="text-base">Sin resultados para &ldquo;{search}&rdquo;</p>
          ) : (
            <>
              <p className="text-lg">No tienes espacios aún.</p>
              <p className="text-sm mt-1">Crea el primero para empezar.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ws) => (
            <div key={ws.id} className="group relative bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all">
              <Link href={`/w/${ws.id}`} className="block p-5">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate pr-8">
                  {ws.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {ws._count.columns} {ws._count.columns === 1 ? "columna" : "columnas"}
                </p>
                <span className="mt-3 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                  {ws.role}
                </span>
              </Link>

              {ws.role === "owner" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
                    onClick={(e) => e.preventDefault()}
                  >
                    ···
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(ws);
                        setRenameName(ws.name);
                      }}
                    >
                      Renombrar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-500 focus:text-red-600"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${ws.name}"? Esto borrará todas las columnas y tarjetas.`))
                          remove.mutate(ws.id);
                      }}
                    >
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Crear workspace */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo espacio de trabajo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nombre del espacio"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && create.mutate(newName)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate(newName)} disabled={!newName.trim() || create.isPending}>
              {create.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renombrar workspace */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar espacio</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && renameName.trim() && renameTarget &&
              rename.mutate({ id: renameTarget.id, name: renameName })
            }
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => renameTarget && rename.mutate({ id: renameTarget.id, name: renameName })}
              disabled={!renameName.trim() || rename.isPending}
            >
              {rename.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
