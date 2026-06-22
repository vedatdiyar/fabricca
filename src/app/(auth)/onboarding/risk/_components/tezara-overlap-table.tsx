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
import { getThesisPriority, getScoreBadge } from "../_services/analysis";
import { BADGE_LABELS, getBadgeColor } from "../_lib/constants";
import type { OriginalityReportData } from "@/lib/types";

/** A single overlap-table row after sorting and comparison-note backfill. */
type OverlapRow =
  OriginalityReportData["tezaraResults"]["overlapTable"][number];

interface TezaraOverlapTableProps {
  overlapTable: OriginalityReportData["tezaraResults"]["overlapTable"];
  strategicRecommendations: string;
}

/**
 * Helper to categorize originality scores (0-100) and return badge style classes.
 */
export function getAcademicStatus(score: number) {
  if (score <= 30) {
    return {
      label: "Özgün",
      badgeClass: "bg-success/10 border-success/20 text-success",
    };
  }
  if (score <= 50) {
    return {
      label: "Besleyici",
      badgeClass: "bg-warning/10 border-warning/20 text-warning",
    };
  }
  if (score <= 70) {
    return {
      label: "Sınırda",
      badgeClass: "bg-orange-500/10 border-orange-500/20 text-orange-500",
    };
  }
  return {
    label: "Kritik",
    badgeClass: "bg-destructive/10 border-destructive/20 text-destructive",
  };
}

/**
 * Renders only the academic status badge for a dimensional index score.
 */
function AxisCell({ score }: { score: number }) {
  const status = getAcademicStatus(score);
  return (
    <div className="flex items-center justify-center">
      <span
        className={`inline-flex items-center justify-center w-[76px] py-0.5 rounded-full text-[10px] font-semibold border ${status.badgeClass}`}
      >
        {status.label}
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

    return items.sort((a, b) => {
      const priorityA = getThesisPriority(a.axes);
      const priorityB = getThesisPriority(b.axes);
      if (priorityA !== priorityB) return priorityB - priorityA;
      const tA = (a.thesisType || "").toLowerCase();
      const tB = (b.thesisType || "").toLowerCase();
      const wA =
        tA.includes("doktora") || tA.includes("phd")
          ? 2
          : tA.includes("yüksek lisans")
            ? 1
            : 0;
      const wB =
        tB.includes("doktora") || tB.includes("phd")
          ? 2
          : tB.includes("yüksek lisans")
            ? 1
            : 0;
      if (wB !== wA) return wB - wA;
      return (b.year || 0) - (a.year || 0);
    });
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
          bağlam eksenlerinde 0-100 endeks puanları ile incelenmesi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto border border-border rounded-lg">
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
                <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[90px]">
                  Pozisyon
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
                      <td className="p-3 space-y-1">
                        <div className="font-semibold text-foreground text-sm leading-relaxed flex items-start gap-2 select-none">
                          <span className="mt-1 text-muted-foreground shrink-0 transition-transform duration-200">
                            {expandedThesisId === item.id ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <span>{item.title}</span>
                        </div>
                        <div className="pl-6 text-xs text-muted-foreground leading-relaxed">
                          {item.author} &bull; {item.university} ({item.year})
                        </div>
                        <div className="pl-6 text-[11px] text-muted-foreground font-mono">
                          {item.thesisType}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell score={item.axes.subject} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell score={item.axes.theory} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell score={item.axes.methodology} />
                      </td>
                      <td className="p-3 text-center">
                        <AxisCell score={item.axes.context ?? 0} />
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex px-3 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getBadgeColor(getScoreBadge(item.riskScore))}`}
                        >
                          {BADGE_LABELS[getScoreBadge(item.riskScore)] ||
                            getScoreBadge(item.riskScore)}
                        </span>
                      </td>
                    </tr>
                    {expandedThesisId === item.id && item.comparisonNote && (
                      <tr className="bg-muted/10">
                        <td colSpan={6} className="p-4 border-t border-border">
                          <div className="p-6 space-y-2 bg-background rounded-lg">
                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 select-none">
                              <GitCompare className="w-3.5 h-3.5 text-primary" />
                              Detaylı Karşılaştırma Analizi
                            </h4>
                            <p className="text-sm leading-relaxed text-foreground font-light whitespace-pre-line">
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
