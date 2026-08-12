"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  Target,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JuryAnalysisResult } from "@/features/positioning/analysis";
import { PositioningMarkdownRenderer } from "./positioning-markdown-renderer";

interface PositioningReportViewProps {
  reportData: JuryAnalysisResult;
  onConfirm: () => void;
}

/**
 * Renders the full positioning gap analysis report including global status badge,
 * structured jury synthesis sections, and recommended thesis cards.
 *
 * @param root0 - The component props.
 * @param root0.reportData - The jury analysis result to display.
 * @param root0.onConfirm - Callback invoked when the user confirms the positioning.
 * @returns The rendered positioning report view.
 */
export function PositioningReportView({
  reportData,
  onConfirm,
}: PositioningReportViewProps) {
  const [confirming, setConfirming] = useState(false);
  const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
  const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Jüri Değerlendirme Sonucu
            </span>
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Akademik Konumlandırma & Özgün Katkı Raporu
            </h2>
          </div>

          <div>
            {isNovelGap && (
              <Badge className="bg-success/10 text-success border-success/20 px-3 py-2 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                Özgün Katkı / Akademik Boşluk Bulundu
              </Badge>
            )}
            {isDirectOverlap && (
              <Badge
                variant="destructive"
                className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-2 text-xs font-semibold flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                Doğrudan Çakışma Riski
              </Badge>
            )}
            {!isNovelGap && !isDirectOverlap && (
              <Badge className="bg-warning/10 text-warning border-warning/20 px-3 py-2 text-xs font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-warning shrink-0" />
                Sınırlı Literatür / Bağlam Genişletilmeli
              </Badge>
            )}
          </div>
        </div>

        {isNovelGap && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 inline-block mr-2 text-success shrink-0 align-text-top" />
            Çalışmanızın odağı, yöntemi ve kapsamı literatürdeki mevcut
            tezlerden belirgin biçimde ayrışmakta ve özgün bir akademik boşluk
            doldurmaktadır.
          </p>
        )}
        {isDirectOverlap && (
          <div className="p-4 rounded-md bg-destructive/5 border border-destructive/20 border-l-2 border-l-destructive">
            <p className="text-sm leading-relaxed text-card-foreground">
              <AlertTriangle className="h-4 w-4 inline-block mr-2 text-destructive shrink-0 align-text-top" />
              Çalışmanızın odağı literatürdeki mevcut tezlerle yüksek oranda
              çakışmaktadır. Jüri önerileri doğrultusunda teorik çerçeve veya
              yönteminizi güncellemeniz tavsiye edilir.
            </p>
          </div>
        )}
        {!isNovelGap && !isDirectOverlap && (
          <div className="p-4 rounded-md bg-warning/10 border border-warning/20 border-l-2 border-l-warning">
            <p className="text-sm leading-relaxed text-card-foreground">
              <HelpCircle className="h-4 w-4 inline-block mr-2 text-warning shrink-0 align-text-top" />
              Doğrudan eşleşen tez sayısı sınırlıdır. Kavramsal çerçevenizi veya
              arama sınırlarınızı genişleterek tekrar değerlendirebilirsiniz.
            </p>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Akademik Jüri Sentezi
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <PositioningMarkdownRenderer content={reportData.gapAnalysisSummary} />
      </div>

      {reportData.recommendedTheses &&
        reportData.recommendedTheses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Stratejik Rehber Tez Kartları (
                {reportData.recommendedTheses.length})
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportData.recommendedTheses.map((thesis, idx) => {
                const thesisId = thesis.externalThesisId || `thesis-${idx}`;
                return (
                  <Card
                    key={thesisId}
                    className="p-6 space-y-3 hover:border-border/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="font-sans text-sm font-medium text-foreground leading-snug">
                          {thesis.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {[thesis.author, thesis.year, thesis.university]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      {thesis.doi && (
                        <a
                          href={
                            thesis.doi.startsWith("http")
                              ? thesis.doi
                              : `https://doi.org/${thesis.doi}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0 self-start"
                        >
                          DOI <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {(thesis.contributionArea || thesis.relevanceReason) && (
                      <div className="space-y-3 pt-3 border-t border-border/40 text-xs">
                        <div className="space-y-1">
                          <span className="flex items-center gap-2 font-semibold text-primary">
                            <Target className="h-3.5 w-3.5 shrink-0" />
                            Katkı / Odak Alanı:
                          </span>
                          <span className="text-foreground leading-relaxed block">
                            {thesis.contributionArea || (
                              <span className="text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="border-t border-border/40" />

                        <div className="space-y-1">
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                            İlişki ve Ayrışma Sebebi:
                          </span>
                          <span className="text-muted-foreground leading-relaxed block">
                            {thesis.relevanceReason || (
                              <span className="text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

      <div className="flex justify-end mt-8 pb-8">
        <Button
          type="button"
          size="lg"
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full sm:w-auto font-semibold"
        >
          {confirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Onayla ve Konu Kutuları Adımına Geç
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
