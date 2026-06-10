"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, List, ListOrdered, Quote, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./rich-editor.css";

interface Props {
  content: unknown;
  onChange: (content: unknown) => void;
  onBlur?: () => void;
}

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5 self-center" />;
}

export function RichEditor({ content, onChange, onBlur }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Agrega una descripción…" }),
    ],
    content: (content as object) ?? "",
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onBlur: () => onBlur?.(),
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
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">

        {/* Formato de texto */}
        <ToolbarBtn title="Negrita (Ctrl+B)"     active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Cursiva (Ctrl+I)"     active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Subrayado (Ctrl+U)"   active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Tachado"              active={editor.isActive("strike")}    onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Código en línea"      active={editor.isActive("code")}      onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={14} strokeWidth={2.5} />
        </ToolbarBtn>

        <Divider />

        {/* Títulos */}
        <ToolbarBtn title="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} strokeWidth={2.5} />
        </ToolbarBtn>

        <Divider />

        {/* Listas */}
        <ToolbarBtn title="Lista con viñetas" active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Lista numerada"    active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} strokeWidth={2.5} />
        </ToolbarBtn>

        <Divider />

        {/* Extras */}
        <ToolbarBtn title="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Línea separadora" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={14} strokeWidth={2.5} />
        </ToolbarBtn>
      </div>

      <div className="cursor-text min-h-[140px]" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 focus-within:outline-none" />
      </div>
    </div>
  );
}
