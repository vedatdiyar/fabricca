"use client";

import { useMemo, ElementType } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  FileText,
  FileSearch,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { stripAltTitle } from "@/lib/academic/utils";
import type { OriginalityReportData, AcademicBadge } from "@/lib/types";
import { getAcademicBadgeConfig } from "../_lib/constants";
import { sortComparisonItems } from "../_lib/sort-utils";

type OverlapRow =
  OriginalityReportData["tezaraResults"]["overlapTable"][number];

interface TezaraOverlapCardsProps {
  overlapTable: OverlapRow[];
}

const BADGE_ICONS: Record<AcademicBadge, ElementType> = {
  HIGH_RISK_REPLICATION: AlertTriangle,
  POTENTIAL_OVERLAP: ShieldAlert,
  SAFE_ORIGINAL: BookOpen,
};

export function TezaraOverlapCards({ overlapTable }: TezaraOverlapCardsProps) {
  const sortedTheses = useMemo<OverlapRow[]>(() => {
    return sortComparisonItems(overlapTable);
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
    <div className="grid grid-cols-1 gap-6 w-full">
      {sortedTheses.map((item) => {
        const config = getAcademicBadgeConfig(item.originalityStatus);
        const Icon = BADGE_ICONS[item.originalityStatus] || HelpCircle;

        return (
          <Card
            key={item.id}
            className={`w-full overflow-hidden transition-all duration-200 border rounded-md ${config.card} ${config.border}`}
          >
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-sans font-semibold px-2.5 py-1 rounded-md border uppercase tracking-wider ${config.card} ${config.border} ${config.text}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {config.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-5">
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
                  <span className="font-sans text-[10px] uppercase bg-muted/20 px-1.5 rounded-sm">
                    {item.thesisType}
                  </span>
                  <span>&bull;</span>
                  <span className="italic">{item.department}</span>
                </div>
              </div>

              {/* Relevance Explanation */}
              <div className="text-xs text-foreground bg-muted/10 p-4 rounded-md border border-border/40 font-sans leading-relaxed">
                <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5 flex items-center gap-1">
                  <FileSearch className="w-3.5 h-3.5" />
                  Tezin Alaka Düzeyi
                </span>
                {item.relevanceExplanation}
              </div>

              {/* Qualitative Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Uniqueness Gap */}
                  <div className="bg-background p-4 rounded-md border border-border/40 space-y-1">
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Özgünlük Farkı (Gap)
                    </span>
                    <p className="text-xs leading-relaxed text-foreground/90 font-sans">
                      {item.uniquenessGap}
                    </p>
                  </div>

                  {/* Chapter Integration */}
                  <div className="bg-background p-4 rounded-md border border-border/40 space-y-1">
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Tez Bölümlerine Entegrasyon
                    </span>
                    <p className="text-xs leading-relaxed text-foreground/90 font-sans">
                      {item.chapterIntegration}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Literature Usage */}
                  <div className="bg-background p-4 rounded-md border border-border/40 space-y-1">
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Literatürde Konumlandırma
                    </span>
                    <p className="text-xs leading-relaxed text-foreground/90 font-sans">
                      {item.literatureReviewUsage}
                    </p>
                  </div>

                  {/* Conceptual Borrowing */}
                  <div className="bg-background p-4 rounded-md border border-border/40 space-y-1">
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Kavramsal / Teorik Atıflar
                    </span>
                    <p className="text-xs leading-relaxed text-foreground/90 font-sans">
                      {item.conceptualBorrowing}
                    </p>
                  </div>
                </div>
              </div>

              {/* Replication Warning (if relevant) */}
              {item.replicationWarning && item.replicationWarning !== "N/A" && (
                <div className="bg-destructive/5 text-destructive p-4 rounded-md border border-destructive/10 text-xs leading-relaxed font-sans flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[10px] uppercase tracking-wider mb-1">
                      Kopya / Çakışma Uyarısı
                    </span>
                    {item.replicationWarning}
                  </div>
                </div>
              )}

              {/* YOK PDF and metadata footer */}
              <div className="flex justify-between items-center pt-2 border-t border-border/20">
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary/70 animate-pulse" />
                  Niteliksel Yol Haritası Üretilmiştir.
                </span>
                {item.yokPdfUrl && (
                  <a
                    href={item.yokPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium font-sans"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Tez Detayını İncele (YÖK PDF)
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
