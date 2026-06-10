"use client";

import { useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

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
      originalityBadge:
        | "YÜKSEK RİSK"
        | "ORTA RİSK"
        | "DÜŞÜK RİSK"
        | "SIFIR RİSK";
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: {
          subject: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          theory: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          methodology: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          context: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
        };
        originalityLevel: "YÜKSEK RİSK" | "ORTA RİSK" | "DÜŞÜK RİSK";
      }[];
      strategicRecommendations: string;
    };
  };
}

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

  let badgeColor = "bg-emerald-950 text-emerald-400 border border-emerald-800"; // Düşük Risk
  if (tezaraResults.originalityBadge === "YÜKSEK RİSK") {
    badgeColor = "bg-red-950 text-red-400 border border-red-800";
  } else if (tezaraResults.originalityBadge === "ORTA RİSK") {
    badgeColor = "bg-amber-950 text-amber-400 border border-amber-800";
  } else if (tezaraResults.originalityBadge === "SIFIR RİSK") {
    badgeColor = "bg-emerald-950 text-emerald-300 border-2 border-emerald-600";
  }

  const handleNext = () => {
    startTransition(() => {
      router.push("/onboarding/complete");
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
          <span>Akademik Risk & Maddi Doğrulama Raporu</span>
        </h1>
        <p className="text-muted-foreground leading-relaxed text-sm">
          Çalışmanızın internet üzerindeki maddi doğruluğu ile Tezara veri
          tabanındaki literatür çakışma riskleri.
        </p>
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
          className={`flex items-center gap-2 px-6 py-3 rounded-full text-base font-bold tracking-wider ${badgeColor}`}
        >
          <Award className="w-5 h-5 animate-pulse" />
          <span>{tezaraResults.originalityBadge}</span>
        </div>
      </div>

      {/* Section A: Tavily Fact Checking */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Maddi Doğrulama ve Bilgi Güvencesi (Tavily)
          </CardTitle>
          <CardDescription className="text-xs">
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
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase min-w-[200px]">
                    Sorgulanan İfade / Olay
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[180px]">
                    Doğrulama Sonucu
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[120px]">
                    Kaynak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tavilyResults.items?.map((item, idx) => {
                  let tagClass =
                    "bg-emerald-950 text-emerald-400 border border-emerald-800";
                  if (item.result.toLowerCase().includes("kısmen")) {
                    tagClass =
                      "bg-amber-950 text-amber-400 border border-amber-800";
                  } else if (
                    item.result.toLowerCase().includes("doğrulanamadı") ||
                    item.result.toLowerCase().includes("dikkat")
                  ) {
                    tagClass = "bg-red-950 text-red-400 border border-red-800";
                  }

                  return (
                    <tr key={idx} className="hover:bg-muted transition-colors">
                      <td className="p-3 text-sm font-medium text-foreground leading-relaxed">
                        {item.fact}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${tagClass}`}
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
                            className="inline-flex items-center gap-1 text-primary hover:text-emerald-400 transition-colors font-medium text-xs"
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
                  <th className="p-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase text-center w-[120px]">
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
                  tezaraResults.overlapTable?.map((item, idx) => {
                    const getAxisBadge = (val: string) => {
                      if (val === "ÇAKIŞIYOR")
                        return "bg-red-950 text-red-400 border border-red-800";
                      if (val === "KISMEN")
                        return "bg-amber-950 text-amber-400 border border-amber-800";
                      return "bg-emerald-950 text-emerald-400 border border-emerald-800"; // ÖZGÜN
                    };

                    const getLevelBadge = (val: string) => {
                      if (val === "YÜKSEK RİSK")
                        return "bg-red-950 text-red-400 border border-red-800";
                      if (val === "ORTA RİSK")
                        return "bg-amber-950 text-amber-400 border border-amber-800";
                      return "bg-emerald-950 text-emerald-400 border border-emerald-800"; // DÜŞÜK RİSK
                    };

                    return (
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
                            {item.thesisType} • {item.department}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.subject)}`}
                          >
                            {item.axes.subject}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.theory)}`}
                          >
                            {item.axes.theory}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.methodology)}`}
                          >
                            {item.axes.methodology}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getAxisBadge(item.axes.context)}`}
                          >
                            {item.axes.context}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getLevelBadge(item.originalityLevel)}`}
                          >
                            {item.originalityLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations */}
      <div className="p-6 bg-card border border-border rounded-xl space-y-3 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          Yol Haritası ve Akademik Tavsiyeler
        </h3>
        <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-muted p-4 border border-border rounded-lg">
          {tezaraResults.strategicRecommendations}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleNext}
          disabled={isPending}
          className="px-8 py-6 text-base font-semibold"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              İlerleniyor...
            </span>
          ) : (
            "Devam Et"
          )}
        </Button>
      </div>
    </div>
  );
}
