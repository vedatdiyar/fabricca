"use client";

import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OfficeReviewReport } from "../../../_services/pipeline/types";

interface OfficeDiffTabProps {
  diff: OfficeReviewReport["diff"];
  onCopyPolished: () => void;
  copiedDiff: boolean;
}

/**
 * Editorial diff tab for margin notes.
 *
 * @param props - Component props.
 * @returns Rendered diff tab markup.
 */
export function OfficeDiffTab({
  diff,
  onCopyPolished,
  copiedDiff,
}: OfficeDiffTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Yazarın özgün argümanı korunarak yalnızca akademik akış, APA ve
          anlatım pürüzleri giderilmiştir.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onCopyPolished}
          className="h-7 text-xs gap-1 border-border shrink-0 cursor-pointer"
        >
          {copiedDiff ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              Kopyalandı
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Öneriyi Kopyala
            </>
          )}
        </Button>
      </div>

      {diff.changes && diff.changes.length > 0 && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <span className="font-semibold text-foreground block mb-1">
            Yapılan Editoryal İyileştirmeler:
          </span>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {diff.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Orijinal Taslak Metni
          </span>
          <div className="p-3 rounded-md bg-muted/40 border border-border text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans">
            {diff.original}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-primary flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Önerilen Rötuşlu Metin
          </span>
          <div className="p-3.5 rounded-md bg-primary/5 border border-primary/20 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans shadow-xs">
            {diff.polished}
          </div>
        </div>
      </div>
    </div>
  );
}
