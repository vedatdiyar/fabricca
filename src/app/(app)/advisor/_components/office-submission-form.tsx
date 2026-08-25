"use client";

import { useState, useMemo } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  BookOpen,
  Folder,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OutlineOption } from "../office-actions";

interface OfficeSubmissionFormProps {
  outlines: OutlineOption[];
  isSubmitting: boolean;
  onSubmit: (data: { outlineId: number; draftText: string }) => Promise<void>;
}

interface OutlineTreeGroup {
  parent: OutlineOption;
  hasChildren: boolean;
  children: OutlineOption[];
}

/**
 * Standardized draft submission workspace (Taslak Teslim Masası).
 * Implements strict 5-layer typography standards from UI_RULES.md.
 */
export function OfficeSubmissionForm({
  outlines,
  isSubmitting,
  onSubmit,
}: OfficeSubmissionFormProps) {
  // Build hierarchical outline tree
  const outlineTree = useMemo<OutlineTreeGroup[]>(() => {
    const rootOutlines = outlines
      .filter((o) => !o.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const childrenMap = new Map<number, OutlineOption[]>();
    outlines.forEach((o) => {
      if (o.parentId) {
        const list = childrenMap.get(o.parentId) || [];
        list.push(o);
        childrenMap.set(o.parentId, list);
      }
    });

    return rootOutlines.map((root) => {
      const children = (childrenMap.get(root.id) || []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      return {
        parent: root,
        hasChildren: children.length > 0,
        children,
      };
    });
  }, [outlines]);

  // Find the first valid selectable outline
  const defaultSelectableId = useMemo(() => {
    for (const group of outlineTree) {
      if (group.hasChildren && group.children.length > 0) {
        return String(group.children[0].id);
      }
      if (!group.hasChildren) {
        return String(group.parent.id);
      }
    }
    // Fallback if only orphans exist
    return outlines[0]?.id ? String(outlines[0].id) : "";
  }, [outlineTree, outlines]);

  const [selectedOutlineId, setSelectedOutlineId] = useState<string>("");
  const [draftText, setDraftText] = useState("");

  // Derived effective ID to avoid cascading setState in effect
  const activeOutlineId = selectedOutlineId || defaultSelectableId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlineId || !draftText.trim()) return;

    await onSubmit({
      outlineId: Number(activeOutlineId),
      draftText: draftText.trim(),
    });
  };

  const trimmedDraft = draftText.trim();
  const wordCount = trimmedDraft ? trimmedDraft.split(/\s+/).length : 0;

  // Single standard metric: 150–600 words
  const isOptimalLength = wordCount >= 60 && wordCount <= 600;
  const isLongLength = wordCount > 600;
  const isShortLength = wordCount > 0 && wordCount < 60;

  return (
    <Card className="flex h-full w-full flex-col min-h-0 space-y-4 rounded-lg p-5 bg-card border-border shadow-xs">
      {/* Header */}
      <CardHeader className="p-0 pb-3.5 border-b border-border space-y-0 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary shrink-0">
              <PenLine className="size-4" />
            </div>
            <div>
              <CardTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
                Taslak Teslim Masası
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5 font-sans leading-normal">
                İlgili tez bölümünü seçin ve Word pasajınızı yapıştırın.
              </p>
            </div>
          </div>

          {/* Unified Word Counter Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`text-xs font-mono px-3 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                isOptimalLength
                  ? "bg-primary/10 text-primary border-primary/20"
                  : isLongLength
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <span>{wordCount} / 600 kelime</span>
              {isOptimalLength && (
                <span className="text-xs opacity-80">(İdeal Boyut)</span>
              )}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Form Content */}
      <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex-1 min-h-0 flex flex-col justify-between"
        >
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            {/* Hierarchical Outline Selector */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="outline-selector"
                  className="text-xs font-medium text-foreground"
                >
                  İnceleme Yapılacak Tez Bölümü
                </Label>
                <span className="text-xs text-muted-foreground">Zorunlu</span>
              </div>
              <Select
                value={activeOutlineId}
                onValueChange={setSelectedOutlineId}
              >
                <SelectTrigger
                  id="outline-selector"
                  disabled={isSubmitting}
                  className="w-full h-8 text-xs bg-background border-border rounded-md px-3"
                >
                  <SelectValue placeholder="Bir alt bölüm seçin..." />
                </SelectTrigger>
                <SelectContent className="max-h-[340px]">
                  {outlines.length === 0 ? (
                    <SelectItem value="empty" disabled className="text-xs">
                      Tanımlı tez bölümü bulunamadı
                    </SelectItem>
                  ) : (
                    outlineTree.map((group) => {
                      // Case A: Parent chapter with subsections
                      if (group.hasChildren) {
                        return (
                          <SelectGroup
                            key={group.parent.id}
                            className="my-1 border-b border-border/40 pb-1 last:border-b-0 last:pb-0"
                          >
                            <SelectLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-2.5 py-1 bg-muted/40 rounded-xs select-none">
                              <Folder className="size-3.5 text-primary/80 shrink-0" />
                              <span className="truncate">
                                {group.parent.title}
                              </span>
                              <span className="text-xs text-muted-foreground/70 font-normal ml-auto shrink-0">
                                (Ana Bölüm)
                              </span>
                            </SelectLabel>

                            {group.children.map((child) => (
                              <SelectItem
                                key={child.id}
                                value={String(child.id)}
                                className="text-xs py-2 pl-4 cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-primary/70 text-xs">
                                    ↳
                                  </span>
                                  <BookOpen className="size-3.5 text-primary shrink-0" />
                                  <span className="truncate">
                                    {child.title}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      }

                      // Case B: Parent chapter with NO subsections (directly selectable)
                      return (
                        <SelectItem
                          key={group.parent.id}
                          value={String(group.parent.id)}
                          className="text-xs py-2 cursor-pointer font-medium"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="size-3.5 text-primary shrink-0" />
                            <span className="truncate">
                              {group.parent.title}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Draft Input */}
            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <Label
                  htmlFor="draft-text"
                  className="text-xs font-medium text-foreground"
                >
                  Taslak Pasaj Metni (Word&apos;den Yapıştırın)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {isOptimalLength ? (
                    <span className="text-primary font-medium">
                      ✓ İdeal Analiz Boyutu
                    </span>
                  ) : isLongLength ? (
                    <span className="text-warning font-medium">
                      ⚠ Geniş Pasaj (Bölmeniz önerilir)
                    </span>
                  ) : isShortLength ? (
                    <span className="text-muted-foreground">Kısa Pasaj</span>
                  ) : (
                    <span>Önerilen: 150–600 kelime</span>
                  )}
                </span>
              </div>

              <Textarea
                id="draft-text"
                placeholder="Word dosyanızda yazdığınız tez pasajını buraya yapıştırın (Önerilen: 150–600 kelime)..."
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 min-h-[160px] text-sm p-3.5 bg-background border-border rounded-md resize-none leading-relaxed focus:border-primary/40 focus:ring-1 focus:ring-primary/20 font-sans"
                required
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-border shrink-0">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <span>
                RAG kaynakları, alıntı fişleri ve jüri perspektifi ile
                doğrulanır.
              </span>
            </div>

            <Button
              type="submit"
              disabled={
                isSubmitting || !activeOutlineId || draftText.trim().length < 10
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium px-4 h-8 gap-1.5 shrink-0 cursor-pointer rounded-md shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Danışman İnceliyor...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>İncelemeye Gönder</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
