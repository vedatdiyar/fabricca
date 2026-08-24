"use client";

import { Copy, Check, Sparkles, FileText, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OfficeReviewReport } from "../../../_services/pipeline/types";

interface OfficeDiffTabProps {
  diff: OfficeReviewReport["diff"];
  onCopyPolished: () => void;
  copiedDiff: boolean;
}

/**
 * Editorial diff tab for margin notes.
 * Side-by-side desktop view for easy comparison with high contrast.
 */
export function OfficeDiffTab({
  diff,
  onCopyPolished,
  copiedDiff,
}: OfficeDiffTabProps) {
  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="pb-1 border-b border-border/60">
        <p className="text-xs font-normal text-muted-foreground">
          Yazarın özgün argümanı korunarak yalnızca akademik akış, APA ve
          anlatım pürüzleri giderilmiştir.
        </p>
      </div>

      {/* Editorial Improvements List */}
      {diff.changes && diff.changes.length > 0 && (
        <div className="p-4 rounded-lg bg-card border border-primary/20 space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <h3 className="font-serif text-sm font-semibold tracking-tight text-primary">
              Yapılan Editoryal İyileştirmeler
            </h3>
          </div>
          <ul className="space-y-1.5 pl-5 list-disc text-sm font-normal leading-relaxed text-foreground">
            {diff.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-Side Comparison Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Original Draft Box */}
        <div className="p-4 rounded-lg bg-card border border-border flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <div className="flex items-center gap-2 text-foreground font-serif text-sm font-semibold">
              <FileText className="size-4 text-muted-foreground" />
              <span>Orijinal Taslak Metni</span>
            </div>
            <Badge
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border text-[11px] font-medium"
            >
              Ham Metin
            </Badge>
          </div>

          <div className="flex-1 p-3.5 rounded-md bg-secondary/40 border border-border/40 text-sm font-serif font-normal leading-relaxed text-foreground whitespace-pre-wrap">
            {diff.original}
          </div>
        </div>

        {/* Polished Draft Box */}
        <div className="p-4 rounded-lg bg-card border border-primary/30 flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-primary/20">
            <div className="flex items-center gap-2 text-primary font-serif text-sm font-semibold">
              <CheckCheck className="size-4 text-primary" />
              <span>Önerilen Rötuşlu Metin</span>
            </div>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold"
            >
              Akademik Rötuş
            </Badge>
            <Button
              size="icon"
              variant="outline"
              onClick={onCopyPolished}
              title={copiedDiff ? "Kopyalandı" : "Önerilen Metni Kopyala"}
              aria-label="Önerilen Metni Kopyala"
              className="h-7 w-7 border-border bg-secondary hover:bg-secondary/80 text-foreground shrink-0 cursor-pointer"
            >
              {copiedDiff ? (
                <Check className="size-3.5 text-primary" />
              ) : (
                <Copy className="size-3.5 text-primary" />
              )}
            </Button>
          </div>

          <div className="flex-1 p-3.5 rounded-md bg-primary/10 border border-primary/20 text-sm font-serif font-normal leading-relaxed text-foreground whitespace-pre-wrap">
            {diff.polished}
          </div>
        </div>
      </div>
    </div>
  );
}
