"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateMifrasPage } from "@/lib/mifras-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  Image as ImageIcon, List, ListOrdered, Heading2, Heading3,
  AlignRight, AlignCenter, AlignLeft, Eye, EyeOff, ArrowRight,
} from "lucide-react";
import NextLink from "next/link";

interface MifrasPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  order: number;
}

export function MifrasEditor({ page, allPages }: {
  page: MifrasPage;
  allPages: { id: string; title: string; parentId: string | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(page.title);
  const [isPublished, setIsPublished] = useState(page.isPublished);

  // allPages is available for future use (e.g. linking to other pages)
  void allPages;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TiptapImage.configure({ inline: false, allowBase64: true }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: page.content || "",
    editorProps: {
      attributes: {
        class: "min-h-[400px] p-4 focus:outline-none prose prose-sm max-w-none dark:prose-invert",
        dir: "rtl",
      },
    },
  });

  const addImage = useCallback(() => {
    const url = window.prompt("כתובת URL של התמונה:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt("כתובת URL:");
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  function handleSave() {
    if (!editor) return;
    startTransition(async () => {
      try {
        await updateMifrasPage(page.id, {
          title,
          content: editor.getHTML(),
          isPublished,
        });
        toast.success("העמוד נשמר");
        router.refresh();
      } catch {
        toast.error("שגיאה בשמירה");
      }
    });
  }

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, title: t, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={t}
      className={`p-1.5 rounded text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Back */}
      <div className="flex items-center gap-2">
        <NextLink href="/admin/mifras" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowRight className="h-3.5 w-3.5" />
          עמודי מפרש
        </NextLink>
      </div>

      {/* Title & settings */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-52">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-xl font-bold h-auto py-2 text-lg"
            placeholder="כותרת העמוד"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsPublished(!isPublished)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors ${isPublished ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20" : "border-muted text-muted-foreground"}`}
        >
          {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {isPublished ? "מפורסם" : "מוסתר"}
        </button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "שומר..." : "שמור"}
        </Button>
      </div>

      {/* Editor */}
      <div className="rounded-lg border overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="מודגש">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="נטוי">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="קו תחתי">
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="כותרת 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="כותרת 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="רשימה">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="רשימה ממוספרת">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="יישור ימין">
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="מרכז">
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="יישור שמאל">
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1" />

          <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="קישור">
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={addImage} title="תמונה">
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor area */}
        <EditorContent editor={editor} />
      </div>

      <p className="text-xs text-muted-foreground">
        כתובת העמוד: <span dir="ltr">/mifras/{page.slug}</span>
      </p>
    </div>
  );
}
