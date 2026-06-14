"use client";

import { useTransition, useMemo, useState, Fragment, useEffect } from "react";
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
import { generateBoxesForCurrentMatrixAction } from "../actions";
import { getThesisPriority } from "@/app/(auth)/onboarding/risk/_services/risk-calc";

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
  HIGH_RISK: "YÜKSEK",
  MEDIUM_RISK: "ORTA",
  LOW_RISK: "DÜŞÜK",
  ZERO_RISK: "ORİJİNAL",
  OVERLAPPING: "ORTAK",
  ORIGINAL: "ÖZGÜN",
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const loadingMessages = [
    "Tez matrisi ve araştırma tasarımı çözümleniyor...",
    "Akademik konu kutuları yapılandırılıyor...",
    "Kavramlar ve teorisyenler Wikipedia üzerinden doğrulanıyor...",
    "Hiyerarşik düzen ve alt kutular oluşturuluyor...",
    "Son düzenlemeler yapılıyor ve kaydediliyor...",
  ];

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) =>
        prev < loadingMessages.length - 1 ? prev + 1 : prev,
      );
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

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
    setIsGenerating(true);
    startTransition(async () => {
      try {
        const result = await generateBoxesForCurrentMatrixAction();
        if ("error" in result && result.error) {
          toast.error(result.error);
          setIsGenerating(false);
        } else {
          router.push("/onboarding/boxes");
        }
      } catch {
        toast.error(
          "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
        );
        setIsGenerating(false);
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
            {statusTranslation[tezaraResults.originalityBadge] ||
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
            Literatür Çakışma ve Karşılaştırma Matrisi (4 Eksen)
          </CardTitle>
          <CardDescription>
            Benzer akademik çalışmaların konu, kuramsal çerçeve, metodoloji ve
            bağlam eksenlerinde incelenmesi.
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
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                    Konu
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                    Teori
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                    YÖNTEM
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[80px]">
                    DÖNEM
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[90px]">
                    RİSK SEVİYESİ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tezaraResults.overlapTable?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-muted-foreground leading-relaxed text-sm"
                    >
                      Doğrudan çakışan veya yakın ilişki kuran herhangi bir tez
                      tespit edilmemiştir.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const getAxisBadge = (val: string) => {
                      if (val === "OVERLAPPING")
                        return "bg-red-950 text-red-400 border border-red-800";
                      return "bg-emerald-950 text-emerald-400 border border-emerald-800";
                    };

                    const getLevelBadge = (val: string) => {
                      if (val === "HIGH_RISK")
                        return "bg-red-950 text-red-400 border border-red-800";
                      if (val === "MEDIUM_RISK")
                        return "bg-amber-950 text-amber-400 border border-amber-800";
                      return "bg-emerald-950 text-emerald-400 border border-emerald-800";
                    };

                    return (
                      <>
                        {sortedTheses.map((item, idx) => (
                          <Fragment key={item.id || idx}>
                            <tr
                              className={`hover:bg-muted/40 cursor-pointer transition-colors ${
                                expandedThesisId === item.id
                                  ? "bg-muted/20"
                                  : ""
                              }`}
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
                                  {item.author} • {item.university} ({item.year}
                                  )
                                </div>
                                <div className="pl-6 text-[11px] text-muted-foreground font-mono">
                                  {item.thesisType}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(
                                    item.axes.subject,
                                  )}`}
                                >
                                  {statusTranslation[item.axes.subject] ||
                                    item.axes.subject}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(
                                    item.axes.theory,
                                  )}`}
                                >
                                  {statusTranslation[item.axes.theory] ||
                                    item.axes.theory}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(
                                    item.axes.methodology,
                                  )}`}
                                >
                                  {statusTranslation[item.axes.methodology] ||
                                    item.axes.methodology}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(
                                    item.axes.context || "ORIGINAL",
                                  )}`}
                                >
                                  {statusTranslation[
                                    item.axes.context || "ORIGINAL"
                                  ] || item.axes.context}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-flex px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${getLevelBadge(
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
                                    colSpan={6}
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
                        ))}
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
            disabled={isPending || isGenerating}
            className="btn-academic-hero"
          >
            {isPending || isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4" />
                Hazırlanıyor...
              </span>
            ) : (
              "Analizi Onayla ve Konu Kutularını Oluştur"
            )}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={handleProceed}
            disabled={isPending || isGenerating}
            className="btn-academic-hero"
          >
            {isPending || isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4" />
                Hazırlanıyor...
              </span>
            ) : (
              "Analizi Onayla ve Konu Kutularını Oluştur"
            )}
          </Button>
        </div>
      )}

      {/* Box Creation Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md transition-all duration-300">
          <div className="max-w-md w-full px-6 text-center space-y-6">
            {/* Spinning Indicator */}
            <div className="relative flex items-center justify-center mx-auto w-16 h-16 bg-primary/10 border border-primary/20 rounded-full">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>

            {/* Current step text */}
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground tracking-tight">
                Konu Kutuları Yapılandırılıyor
              </h3>
              <p className="text-sm text-muted-foreground min-h-[40px] leading-relaxed transition-all duration-300">
                {loadingMessages[currentStep]}
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex justify-center items-center gap-1.5 pt-2">
              {loadingMessages.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "w-8 bg-primary"
                      : idx < currentStep
                        ? "w-2 bg-primary/40"
                        : "w-2 bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
