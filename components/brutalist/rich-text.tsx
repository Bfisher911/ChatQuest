"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { cx } from "@/lib/utils/cx";
import { uploadNodeFile } from "@/lib/path/file-actions";
import { toast } from "sonner";

/**
 * Brutalist rich-text editor backed by TipTap.
 * Hands the parent the rendered HTML on every change.
 *
 * Pass `imageUploadContext` to expose an "IMG" toolbar button that uploads
 * the selected file to the node-files bucket and inserts the signed URL.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  minHeight = 220,
  imageUploadContext,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  imageUploadContext?: { programId: string; nodeId: string };
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "cq-richtext",
        style: `min-height:${minHeight}px;outline:none;padding:14px;font-family:var(--font-sans);font-size:15px;line-height:1.55;`,
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep editor in sync when value changes externally (e.g. switching nodes).
  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== (value || "")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        style={{
          border: "var(--hair) solid var(--ink)",
          minHeight,
          padding: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        Loading editor…
      </div>
    );
  }

  return (
    <div style={{ border: "var(--hair) solid var(--ink)" }}>
      <EditorToolbar editor={editor} imageUploadContext={imageUploadContext} />
      <EditorContent
        editor={editor}
        placeholder={placeholder}
        style={{ borderTop: "var(--hair) solid var(--ink)" }}
      />
    </div>
  );
}

function EditorToolbar({
  editor,
  imageUploadContext,
}: {
  editor: Editor;
  imageUploadContext?: { programId: string; nodeId: string };
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onPickImage(file: File) {
    if (!imageUploadContext) return;
    const fd = new FormData();
    fd.set("programId", imageUploadContext.programId);
    fd.set("nodeId", imageUploadContext.nodeId);
    fd.set("file", file);
    const res = await uploadNodeFile(fd);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!res.signedUrl) {
      toast.error("Upload succeeded but no signed URL returned.");
      return;
    }
    editor.chain().focus().setImage({ src: res.signedUrl, alt: file.name }).run();
    toast.success("Image inserted.");
  }

  const ToolBtn = ({
    isActive,
    onClick,
    children,
    title,
  }: {
    isActive?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx("cq-icon-btn")}
      style={{
        background: isActive ? "var(--ink)" : "var(--paper)",
        color: isActive ? "var(--paper)" : "var(--ink)",
        width: "auto",
        padding: "0 10px",
        height: 30,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="row" style={{ gap: 4, padding: 8, flexWrap: "wrap" }}>
      <ToolBtn title="Bold" isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolBtn>
      <ToolBtn title="Italic" isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolBtn>
      <ToolBtn title="Strikethrough" isActive={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolBtn>
      <ToolBtn title="Heading 2" isActive={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
      <ToolBtn title="Heading 3" isActive={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>
      <ToolBtn title="Bullet list" isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolBtn>
      <ToolBtn title="Numbered list" isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolBtn>
      <ToolBtn title="Quote" isActive={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</ToolBtn>
      <ToolBtn title="Code block" isActive={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"</>"}</ToolBtn>
      <ToolBtn
        title="Link"
        isActive={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href;
          const url = window.prompt("URL", prev || "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        ↗
      </ToolBtn>
      {imageUploadContext ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void onPickImage(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <ToolBtn title="Insert image" onClick={() => fileRef.current?.click()}>IMG</ToolBtn>
        </>
      ) : null}
      <span style={{ flex: 1 }} />
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</ToolBtn>
    </div>
  );
}
