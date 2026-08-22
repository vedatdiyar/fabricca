"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CitationSynthesisReport } from "../../ai-actions";
import type { CitationCardItem, SourceItem } from "../../_lib/types";

interface SynthesisFlowTabProps {
  argumentFlow: CitationSynthesisReport["argumentFlow"];
  cardMap: Map<number, CitationCardItem>;
  sourceMap: Map<number, SourceItem>;
}

export function SynthesisFlowTab({
  argumentFlow,
  cardMap,
  sourceMap,
}: SynthesisFlowTabProps) {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground mr-1">
          Word Tez Yazım Kılavuzu:
        </span>
        Bu sıralama, alıntılarınızı tezinizde sunarken mantıksal bir argüman
        akışı oluşturmanız için tasarlanmıştır.
      </div>

      <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
        {argumentFlow.map((step) => {
          const card = cardMap.get(step.cardId);
          const src = card ? sourceMap.get(card.sourceId) : null;

          return (
            <div
              key={step.step}
              className="relative pl-8 flex flex-col gap-1.5"
            >
              {/* Step Indicator Dot */}
              <div className="absolute left-2 top-2.5 -translate-x-1/2 h-4 w-4 rounded-full bg-card border-2 border-primary flex items-center justify-center text-[9px] font-bold text-primary shadow-2xs">
                {step.step}
              </div>

              <Card className="border-border bg-card shadow-2xs p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/20"
                  >
                    {step.roleInArgument}
                  </Badge>

                  {src && (
                    <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[220px]">
                      {src.title} — s. {card?.pageNumber || ""}
                    </span>
                  )}
                </div>

                {card && (
                  <div className="p-2 rounded-md bg-muted/30 border border-border/60 text-[11px] text-foreground leading-relaxed italic">
                    &quot;{card.content}&quot;
                  </div>
                )}

                {/* Transition Note */}
                <div className="p-2 rounded-md bg-warning/10 border border-warning/20 text-[10px] leading-relaxed text-foreground">
                  <span className="font-semibold text-warning block mb-0.5">
                    🔗 Geçiş ve Eklemlenme Önerisi:
                  </span>
                  {step.transitionNote}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
