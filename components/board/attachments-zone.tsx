"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  name: string;
  createdAt: string;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function fileTypeInfo(mimeType: string): { label: string; bg: string; text: string } {
  if (mimeType.startsWith("image/"))        return { label: "IMG",  bg: "bg-gray-200 dark:bg-gray-700",      text: "text-gray-500" };
  if (mimeType === "application/pdf")        return { label: "PDF",  bg: "bg-red-100 dark:bg-red-900/50",     text: "text-red-600 dark:text-red-400" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "application/vnd.ms-excel")
                                             return { label: "XLS",  bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-400" };
  if (mimeType.includes("word") || mimeType === "application/msword")
                                             return { label: "DOC",  bg: "bg-blue-100 dark:bg-blue-900/50",   text: "text-blue-700 dark:text-blue-400" };
  return                                            { label: "FILE", bg: "bg-gray-100 dark:bg-gray-800",      text: "text-gray-500" };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props { cardId: string }

export function AttachmentsZone({ cardId }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);

  // Ref so the paste listener always sees the latest value without re-registering
  const isFocusedRef = useRef(false);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["attachments", cardId],
    queryFn: () => fetch(`/api/cards/${cardId}/attachments`).then((r) => r.json()),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/cards/${cardId}/attachments`, { method: "POST", body: form });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Error al subir" }));
        throw new Error(error);
      }
      return res.json() as Promise<Attachment>;
    },
    onSuccess: (att) => {
      qc.setQueryData<Attachment[]>(["attachments", cardId], (prev) => [...(prev ?? []), att]);
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: string) => fetch(`/api/attachments/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<Attachment[]>(["attachments", cardId], (prev) => prev?.filter((a) => a.id !== id) ?? []);
    },
  });

  const uploadFiles = useCallback(async (files: File[]) => {
    const valid = files.filter((f) => ALLOWED_TYPES.has(f.type));
    if (!valid.length) return;
    setPendingUploads((n) => n + valid.length);
    await Promise.allSettled(
      valid.map((f) => upload.mutateAsync(f).finally(() => setPendingUploads((n) => n - 1)))
    );
  }, [upload]);

  // Paste listener — only fires when the zone has focus
  const uploadFilesRef = useRef(uploadFiles);
  useEffect(() => { uploadFilesRef.current = uploadFiles; }, [uploadFiles]);
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!isFocusedRef.current) return;
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && ALLOWED_TYPES.has(item.type))
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];
      if (files.length > 0) uploadFilesRef.current(files);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(Array.from(e.dataTransfer.files));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      uploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  // Clicking the zone (but not the file-select button) gives focus for paste
  function handleZoneClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-file-btn]")) return;
    zoneRef.current?.focus();
  }

  function handleBlur(e: React.FocusEvent) {
    // Only lose focus when the new target is outside this component entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  }

  const isUploading = pendingUploads > 0;

  return (
    <div>
      {/* Drop / paste zone */}
      <div
        ref={zoneRef}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onClick={handleZoneClick}
        onKeyDown={(e) => { if (e.key === "Escape") { setIsFocused(false); zoneRef.current?.blur(); } }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all select-none outline-none",
          isUploading
            ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 cursor-default"
            : isDragging
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20 cursor-copy"
              : isFocused
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-400/30 cursor-default"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 cursor-default",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.xls,.xlsx,.doc,.docx,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileInput}
        />

        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 py-1">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
            </svg>
            <span className="text-sm font-medium">Subiendo {pendingUploads} archivo{pendingUploads > 1 ? "s" : ""}…</span>
          </div>
        ) : isDragging ? (
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 py-1">Suelta aquí</p>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            {/* Focus state badge */}
            {isFocused && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Listo para pegar · Esc para salir
              </span>
            )}

            {/* Instructional text */}
            <div>
              <p className={cn(
                "text-sm font-medium",
                isFocused
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-gray-500 dark:text-gray-400",
              )}>
                {isFocused
                  ? "Pega con Ctrl+V o arrastra archivos aquí"
                  : "Arrastra archivos aquí o haz clic en el área para activar Ctrl+V"}
              </p>
              {!isFocused && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Imágenes, PDF, Excel, Word · Máx 20 MB
                </p>
              )}
            </div>

            {/* File picker button — always centered, opens browser picker */}
            <button
              type="button"
              data-file-btn
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Seleccionar archivos
            </button>
          </div>
        )}
      </div>

      {/* Thumbnails grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith("image/");
            const typeInfo = fileTypeInfo(att.mimeType);
            return (
              <div key={att.id} className="group relative">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isImage ? (
                    <img src={att.url} alt={att.name} className="w-full h-16 object-cover" />
                  ) : (
                    <div className={cn("w-full h-16 flex flex-col items-center justify-center gap-1 rounded-lg", typeInfo.bg)}>
                      <span className={cn("text-xs font-bold tracking-wider", typeInfo.text)}>{typeInfo.label}</span>
                    </div>
                  )}
                </a>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5 px-0.5" title={att.name}>
                  {att.name || typeInfo.label}
                </p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 px-0.5">{formatSize(att.size)}</p>

                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteAttachment.mutate(att.id); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-600"
                  title="Eliminar adjunto"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
