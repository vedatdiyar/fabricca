"use client";

import { useMemo, useState, Fragment } from "react";
import { GitCompare, ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { compareThesesByRisk } from "../_services/analysis";
import {
  OVERLAP_LEVEL_LABELS,
  getOverlapLevelColor,
  THESIS_BADGE_LABELS,
  THESIS_BADGE_COLORS,
} from "../_lib/constants";
import { calculateBadge } from "@/lib/academic/badge-calculator";
import type { OriginalityReportData, OverlapLevel } from "@/lib/types";

/** A single overlap-table row after sorting and comparison-note backfill. */
type OverlapRow =
  OriginalityReportData["tezaraResults"]["overlapTable"][number];

interface TezaraOverlapTableProps {
  overlapTable: OriginalityReportData["tezaraResults"]["overlapTable"];
  strategicRecommendations: string;
}

/**
 * Renders only the categorical overlap level badge for a dimensional axis.
 */
function AxisCell({ level }: { level: OverlapLevel }) {
  return (
    <div className="flex items-center justify-center">
      <span
        className={`inline-flex items-center justify-center w-20 py-0.5 rounded-md text-[10px] font-bold tracking-wide border ${getOverlapLevelColor(level)}`}
      >
        {OVERLAP_LEVEL_LABELS[level]}
      </span>
    </div>
  );
}

/**
 * Renders Section B of the originality report: the 4-axis literature overlap
 * matrix with numeric dimensional index gauges. Sorts rows by priority
 * (highest total overlap first, then doctorate over master's, then recency),
 * backfills missing `comparisonNote` values from the strategic
 * recommendations blob when no row carries its own note, and supports
 * per-row expansion to reveal the detailed comparison analysis.
 */
export function TezaraOverlapTable({
  overlapTable,
  strategicRecommendations,
}: TezaraOverlapTableProps) {
  const [expandedThesisId, setExpandedThesisId] = useState<number | null>(null);

  const sortedTheses = useMemo<OverlapRow[]>(() => {
    if (!overlapTable) return [];
    const items: OverlapRow[] = overlapTable.map((item) => ({ ...item }));
    const hasAnyNote = items.some((item) => item.comparisonNote);

    if (!hasAnyNote && strategicRecommendations) {
      const parts = strategicRecommendations.split(/\n+---\n+/);
      const trimmedParts = parts.map((p) => {
        let text = p.trim();
        if (text.startsWith("Yol Haritası ve Akademik Tavsiyeler")) {
          text = text
            .replace(/^Yol Haritası ve Akademik Tavsiyeler\s*/, "")
            .trim();
        }
        return text;
      });
      items.forEach((item, index) => {
        if (trimmedParts[index]) {
          item.comparisonNote = trimmedParts[index];
        }
      });
    }

    return items.sort(compareThesesByRisk);
  }, [overlapTable, strategicRecommendations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <GitCompare className="w-5 h-5 text-primary" />
          Tez Karşılaştırma ve Pozisyon Matrisi
        </CardTitle>
        <CardDescription>
          Benzer akademik çalışmaların konu, kuramsal çerçeve, metodoloji ve
          bağlam eksenlerinde kategorik risk seviyeleri ile incelenmesi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase min-w-[320px]">
                  Karşılaştırılan Tez Bilgileri
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                  Konu
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                  Teori
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                  Yöntem
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                  Dönem
                </th>
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[90px] border-l border-border/40">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTheses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground leading-relaxed text-sm"
                  >
                    Doğrudan ilişki kuran veya karşılaştırılabilir herhangi bir
                    akademik çalışma tespit edilmemiştir.
                  </td>
                </tr>
              ) : (
                sortedTheses.map((item, idx) => (
                  <Fragment key={item.id || idx}>
                    <tr
                      className={`hover:bg-muted/20 cursor-pointer transition-colors ${expandedThesisId === item.id ? "bg-muted/20" : ""}`}
                      onClick={() =>
                        setExpandedThesisId(
                          expandedThesisId === item.id ? null : item.id,
                        )
                      }
                    >
                      <td className="p-3 space-y-2">
                        <div className="font-semibold text-foreground text-sm leading-relaxed flex items-start gap-2 select-none">
                          <span className="mt-1 text-muted-foreground shrink-0 transition-transform duration-200">
                            {expandedThesisId === item.id ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <span>{item.title}</span>
                        </div>
                        <div className="pl-6 text-[10px] text-muted-foreground leading-relaxed">
                          {item.author} &bull; {item.university} ({item.year})
                        </div>
                        <div className="pl-6 text-[10px] text-muted-foreground font-mono">
                          {item.thesisType}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell level={item.axes.subject} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell level={item.axes.theory} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell level={item.axes.methodology} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell level={item.axes.context ?? "OZGUN"} />
                      </td>
                      <td className="p-3 text-center border-l border-border/40">
                        <span
                          className={`inline-flex items-center justify-center w-20 py-1 rounded-md text-[10px] font-bold tracking-wide border ${THESIS_BADGE_COLORS[calculateBadge(item.axes)]}`}
                        >
                          {THESIS_BADGE_LABELS[calculateBadge(item.axes)]}
                        </span>
                      </td>
                    </tr>
                    {expandedThesisId === item.id && item.comparisonNote && (
                      <tr className="bg-muted/10">
                        <td colSpan={6} className="p-4 border-t border-border">
                          <div className="p-6 space-y-2 bg-background rounded-md">
                            <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2 select-none">
                              <GitCompare className="w-3.5 h-3.5 text-primary" />
                              Detaylı Karşılaştırma Analizi
                            </h4>
                            <p className="text-sm leading-relaxed text-foreground font-normal whitespace-pre-line">
                              {item.comparisonNote}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
