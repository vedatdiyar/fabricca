"use client";

import { useTransition, useMemo, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Award,
  FileText,
  ExternalLink,
  GitCompare,
  Compass,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { StartOverButton } from "../../_components/start-over-button";
import { completeRiskStageAction } from "../actions";

interface OriginalityReportViewProps {
  reportData: {
    tavilyResults: {
      items: {
        fact: string;
        result: "VERIFIED" | "PARTIALLY_VERIFIED" | "REFUTED";
        resultNote?: string;
        sourceUrl: string;
      }[];
      briefingNote: string;
    };
    tezaraResults: {
      originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: {
          subject: "OVERLAPPING" | "ORIGINAL";
          theory: "OVERLAPPING" | "ORIGINAL";
          methodology: "OVERLAPPING" | "ORIGINAL";
          context?: "OVERLAPPING" | "ORIGINAL";
        };
        originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
        comparisonNote?: string;
      }[];
      strategicRecommendations: string;
    };
  };
}

const statusTranslation: Record<string, string> = {
  HIGH_RISK: "Yüksek Risk",
  MEDIUM_RISK: "Orta Risk",
  LOW_RISK: "Düşük Risk",
  ZERO_RISK: "Sıfır Risk",
  OVERLAPPING: "Çakışma Var",
  ORIGINAL: "Özgün",
};

const detailedStatusTranslation: Record<string, string> = {
  HIGH_RISK: "Orijinallik Riski / Yakın Literatür Komşusu",
  MEDIUM_RISK: "Ortak Odaklı Çalışma / Orta Risk",
  LOW_RISK: "Uyumlu / Özgün Literatür",
  ZERO_RISK: "Özgün Çalışma / Sıfır Risk",
};

const tavilyStatusTranslation: Record<string, string> = {
  VERIFIED: "Doğrulandı.",
  PARTIALLY_VERIFIED: "Kısmen Doğrulandı.",
  REFUTED: "Yanlışlandı.",
};

const tavilyBadgeColor: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  PARTIALLY_VERIFIED:
    "bg-amber-500/10 border border-amber-500/20 text-amber-400",
  REFUTED: "bg-destructive/10 border border-destructive/20 text-destructive",
};

const getThesisPriority = (axes: {
  subject: string;
  theory: string;
  methodology: string;
}) => {
  const { subject: s, theory: t, methodology: m } = axes;

  // 3 overlaps
  if (s === "OVERLAPPING" && t === "OVERLAPPING" && m === "OVERLAPPING")
    return 1;

  // 2 overlaps
  if (s === "OVERLAPPING" && t === "OVERLAPPING") return 2;
  if (s === "OVERLAPPING" && m === "OVERLAPPING") return 3;
  if (t === "OVERLAPPING" && m === "OVERLAPPING") return 4;

  // 1 overlap
  if (s === "OVERLAPPING") return 5;
  if (t === "OVERLAPPING") return 6;
  if (m === "OVERLAPPING") return 7;

  // 0 overlaps
  return 8;
};

/**
 * Özgünlük ve Maddi Doğrulama Raporu Görünümü (Client Component).
 * Tavily ve Tezara sonuçlarını, nihai risk düzeyini ve akademik tavsiyeleri
 * leading-relaxed tipografi standartları ve premium tasarım estetiğiyle listeler.
 */
