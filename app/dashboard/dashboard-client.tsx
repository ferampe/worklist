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

interface Workspace {
  id: string;
  name: string;
  role: string;
  _count: { columns: number };
  createdAt: string;
}

export function DashboardClient() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

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
      setOpen(false);
      setName("");
      toast.success("Espacio creado");
    },
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Mis espacios</h2>
        <Button onClick={() => setOpen(true)}>+ Nuevo espacio</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No tienes espacios aún.</p>
          <p className="text-sm mt-1">Crea el primero para empezar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/w/${ws.id}`}
              className="group block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                {ws.name}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {ws._count.columns} {ws._count.columns === 1 ? "columna" : "columnas"}
              </p>
              <span className="mt-3 inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                {ws.role}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo espacio de trabajo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nombre del espacio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate(name)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => create.mutate(name)}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
