"use client";

import { useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Award,
  FileText,
  ExternalLink,
  GitCompare,
  Compass,
  Loader2,
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
        result: string;
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
          subject: "OVERLAPPING" | "PARTIAL" | "ORIGINAL";
          theory: "OVERLAPPING" | "PARTIAL" | "ORIGINAL";
          methodology: "OVERLAPPING" | "PARTIAL" | "ORIGINAL";
          context: "OVERLAPPING" | "PARTIAL" | "ORIGINAL";
        };
        originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
      }[];
      strategicRecommendations: string;
    };
  };
}

const statusTranslation: Record<string, string> = {
  HIGH_RISK: "YÜKSEK RİSK",
  MEDIUM_RISK: "ORTA RİSK",
  LOW_RISK: "DÜŞÜK RİSK",
  ZERO_RISK: "SIFIR RİSK",
  OVERLAPPING: "ÇAKIŞIYOR",
  PARTIAL: "KISMEN",
  ORIGINAL: "ÖZGÜN",
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

  const { tavilyResults, tezaraResults } = reportData;

  let badgeColor = "bg-primary text-primary-foreground border border-primary";
  if (tezaraResults.originalityBadge === "HIGH_RISK") {
    badgeColor =
      "bg-destructive text-destructive-foreground border border-destructive";
  } else if (tezaraResults.originalityBadge === "MEDIUM_RISK") {
    badgeColor = "bg-accent text-accent-foreground border border-accent";
  } else if (tezaraResults.originalityBadge === "ZERO_RISK") {
    badgeColor = "bg-primary text-primary-foreground border-2 border-primary";
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
          className={`flex items-center gap-2 px-6 py-3 rounded-full text-base font-semibold tracking-wider ${badgeColor}`}
        >
          <Award className="w-5 h-5 animate-pulse" />
          <span>
            {statusTranslation[tezaraResults.originalityBadge] ||
              tezaraResults.originalityBadge}
          </span>
        </div>
      </div>

      {/* Section A: Tavily Fact Checking */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Maddi Doğrulama ve Bilgi Güvencesi
          </CardTitle>
          <CardDescription className="text-xs">
            Tez matrisindeki olgusal iddialar ve tarihsel verilerin arama motoru
            sonuçlarıyla doğrulanması.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted border border-border rounded-lg leading-relaxed text-sm text-foreground whitespace-pre-line">
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
                  let tagClass = "text-primary";
                  if (item.result.toLowerCase().includes("kısmen")) {
                    tagClass = "text-accent";
                  } else if (
                    item.result.toLowerCase().includes("doğrulanamadı") ||
                    item.result.toLowerCase().includes("dikkat")
                  ) {
                    tagClass = "text-destructive";
                  }

                  return (
                    <tr key={idx} className="hover:bg-muted transition-colors">
                      <td className="p-3 text-sm font-normal text-foreground leading-relaxed">
                        {item.fact}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${tagClass}`}
                        >
                          {item.result}
                        </span>
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
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <GitCompare className="w-5 h-5 text-primary" />
            Literatür Çakışma ve Karşılaştırma Matrisi (4 Eksen)
          </CardTitle>
          <CardDescription className="text-xs">
            Benzer akademik çalışmaların konu, kuramsal çerçeve, metodoloji ve
            bağlam eksenlerinde incelenmesi.
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
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                    Konu
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                    Teori
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                    Metodoloji
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[100px]">
                    Bağlam
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
                        return "bg-destructive text-destructive-foreground border border-destructive";
                      if (val === "PARTIAL")
                        return "bg-accent text-accent-foreground border border-accent";
                      return "bg-primary text-primary-foreground border border-primary";
                    };

                    const getLevelBadge = (val: string) => {
                      if (val === "HIGH_RISK")
                        return "bg-destructive text-destructive-foreground border border-destructive";
                      if (val === "MEDIUM_RISK")
                        return "bg-accent text-accent-foreground border border-accent";
                      return "bg-primary text-primary-foreground border border-primary";
                    };

                    const sorted = useMemo(() => {
                      if (!tezaraResults.overlapTable) return [];
                      return [...tezaraResults.overlapTable].sort((a, b) => {
                        const countOverlap = (item: typeof a) =>
                          [
                            item.axes.subject,
                            item.axes.theory,
                            item.axes.methodology,
                            item.axes.context,
                          ].filter((v) => v === "OVERLAPPING").length;
                        return countOverlap(b) - countOverlap(a);
                      });
                    }, [tezaraResults.overlapTable]);

                    return (
                      <>
                        {sorted.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-muted transition-colors"
                          >
                            <td className="p-3 space-y-1">
                              <div className="font-semibold text-foreground text-sm leading-relaxed">
                                {item.title}
                              </div>
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                {item.author} • {item.university} ({item.year})
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {item.thesisType}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.subject)}`}
                              >
                                {statusTranslation[item.axes.subject] ||
                                  item.axes.subject}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.theory)}`}
                              >
                                {statusTranslation[item.axes.theory] ||
                                  item.axes.theory}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.methodology)}`}
                              >
                                {statusTranslation[item.axes.methodology] ||
                                  item.axes.methodology}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.context)}`}
                              >
                                {statusTranslation[item.axes.context] ||
                                  item.axes.context}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getLevelBadge(item.originalityLevel)}`}
                              >
                                {statusTranslation[item.originalityLevel] ||
                                  item.originalityLevel}
                              </span>
                            </td>
                          </tr>
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
      {riskLevel !== "LOW" && (
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
        <div className="flex justify-center pt-4">
          <StartOverButton variant="default" className="w-full md:w-auto" />
        </div>
      ) : riskLevel === "MEDIUM" ? (
        <div className="flex justify-end gap-3 pt-4">
          <StartOverButton variant="outline" />
          <Button
            onClick={handleProceed}
            disabled={isPending}
            className="px-8 py-6 text-base font-semibold"
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
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleProceed}
            disabled={isPending}
            className="px-8 py-6 text-base font-semibold"
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
