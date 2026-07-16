"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  XCircle,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { stripAltTitle } from "@/lib/academic/utils";
import type { OriginalityReportData } from "@/lib/types";

type EliminatedRow =
  OriginalityReportData["tezaraResults"]["eliminatedTheses"][number];

interface EliminatedThesesSectionProps {
  eliminatedTheses: EliminatedRow[];
}

export function EliminatedThesesSection({
  eliminatedTheses,
}: EliminatedThesesSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!eliminatedTheses || eliminatedTheses.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group cursor-pointer"
      >
        <div className="h-px flex-1 bg-border" />
        <span className="inline-flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          ELENEN TEZLER ({eliminatedTheses.length})
        </span>
        <div className="h-px flex-1 bg-border" />
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-3 w-full">
          {eliminatedTheses.map((item) => (
            <Card
              key={item.id}
              className="w-full overflow-hidden border border-border/40 bg-muted/30 opacity-80 transition-all duration-200"
            >
              <CardHeader className="p-3 pb-1.5">
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="font-serif text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/60">
                    JÜRİ ANALİZİNDE ELENEN TEZ (GÜRÜLTÜ)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-1.5 space-y-2">
                <div className="space-y-0.5">
                  <h3 className="font-serif text-sm font-medium leading-snug text-foreground/70 tracking-tight">
                    {stripAltTitle(item.title)}
                  </h3>
                  <div className="text-[10px] text-muted-foreground/50 leading-relaxed flex flex-wrap gap-x-2 gap-y-0.5 font-sans">
                    <span className="font-medium text-foreground/60">
                      {item.author}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {item.university} ({item.year})
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono uppercase bg-muted/10 px-1 rounded text-[9px]">
                      {item.thesisType}
                    </span>
                    <span>&bull;</span>
                    <span className="text-[9px] text-muted-foreground/40">
                      Puan: {item.relevanceScore}
                    </span>
                    <span>&bull;</span>
                    <span className="text-[9px] text-muted-foreground/40">
                      Eleme: Jüri Sınıflandırması
                    </span>
                  </div>
                </div>

                {item.dimensionScores && (
                  <div className="pt-0.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye className="w-2.5 h-2.5 text-muted-foreground/40" />
                      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40 font-sans">
                        7 Boyut
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {[
                        {
                          label: "OF",
                          value: item.dimensionScores.researchFocus,
                        },
                        { label: "AK", value: item.dimensionScores.mainActors },
                        {
                          label: "ZK",
                          value: item.dimensionScores.temporalScope.score,
                        },
                        {
                          label: "MK",
                          value: item.dimensionScores.spatialScope,
                        },
                        {
                          label: "KU",
                          value: item.dimensionScores.theoreticalFramework,
                        },
                        {
                          label: "YT",
                          value: item.dimensionScores.methodology,
                        },
                        { label: "İS", value: item.dimensionScores.mainClaim },
                      ].map((dim) => (
                        <div
                          key={dim.label}
                          className={`flex flex-col items-center gap-0.5 px-0.5 py-0.5 rounded-sm ${
                            dim.value === 100
                              ? "bg-success/10 text-success/70"
                              : dim.value === 50
                                ? "bg-warning/10 text-warning/70"
                                : "bg-muted/10 text-muted-foreground/40"
                          }`}
                        >
                          <span className="text-[6px] font-semibold uppercase leading-none font-mono">
                            {dim.label}
                          </span>
                          <span className="text-[8px] font-bold leading-none font-mono">
                            {dim.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.yokPdfUrl && (
                  <div className="flex justify-end pt-0.5">
                    <a
                      href={item.yokPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary hover:underline font-medium font-sans"
                    >
                      <FileText className="w-3 h-3" />
                      Tez Detayını İncele (YÖK PDF)
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
