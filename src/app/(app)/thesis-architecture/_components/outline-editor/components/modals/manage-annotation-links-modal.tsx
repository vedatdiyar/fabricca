"use client";

import { useMemo, useState } from "react";
import { Outline, Box, Annotation, Source } from "@/core/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check } from "lucide-react";
import { getNoteTypeBadgeConfig } from "../section-workspace/section-annotation-item";

interface ManageAnnotationLinksModalProps {
  open: boolean;
  outline: Outline | null;
  annotationsList: (Annotation & { source?: Source })[];
  boxesList: Box[];
  localPinnedAnnotationsMap: Record<number, number[]>;
  onToggleAnnotationLink: (annotationId: number) => void;
  onClose: () => void;
}

/**
 * Citation-card link management dialog listing all the user's citation cards
 * (fişler) with topic-box and text search filters and optimistic link/unlink
 * toggles for the selected section.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.outline - The section whose links are being managed or null.
 * @param root0.annotationsList - All user citation cards with their sources.
 * @param root0.boxesList - All thesis topic boxes (used as the source/box filter).
 * @param root0.localPinnedAnnotationsMap - Effective annotation to outline link map (with optimistic overrides).
 * @param root0.onToggleAnnotationLink - Annotation link/unlink toggle handler.
 * @param root0.onClose - Dialog close handler.
 */
export function ManageAnnotationLinksModal({
  open,
  outline,
  annotationsList,
  boxesList,
  localPinnedAnnotationsMap,
  onToggleAnnotationLink,
  onClose,
}: ManageAnnotationLinksModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);

  const linkedAnnotationIds = outline
    ? (localPinnedAnnotationsMap[outline.id] ?? [])
    : [];

  const filteredAnnotations = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    return annotationsList.filter((a) => {
      if (selectedBoxId !== null && a.source?.boxId !== selectedBoxId) {
        return false;
      }
      if (!q) return true;
      return (
        a.content.toLocaleLowerCase("tr-TR").includes(q) ||
        (a.source?.title &&
          a.source.title.toLocaleLowerCase("tr-TR").includes(q)) ||
        (a.source?.authors?.some((author) =>
          author.toLocaleLowerCase("tr-TR").includes(q),
        ) ??
          false)
      );
    });
  }, [annotationsList, selectedBoxId, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            Bölüme Bağlı Alıntı Kartlarını Yönet
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            &quot;{outline?.title}&quot; bölümüne doğrudan iliştirmek
            istediğiniz alıntı, açımlama ve kişisel not kartlarını seçin. Kartın
            metni, sayfası ve ait olduğu eser bölüm çalışma masasında görünür.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fiş metni, eser başlığı veya yazar ara..."
              className="h-9 pl-8 pr-3 text-xs bg-background/50 border-border/60"
            />
          </div>
          <select
            value={selectedBoxId ?? ""}
            onChange={(e) =>
              setSelectedBoxId(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Konu kutusuna göre filtrele"
          >
            <option value="">Tüm Konu Kutuları</option>
            {boxesList.map((box) => (
              <option key={box.id} value={box.id}>
                {box.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5 py-3 max-h-[50vh] overflow-y-auto pr-1">
          {filteredAnnotations.length > 0 ? (
            filteredAnnotations.map((annotation) => {
              const isLinked = linkedAnnotationIds.includes(annotation.id);
              const noteConfig = getNoteTypeBadgeConfig(annotation.noteType);
              const NoteIcon = noteConfig.icon;

              return (
                <div
                  key={annotation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleAnnotationLink(annotation.id)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    onToggleAnnotationLink(annotation.id)
                  }
                  className={`flex cursor-pointer items-start justify-between p-3 rounded-md border transition-all ${
                    isLinked
                      ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                      : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${noteConfig.className}`}
                      >
                        <NoteIcon className="h-3 w-3 shrink-0" />
                        {noteConfig.label}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] border-primary/20 text-primary"
                      >
                        s. {annotation.pageNumber}
                      </Badge>
                      {annotation.source?.title && (
                        <span className="font-sans text-[10px] text-muted-foreground truncate max-w-[220px]">
                          {annotation.source.title}
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-xs text-foreground leading-relaxed line-clamp-2">
                      {annotation.content}
                    </p>
                    {(annotation.source?.authors?.length ?? 0) > 0 && (
                      <p className="font-sans text-[10px] text-muted-foreground/80">
                        {annotation.source?.authors?.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {isLinked ? (
                      <Badge className="bg-primary text-primary-foreground font-sans text-xs flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Bağlı</span>
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        Bağla
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center space-y-2 border border-dashed border-border/60 rounded-lg bg-muted/5">
              <p className="font-serif text-sm font-semibold text-foreground">
                {searchQuery || selectedBoxId !== null
                  ? "Filtrelerinize uygun alıntı kartı bulunamadı."
                  : "Henüz alıntı kartı bulunmuyor."}
              </p>
              <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto">
                Alıntı kartlarını kütüphanenizdeki kaynaklar üzerinden Alıntı
                Fişleri sayfasında oluşturabilirsiniz.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Tamamla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
