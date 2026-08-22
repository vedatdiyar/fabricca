"use client";

import { Sparkles, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CitationSynthesisReport } from "../../ai-actions";
import type { OutlineItem } from "../../_lib/types";

interface CitationSynthesisPanelHeaderProps {
  selectedOutline: OutlineItem | null | undefined;
  report: CitationSynthesisReport | null;
  isSynthesizing: boolean;
  onRunSynthesis: () => void;
  onClose: () => void;
}

export function CitationSynthesisPanelHeader({
  selectedOutline,
  report,
  isSynthesizing,
  onRunSynthesis,
  onClose,
}: CitationSynthesisPanelHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif text-sm font-semibold text-foreground">
              Fikir & Argüman Sentezi
            </h3>
            {selectedOutline ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-primary/10 text-primary border-primary/20"
              >
                {selectedOutline.title}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-[10px] bg-muted text-muted-foreground"
              >
                Tüm Fişler
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Fişlerin anlamsal temaları ve Word tez yazım akış sırası.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {report && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRunSynthesis}
            disabled={isSynthesizing}
            className="text-xs h-7 gap-1 border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            <RotateCw
              className={`h-3 w-3 ${isSynthesizing ? "animate-spin" : ""}`}
            />
            <span>Yeniden Sentezle</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
          title="Sentez Panelini Kapat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
