"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { splitBilingualTitle } from "@/lib/academic/title-utils";
import type { JuryAnalysisResult } from "../../_services/analysis";

interface ReportOverlapSectionProps {
  gapSummary: JuryAnalysisResult["gapAnalysisSummary"];
}

/**
 * Renders direct overlap gatekeeper report with anatomical breakdown.
 *
 * @param props - Overlap section props.
 * @returns Overlap markup.
 */
export function ReportOverlapSection({
  gapSummary,
}: ReportOverlapSectionProps) {
  const router = useRouter();
  const overlappingWorks = gapSummary?.overlappingWorks ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/10 p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive shrink-0" />
          <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Akademik Özgünlük Engeli ve Jüri Çakışma Tutanağı
          </h3>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30">
          Yeniden Kurgulanmalı
        </span>
      </div>

      <p className="text-sm font-normal leading-relaxed text-muted-foreground">
        Aşağıda tespit edilen emsal çalışma(lar) ile araştırma sorunsalınız,
        kuramsal omurganız veya yöntemsel deseniniz arasında doğrudan çakışma
        belirlenmiştir. Akademik özgünlük kuralı gereği, çalışmanız bu haliyle
        bir sonraki aşamaya geçirilemez.
      </p>

      {overlappingWorks.length > 0 && (
        <div className="space-y-3">
          {overlappingWorks.map((work, i) => {
            const { mainTitle, secondaryTitle } = splitBilingualTitle(
              work.title,
            );
            return (
              <div
                key={`overlap-${i}`}
                className="p-4 rounded-md border border-destructive/20 bg-background/90 space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                      Emsal Eser #{i + 1} ({work.sourceType || "Tez"})
                    </span>
                    <h4 className="font-serif text-sm font-semibold leading-snug text-foreground">
                      {mainTitle}
                    </h4>
                    {secondaryTitle && (
                      <p className="font-serif text-xs italic text-muted-foreground leading-relaxed">
                        {secondaryTitle}
                      </p>
                    )}
                  </div>
                  {work.year && (
                    <span className="font-mono text-xs text-muted-foreground shrink-0 px-2 py-0.5 rounded bg-muted">
                      {work.year}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {work.author && (
                    <span>
                      <span className="font-medium text-foreground">
                        Araştırmacı:
                      </span>{" "}
                      {work.author}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-border/50 space-y-2.5">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                    Yapısal Çakışma Anatomisi
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-md bg-secondary/50 border border-border/60 space-y-1">
                      <span className="text-xs font-medium text-destructive block">
                        1. Problem & Sorunsal Çakışması
                      </span>
                      <p className="text-xs font-normal leading-relaxed text-foreground">
                        {work.problemOverlap ||
                          "Araştırma sorusu ve odak noktası emsal çalışmanın ampirik kapsamıyla doğrudan örtüşmektedir."}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-secondary/50 border border-border/60 space-y-1">
                      <span className="text-xs font-medium text-destructive block">
                        2. Kuramsal Çerçeve Çakışması
                      </span>
                      <p className="text-xs font-normal leading-relaxed text-foreground">
                        {work.theoryOverlap ||
                          "Emsal çalışmayla aynı teorik kavramlar ve kuramsal modeller benimsenmiştir."}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-secondary/50 border border-border/60 space-y-1">
                      <span className="text-xs font-medium text-destructive block">
                        3. Yöntemsel Desen Çakışması
                      </span>
                      <p className="text-xs font-normal leading-relaxed text-foreground">
                        {work.methodologyOverlap ||
                          "Veri toplama araçları, araştırma deseni ve saha odağı emsal çalışma ile benzerlik taşımaktadır."}
                      </p>
                    </div>
                  </div>
                </div>

                {work.reason && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-foreground space-y-0.5">
                    <span className="font-semibold text-destructive block">
                      Jüri Ret Tutanağı Özeti:
                    </span>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {work.reason}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-primary shrink-0" />
            Araştırmacının Akademik Sorumluluğu
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Akademik özgünlük yüzeysel değişikliklerle veya tek tıkla
            sağlanamaz. Tezinizi emsal çalışmanın gölgesinden çıkarıp literatüre
            yeni bir katkı sunmak için araştırma probleminizi, kuramsal
            merceğinizi veya yöntemsel yaklaşımınızı baştan yapılandırmanız
            gerekmektedir.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">
            Taslağınızı bu eleştiriler ışığında revize etmek için taslak
            stüdyosuna dönün:
          </span>
          <Button
            onClick={() => router.push("/onboarding/proposal")}
            size="default"
          >
            <RefreshCw className="size-4" />
            <span>Taslağı Yeniden Düzenle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
