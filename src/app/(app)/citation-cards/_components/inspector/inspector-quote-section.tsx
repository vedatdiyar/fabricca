"use client";

import { Copy, Check, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNoteTypeBadgeConfig } from "../citation-card";
import type { CitationCardItem } from "../../_lib/types";

interface InspectorQuoteSectionProps {
  card: CitationCardItem;
  noteConfig: ReturnType<typeof getNoteTypeBadgeConfig>;
  copied: boolean;
  onCopy: () => void;
}

export function InspectorQuoteSection({
  card,
  noteConfig,
  copied,
  onCopy,
}: InspectorQuoteSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alıntı Metni
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Kopyala</span>
              </>
            )}
          </Button>
        </div>

        <div className="p-3.5 rounded-md border border-border bg-muted/10 font-sans">
          {card.noteType === "DIRECT_QUOTE" ? (
            <blockquote
              className={cn(
                "relative pl-3 text-sm leading-relaxed text-foreground border-l-2",
                noteConfig.borderAccent,
              )}
            >
              &ldquo;{card.content}&rdquo;
            </blockquote>
          ) : (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {card.content}
            </p>
          )}
        </div>
      </div>

      {card.comment && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
            Araştırmacı Şerhi & Kişisel Not
          </h4>
          <div className="p-3 rounded-md border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {card.comment}
          </div>
        </div>
      )}
    </>
  );
}