export function OriginalityReportView({
  reportData,
}: OriginalityReportViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedThesisId, setExpandedThesisId] = useState<number | null>(null);

  const { tavilyResults, tezaraResults } = reportData;

  const hasOriginalComparisonNotes = useMemo(() => {
    return (
      tezaraResults.overlapTable?.some((item) => item.comparisonNote) || false
    );
  }, [tezaraResults.overlapTable]);

  const sortedTheses = useMemo(() => {
    if (!tezaraResults.overlapTable) return [];

    // Parse old concatenated strategicRecommendations if comparisonNote is missing
    const items = tezaraResults.overlapTable.map((item) => ({ ...item }));
    const hasAnyNote = items.some((item) => item.comparisonNote);

    if (!hasAnyNote && tezaraResults.strategicRecommendations) {
      // Split the recommendations
      const parts = tezaraResults.strategicRecommendations.split(/\n+---\n+/);
      const trimmedParts = parts.map((p) => {
        let text = p.trim();
        // Remove "Yol Haritası ve Akademik Tavsiyeler" header if it exists at the start
        if (text.startsWith("Yol Haritası ve Akademik Tavsiyeler")) {
          text = text
            .replace(/^Yol Haritası ve Akademik Tavsiyeler\s*/, "")
            .trim();
        }
        return text;
      });
      // The order of elements in overlapTable matches the order in which they were processed.
      items.forEach((item, index) => {
        if (trimmedParts[index]) {
          item.comparisonNote = trimmedParts[index];
        }
      });
    }

    const riskWeights = {
      HIGH_RISK: 3,
      MEDIUM_RISK: 2,
      LOW_RISK: 1,
    };

    return items.sort((a, b) => {
      // 1. Sort by custom academic priority (1 is highest/top of the page)
      const priorityA = getThesisPriority(a.axes);
      const priorityB = getThesisPriority(b.axes);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // 2. Fallback: Thesis Type (Doktora/PhD > Yüksek Lisans/Master)
      const getThesisTypeWeight = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes("doktora") || t.includes("phd") || t.includes("ph.d"))
          return 2;
        if (t.includes("yüksek lisans") || t.includes("master")) return 1;
        return 0;
      };
      const typeWeightA = getThesisTypeWeight(a.thesisType);
      const typeWeightB = getThesisTypeWeight(b.thesisType);
      if (typeWeightB !== typeWeightA) {
        return typeWeightB - typeWeightA;
      }

      // 3. Fallback: Year of publication (newer first)
      return (b.year || 0) - (a.year || 0);
    });
  }, [tezaraResults.overlapTable, tezaraResults.strategicRecommendations]);

  let badgeColor = "bg-success/10 border border-success/20 text-success";
  if (tezaraResults.originalityBadge === "HIGH_RISK") {
    badgeColor =
      "bg-destructive/10 border border-destructive/20 text-destructive";
  } else if (tezaraResults.originalityBadge === "MEDIUM_RISK") {
    badgeColor = "bg-warning/10 border border-warning/20 text-warning";
  } else if (tezaraResults.originalityBadge === "LOW_RISK") {
    badgeColor = "bg-sky-500/10 border border-sky-500/20 text-sky-400";
  }

  const riskLevel: "HIGH" | "MEDIUM" | "LOW" =
    tezaraResults.originalityBadge === "HIGH_RISK"
      ? "HIGH"
      : tezaraResults.originalityBadge === "MEDIUM_RISK"
        ? "MEDIUM"
        : "LOW";

  const handleProceed = () => {
    startTransition(async () => {
      try {
        const result = await completeRiskStageAction();
        if ("error" in result && result.error) {
          toast.error(result.error);
        } else {
          router.push("/onboarding/complete");
        }
      } catch {
        toast.error("Risk aşaması tamamlanırken beklenmeyen bir hata oluştu.");
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div className="space-y-2 text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Akademik Risk & Maddi Doğrulama Raporu</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Çalışmanızın internet üzerindeki maddi doğruluğu ile Tezara veri
            tabanındaki literatür çakışma riskleri.
          </p>
        </div>
        <div className="flex items-center self-end sm:self-center">
          <StartOverButton />
        </div>
      </div>

      {/* Badge & Overall status */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-card border border-border rounded-xl gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-lg font-semibold text-foreground">
            Genel Akademik Risk Seviyesi
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Asistanınızın literatür çakışmaları ve kuramsal yaklaşımlar
            üzerindeki nihai risk değerlendirmesi.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-3 rounded-full text-xs font-semibold tracking-wider ${badgeColor}`}
        >
          <Award className="w-5 h-5" />
          <span>
            {detailedStatusTranslation[tezaraResults.originalityBadge] ||
              tezaraResults.originalityBadge}
          </span>
        </div>
      </div>

      {/* Section A: Tavily Fact Checking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Maddi Doğrulama ve Bilgi Güvencesi
          </CardTitle>
          <CardDescription>
            Tez matrisindeki olgusal iddialar ve tarihsel verilerin arama motoru
            sonuçlarıyla doğrulanması.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted border border-border rounded-lg leading-relaxed text-sm text-muted-foreground whitespace-pre-line">
            <span className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Doğrulama Özeti ve Analiz Notu
            </span>
            {tavilyResults.briefingNote}
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="p-3 text-xs font-normal text-muted-foreground tracking-wider uppercase w-[300px]">
                    Sorgulanan İfade / Olay
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[280px]">
                    Doğrulama Sonucu
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                    Kaynak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tavilyResults.items?.map((item, idx) => {
                  const isKnownEnum = [
                    "VERIFIED",
                    "PARTIALLY_VERIFIED",
                    "REFUTED",
                  ].includes(item.result);

                  return (
                    <tr key={idx} className="hover:bg-muted transition-colors">
                      <td className="p-3 text-sm font-normal text-foreground leading-relaxed">
                        {item.fact}
                      </td>
                      <td className="p-3 text-left max-w-[320px]">
                        {isKnownEnum ? (
                          <div className="space-y-2">
                            <span
                              className={`inline-flex border px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${tavilyBadgeColor[item.result] ?? "bg-primary/10 border border-primary/20 text-primary"}`}
                            >
                              {tavilyStatusTranslation[item.result]}
                            </span>
                            {item.resultNote && (
                              <p className="text-zinc-300 font-light text-xs leading-relaxed">
                                {item.resultNote}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            {item.result}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary transition-colors font-medium text-xs"
                          >
                            Git <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Tezara Cross Literature comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <GitCompare className="w-5 h-5 text-primary" />
            Literatür Çakışma ve Karşılaştırma Matrisi (3 Eksen)
          </CardTitle>
          <CardDescription>
            Benzer akademik çalışmaların soru/sav, kuramsal çerçeve ve
            metodoloji eksenlerinde incelenmesi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase min-w-[240px]">
                    Karşılaştırılan Tez Bilgileri
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[110px]">
                    Soru / Sav
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[110px]">
                    Kuram
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[110px]">
                    Metodoloji
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[150px]">
                    Risk Seviyesi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tezaraResults.overlapTable?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground leading-relaxed text-sm"
                    >
                      Doğrudan çakışan veya yakın ilişki kuran herhangi bir tez
                      tespit edilmemiştir.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const getSubjectBadge = (val: string, level: string) => {
                      if (val === "OVERLAPPING") {
                        if (level === "HIGH_RISK") {
                          return {
                            className:
                              "bg-destructive/10 border border-destructive/20 text-destructive",
                            label: "Konu Kesişmesi",
                          };
                        }
                        return {
                          className:
                            "bg-warning/10 border border-warning/20 text-warning",
                          label: "Benzer Araştırma Odağı",
                        };
                      }
                      return {
                        className:
                          "bg-success/10 border border-success/20 text-success",
                        label: "Özgün Soru/Sav",
                      };
                    };

                    const getTheoryBadge = (val: string) => {
                      if (val === "OVERLAPPING") {
                        return {
                          className:
                            "bg-sky-500/10 border border-sky-500/20 text-sky-400",
                          label: "Ortak Kuramsal Perspektif",
                        };
                      }
                      return {
                        className:
                          "bg-success/10 border border-success/20 text-success",
                        label: "Özgün Kuram",
                      };
                    };

                    const getMethodologyBadge = (val: string) => {
                      if (val === "OVERLAPPING") {
                        return {
                          className:
                            "bg-sky-500/10 border border-sky-500/20 text-sky-400",
                          label: "Paralel Literatür",
                        };
                      }
                      return {
                        className:
                          "bg-success/10 border border-success/20 text-success",
                        label: "Özgün Metodoloji",
                      };
                    };

                    const getLevelBadge = (val: string) => {
                      if (val === "HIGH_RISK")
                        return "bg-destructive/10 border border-destructive/20 text-destructive";
                      if (val === "MEDIUM_RISK")
                        return "bg-warning/10 border border-warning/20 text-warning";
                      return "bg-sky-500/10 border border-sky-500/20 text-sky-400";
                    };

                    return (
                      <>
                        {sortedTheses.map((item, idx) => {
                          const subjectBadge = getSubjectBadge(
                            item.axes.subject,
                            item.originalityLevel,
                          );
                          const theoryBadge = getTheoryBadge(item.axes.theory);
                          const methodologyBadge = getMethodologyBadge(
                            item.axes.methodology,
                          );

                          return (
                            <Fragment key={item.id || idx}>
                              <tr
                                className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                                  expandedThesisId === item.id
                                    ? "bg-muted/20"
                                    : ""
                                }`}
                                onClick={() =>
                                  setExpandedThesisId(
                                    expandedThesisId === item.id
                                      ? null
                                      : item.id,
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
                                    {item.author} • {item.university} (
                                    {item.year})
                                  </div>
                                  <div className="pl-6 text-[11px] text-muted-foreground font-mono">
                                    {item.thesisType}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${subjectBadge.className}`}
                                  >
                                    {subjectBadge.label}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${theoryBadge.className}`}
                                  >
                                    {theoryBadge.label}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${methodologyBadge.className}`}
                                  >
                                    {methodologyBadge.label}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getLevelBadge(
                                      item.originalityLevel,
                                    )}`}
                                  >
                                    {statusTranslation[item.originalityLevel] ||
                                      item.originalityLevel}
                                  </span>
                                </td>
                              </tr>
                              {expandedThesisId === item.id &&
                                item.comparisonNote && (
                                  <tr className="bg-muted/10">
                                    <td
                                      colSpan={5}
                                      className="p-4 border-t border-border"
                                    >
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
                          );
                        })}
                      </>
                    );
                  })()
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations */}
      {riskLevel !== "LOW" && hasOriginalComparisonNotes && (
        <div className="p-6 bg-card border border-border rounded-xl space-y-3 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            Yol Haritası ve Akademik Tavsiyeler
          </h3>
          <div className="text-sm leading-loose text-foreground font-light whitespace-pre-line bg-muted p-4 border border-border rounded-lg">
            {tezaraResults.strategicRecommendations}
          </div>
        </div>
      )}

      {/* Action Footer */}
      {riskLevel === "HIGH" ? (
        <div className="flex justify-center">
          <StartOverButton variant="default" className="w-full md:w-auto" />
        </div>
      ) : riskLevel === "MEDIUM" ? (
        <div className="flex justify-end gap-3">
          <StartOverButton variant="outline" size="default" />
          <Button
            onClick={handleProceed}
            disabled={isPending}
            className="btn-academic-hero"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                İlerleniyor...
              </span>
            ) : (
              "Riskleri Göz Önünde Bulundurarak Devam Et"
            )}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={handleProceed}
            disabled={isPending}
            className="btn-academic-hero"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                İlerleniyor...
              </span>
            ) : (
              "Süreci Tamamla ve Sonraki Aşamaya Geç"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
