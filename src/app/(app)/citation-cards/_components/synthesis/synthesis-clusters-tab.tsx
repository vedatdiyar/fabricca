"use client";

import { Pin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CitationSynthesisReport } from "../../ai-actions";
import type { CitationCardItem, SourceItem } from "../../_lib/types";

interface SynthesisClustersTabProps {
  clusters: CitationSynthesisReport["clusters"];
  cardMap: Map<number, CitationCardItem>;
  sourceMap: Map<number, SourceItem>;
  onPinCluster: (
    clusterId: string,
    cardIds: number[],
    targetOutlineId: number,
  ) => void;
  pinningClusterId: string | null;
}

export function SynthesisClustersTab({
  clusters,
  cardMap,
  sourceMap,
  onPinCluster,
  pinningClusterId,
}: SynthesisClustersTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {clusters.map((cluster) => {
        const clusterCards = cluster.cardIds
          .map((id) => cardMap.get(id))
          .filter((c): c is CitationCardItem => c !== undefined);

        return (
          <Card
            key={cluster.id}
            className="border-border bg-card flex flex-col justify-between shadow-2xs overflow-hidden"
          >
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <h4 className="font-serif text-xs font-semibold text-foreground">
                    {cluster.themeTitle}
                  </h4>
                </div>

                <Badge
                  variant="secondary"
                  className="text-[10px] bg-muted text-muted-foreground"
                >
                  {clusterCards.length} Fiş
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {cluster.description}
              </p>

              {/* Cards Mini List in this Cluster */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                {clusterCards.map((card) => {
                  const src = sourceMap.get(card.sourceId);

                  return (
                    <div
                      key={card.id}
                      className="p-2 rounded-md bg-muted/40 border border-border/70 text-[11px] flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {src?.title || "Kaynak"}
                        </span>
                        <span>s. {card.pageNumber}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                        &quot;{card.content}&quot;
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cluster Footer: Quick Assign to Outline */}
            {cluster.suggestedOutlineId && (
              <div className="p-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground truncate">
                  Önerilen Bölüm:{" "}
                  <strong>
                    {cluster.suggestedOutlineTitle ||
                      `Bölüm #${cluster.suggestedOutlineId}`}
                  </strong>
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    cluster.suggestedOutlineId &&
                    onPinCluster(
                      cluster.id,
                      cluster.cardIds,
                      cluster.suggestedOutlineId,
                    )
                  }
                  disabled={pinningClusterId === cluster.id}
                  className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 cursor-pointer shrink-0"
                >
                  {pinningClusterId === cluster.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Pin className="h-3 w-3" />
                  )}
                  <span>Bölüme Ata</span>
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
