"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import "./rich-editor.css";

interface Props {
  content: unknown;
  onChange: (content: unknown) => void;
  onBlur?: () => void;
}

export function RichEditor({ content, onChange, onBlur }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Agrega una descripción…" }),
    ],
    content: (content as object) ?? "",
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onBlur: () => onBlur?.(),
    editorProps: {
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            uploadImage(file).then((url) => {
              if (url) view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src: url })
              ));
            });
            return true;
          }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of files) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            uploadImage(file).then((url) => {
              if (url) {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (!coordinates) return;
                view.dispatch(view.state.tr.insert(
                  coordinates.pos,
                  schema.nodes.image.create({ src: url })
                ));
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const json = editor.getJSON();
    const incoming = JSON.stringify(content ?? "");
    if (JSON.stringify(json) !== incoming && content) {
      editor.commands.setContent(content as object);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rich-editor-wrapper">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-gray-100">
        {[
          { label: "B", title: "Negrita", action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
          { label: "I", title: "Cursiva", action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
          { label: "S̶", title: "Tachado", action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
          { label: "{ }", title: "Código", action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive("code") },
        ].map(({ label, title, action, active }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={action}
            className={`w-7 h-7 text-xs rounded font-mono transition-colors ${
              active ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {[
          { label: "H1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive("heading", { level: 1 }) },
          { label: "H2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
          { label: "≡", action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
          { label: "1.", action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
        ].map(({ label, action, active }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className={`w-7 h-7 text-xs rounded font-mono transition-colors ${
              active ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 min-h-[140px] focus-within:outline-none" />
    </div>
  );
}

async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) return null;
  const { url } = await res.json();
  return url;
}
