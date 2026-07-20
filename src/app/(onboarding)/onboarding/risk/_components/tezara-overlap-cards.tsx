"use client";

import { useMemo, ElementType } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  XOctagon,
  Cpu,
  Globe,
  BookOpen,
  GitCompare,
  Bookmark,
  TrendingUp,
  Clock,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { stripAltTitle } from "@/lib/academic/utils";
import type { OriginalityReportData, AcademicBadge } from "@/lib/types";
import { getAcademicBadgeConfig } from "../_lib/constants";
import { BADGE_ORDER_PRIORITY } from "../_lib/sort-utils";

type OverlapRow =
  OriginalityReportData["tezaraResults"]["overlapTable"][number];

interface TezaraOverlapCardsProps {
  overlapTable: OverlapRow[];
}

const BADGE_ICONS: Record<AcademicBadge, ElementType> = {
  IRRELEVANT_DATA: XOctagon,
  TWIN_THESIS_ALERT: ShieldAlert,
  CRITICAL_REPLICATION_ALERT: AlertTriangle,
  METHODOLOGY_REFERENCE: Cpu,
  THEORETICAL_ANCHOR: BookOpen,
  HISTORICAL_CONTEXT: Clock,
  FUTURE_PROJECTION: TrendingUp,
  CONTEXTUAL_COMPARISON: Globe,
  EMPIRICAL_BENCHMARK: GitCompare,
  BACKGROUND_LITERATURE: Bookmark,
};

export function TezaraOverlapCards({ overlapTable }: TezaraOverlapCardsProps) {
  const sortedTheses = useMemo<OverlapRow[]>(() => {
    if (!overlapTable) return [];

    return [...overlapTable].sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
      const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
      if (pA !== pB) return pA - pB;
      return b.year - a.year;
    });
  }, [overlapTable]);

  if (sortedTheses.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground leading-relaxed text-sm bg-muted/10 rounded-md border border-border/40 font-sans">
        Doğrudan ilişki kuran veya karşılaştırılabilir herhangi bir akademik
        çalışma tespit edilmemiştir.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 w-full">
      {sortedTheses.map((item) => {
        const config = getAcademicBadgeConfig(item.primaryBadge);
        const Icon = BADGE_ICONS[item.primaryBadge] || HelpCircle;

        return (
          <Card
            key={item.id}
            className={`w-full overflow-hidden transition-all duration-200 border rounded-md ${config.card} ${config.border}`}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-2 text-[10px] font-sans font-medium px-2 py-0.5 rounded-md border ${config.card} ${config.border} text-foreground`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {config.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="space-y-2">
                <h3 className="font-serif text-lg font-medium leading-snug text-foreground tracking-tight">
                  {stripAltTitle(item.title)}
                </h3>
                <div className="text-[10px] text-muted-foreground leading-relaxed flex flex-wrap gap-x-2 gap-y-0.5 font-sans">
                  <span className="font-medium text-foreground">
                    {item.author}
                  </span>
                  <span>&bull;</span>
                  <span>
                    {item.university} ({item.year})
                  </span>
                  <span>&bull;</span>
                  <span className="font-sans text-[10px] uppercase bg-muted/20 px-1 rounded-sm">
                    {item.thesisType}
                  </span>
                </div>
              </div>

              {config.description && (
                <div className="text-xs text-foreground bg-muted/10 p-3 rounded-md border border-border/40 font-sans leading-relaxed">
                  <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                    Akademik Yol Haritası
                  </span>
                  {config.description}
                </div>
              )}

              {item.dimensionScores && (
                <div className="text-xs bg-muted/10 p-3 rounded-md border border-border/40 font-sans leading-relaxed space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Parametre Puanları
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Toplam:{" "}
                      <span className="font-semibold text-foreground">
                        {item.relevanceScore}
                      </span>
                      /600
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      {
                        key: "researchCore",
                        label: "Araştırma Konusu / Olgu",
                        value: item.dimensionScores.researchCore,
                      },
                      {
                        key: "actor",
                        label: "Aktör / Odak Grup",
                        value: item.dimensionScores.actor,
                      },
                      {
                        key: "spatialContext",
                        label: "Coğrafi Bağlam",
                        value: item.dimensionScores.spatialContext,
                      },
                      {
                        key: "theoreticalFramework",
                        label: "Kuramsal Çerçeve",
                        value: item.dimensionScores.theoreticalFramework,
                      },
                      {
                        key: "methodology",
                        label: "Araştırma Yöntemi",
                        value: item.dimensionScores.methodology,
                      },
                      {
                        key: "mainClaim",
                        label: "Merkez Sav",
                        value: item.dimensionScores.mainClaim,
                      },
                      {
                        key: "temporalLabel",
                        label: "Zamansal Etiket",
                        value: item.dimensionScores.temporalLabel,
                      },
                    ].map(({ key, label, value }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {typeof value === "string" ? value : `${value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.yokPdfUrl && (
                <div className="flex justify-end pt-1">
                  <a
                    href={item.yokPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium font-sans"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Tez Detayını İncele (YÖK PDF)
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
