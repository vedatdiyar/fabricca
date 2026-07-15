"use client";

import { useMemo, ElementType } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  FileText,
  GitBranch,
  HelpCircle,
  History,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { stripAltTitle } from "@/lib/academic/utils";
import type { OriginalityReportData, AnalysisBadge } from "@/lib/types";
import { getAnalysisBadgeConfig } from "../_lib/constants";
import { BADGE_ORDER_PRIORITY } from "../_lib/sort-utils";

type OverlapRow =
  OriginalityReportData["tezaraResults"]["overlapTable"][number];

interface TezaraOverlapCardsProps {
  overlapTable: OverlapRow[];
}

const BADGE_ICONS: Record<AnalysisBadge, ElementType> = {
  DUPLICATE_THESIS_RISK: ShieldAlert,
  EMPIRICAL_FOUNDATION_SOURCE: Sparkles,
  DIALECTICAL_DISCUSSION_SUPPORT: RefreshCw,
  THEMATIC_SYNTHESIS_OPPORTUNITY: GitBranch,
  CROSS_CONTEXTUAL_VALIDATION: Compass,
  METHODOLOGICAL_AND_THEORETICAL_PEER: FileText,
  HISTORICAL_BASELINE_DATA: History,
  FUTURE_PROSPECTIVE_CONTEXT: ArrowRight,
  MACRO_STRUCTURAL_CONTEXT: Layers,
  PARALLEL_LITERATURE_REFERENCE: BookOpen,
  IRRELEVANT_DATA: HelpCircle,
};

export function TezaraOverlapCards({ overlapTable }: TezaraOverlapCardsProps) {
  const sortedTheses = useMemo<OverlapRow[]>(() => {
    if (!overlapTable) return [];

    return [...overlapTable].sort((a, b) => {
      const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
      const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
      if (pA !== pB) return pA - pB;
      // Same badge: higher relevance score first
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Tiebreaker: newest first
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
        const config = getAnalysisBadgeConfig(item.primaryBadge);
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

              <div className="pt-2 border-t border-border/40 space-y-2">
                <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  Hedef Teze Katkısı
                </h4>
                <p className="text-sm font-sans leading-relaxed text-foreground antialiased font-normal">
                  {item.analysisNote ||
                    "Bu tezin hedef teze doğrudan bir katkısı tespit edilememiştir."}
                </p>
              </div>

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
