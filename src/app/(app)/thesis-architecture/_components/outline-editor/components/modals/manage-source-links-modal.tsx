"use client";

import { useMemo, useState } from "react";
import { Outline, Box, Source } from "@/core/db/schema";
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
import { Search, Check, FileText } from "lucide-react";

interface ManageSourceLinksModalProps {
  open: boolean;
  outline: Outline | null;
  sourcesList: Source[];
  boxesList: Box[];
  localLinkedSourcesMap: Record<number, number[]>;
  onToggleSourceLink: (sourceId: number) => void;
  onClose: () => void;
}

/**
 * Source link management dialog listing all library sources with topic-box
 * and text search filters and optimistic link/unlink toggles for the selected
 * section.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.outline - The section whose links are being managed or null.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.boxesList - All thesis topic boxes (used as the box filter).
 * @param root0.localLinkedSourcesMap - Effective source to outline link map (with optimistic overrides).
 * @param root0.onToggleSourceLink - Source link/unlink toggle handler.
 * @param root0.onClose - Dialog close handler.
 */
export function ManageSourceLinksModal({
  open,
  outline,
  sourcesList,
  boxesList,
  localLinkedSourcesMap,
  onToggleSourceLink,
  onClose,
}: ManageSourceLinksModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);

  const linkedSourceIds = outline
    ? (localLinkedSourcesMap[outline.id] ?? [])
    : [];

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    return sourcesList.filter((s) => {
      if (selectedBoxId !== null && s.boxId !== selectedBoxId) return false;
      if (!q) return true;
      return (
        s.title.toLocaleLowerCase("tr-TR").includes(q) ||
        (s.authors?.some((a) => a.toLocaleLowerCase("tr-TR").includes(q)) ??
          false) ||
        (s.publisher?.toLocaleLowerCase("tr-TR").includes(q) ?? false)
      );
    });
  }, [sourcesList, selectedBoxId, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            Bölüme Bağlı Kaynakları Yönet
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            &quot;{outline?.title}&quot; bölümünü yazarken kullanacağınız
            eserleri kütüphanenizden seçin. Doğrudan bağlanan kaynaklar bölüm
            çalışma masasında &quot;Kullanılan Kaynaklar&quot; listesinde
            görünür.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Eser başlığı, yazar veya yayıncı ara..."
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
          {filteredSources.length > 0 ? (
            filteredSources.map((source) => {
              const isLinked = linkedSourceIds.includes(source.id);

              return (
                <div
                  key={source.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleSourceLink(source.id)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    onToggleSourceLink(source.id)
                  }
                  className={`flex cursor-pointer items-start justify-between p-3 rounded-md border transition-all ${
                    isLinked
                      ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                      : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-serif text-sm font-semibold text-foreground leading-snug break-words">
                        {source.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pl-6">
                      {source.authors && source.authors.length > 0 && (
                        <span className="font-sans text-xs text-muted-foreground">
                          {source.authors.join(", ")}
                        </span>
                      )}
                      {source.publicationYear && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] border-primary/20 text-primary"
                        >
                          {source.publicationYear}
                        </Badge>
                      )}
                      {source.publisher && (
                        <span className="font-sans text-[10px] text-muted-foreground/80 italic">
                          {source.publisher}
                        </span>
                      )}
                    </div>
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
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-serif text-sm font-semibold text-foreground">
                {searchQuery || selectedBoxId !== null
                  ? "Filtrelerinize uygun kaynak bulunamadı."
                  : "Kütüphanede henüz kaynak bulunmuyor."}
              </p>
              <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto">
                Konu kutularınız üzerinden literatür taraması yaparak
                kütüphanenizi doldurabilirsiniz.
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
