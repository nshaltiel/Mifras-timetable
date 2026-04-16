"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createMifrasPage, deleteMifrasPage } from "@/lib/mifras-actions";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MifrasPageFlat {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  isPublished: boolean;
  order: number;
}

interface MifrasPage extends MifrasPageFlat {
  children: MifrasPageFlat[];
}

export function MifrasAdminClient({ pages }: { pages: MifrasPage[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newPage, setNewPage] = useState<{ title: string; slug: string; parentId: string | null }>({ title: "", slug: "", parentId: null });

  const topLevelPages = pages.filter(p => !p.parentId);

  function autoSlug(title: string) {
    return title.trim().toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[א-ת]/g, (c) => {
        const map: Record<string, string> = { 'א':'a','ב':'b','ג':'g','ד':'d','ה':'h','ו':'v','ז':'z','ח':'ch','ט':'t','י':'y','כ':'k','ל':'l','מ':'m','נ':'n','ס':'s','ע':'a','פ':'p','צ':'tz','ק':'k','ר':'r','ש':'sh','ת':'t','ך':'k','ם':'m','ן':'n','ף':'p','ץ':'tz' };
        return map[c] || c;
      })
      .replace(/[^a-z0-9-]/g, "");
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        await createMifrasPage({
          title: newPage.title,
          slug: newPage.slug || autoSlug(newPage.title),
          parentId: newPage.parentId || null,
        });
        toast.success("העמוד נוצר");
        setCreateOpen(false);
        setNewPage({ title: "", slug: "", parentId: null });
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`למחוק את "${title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteMifrasPage(id);
        toast.success("העמוד נמחק");
        router.refresh();
      } catch {
        toast.error("שגיאה במחיקה");
      }
    });
  }

  function renderPageCard(page: MifrasPageFlat, depth = 0) {
    return (
      <Card key={page.id} className={depth > 0 ? "border-border/50" : ""}>
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center gap-3">
            {depth > 0 && <span className="text-muted-foreground text-xs">↳</span>}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{page.title}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">/{page.slug}</span>
                {!page.isPublished && <Badge variant="outline" className="text-xs">מוסתר</Badge>}
              </div>
            </div>
            <div className="flex gap-1">
              <Link href={`/admin/mifras/${page.id}/edit`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(page.id, page.title)} disabled={isPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderPage(page: MifrasPage) {
    return (
      <div key={page.id}>
        {renderPageCard(page, 0)}
        {page.children?.length > 0 && (
          <div className="ms-4 mt-1 space-y-1">
            {page.children.map(child => renderPageCard(child, 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">עמודי מפרש</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          עמוד חדש
        </Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>אין עמודים עדיין. לחץ על &quot;עמוד חדש&quot; כדי להתחיל.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {topLevelPages.map(page => renderPage(page))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>עמוד חדש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>כותרת *</Label>
              <Input value={newPage.title} onChange={e => {
                const title = e.target.value;
                setNewPage(p => ({ ...p, title, slug: p.slug || autoSlug(title) }));
              }} placeholder="למשל: תנאי שימוש" />
            </div>
            <div className="space-y-1">
              <Label>Slug (כתובת)</Label>
              <Input dir="ltr" value={newPage.slug}
                onChange={e => setNewPage(p => ({ ...p, slug: e.target.value }))}
                placeholder="terms-of-use" />
            </div>
            <div className="space-y-1">
              <Label>עמוד אב (אופציונלי)</Label>
              <Select value={newPage.parentId ?? ""} onValueChange={v => setNewPage(p => ({ ...p, parentId: v === "none" ? null : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="ללא (עמוד ראשי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא (עמוד ראשי)</SelectItem>
                  {topLevelPages.map(tp => (
                    <SelectItem key={tp.id} value={tp.id}>{tp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!newPage.title || isPending}>צור עמוד</Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
