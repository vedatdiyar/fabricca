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
  Sparkles,
  Calendar,
  User,
  GraduationCap,
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
      <Card
        className={`p-4 transition-colors ${
          isNovelGap
            ? "bg-success/5 border-success/20"
            : isDirectOverlap
              ? "bg-destructive/5 border-destructive/20"
              : "bg-warning/5 border-warning/20"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2 rounded-md shrink-0 ${
              isNovelGap
                ? "bg-success/10 text-success"
                : isDirectOverlap
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning"
            }`}
          >
            {isNovelGap && <CheckCircle2 className="h-4 w-4" />}
            {isDirectOverlap && <AlertTriangle className="h-4 w-4" />}
            {!isNovelGap && !isDirectOverlap && (
              <HelpCircle className="h-4 w-4" />
            )}
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Jüri Değerlendirme Sonucu
              </span>
              {isNovelGap && (
                <Badge className="bg-success/10 text-success border-success/20 px-2.5 py-0.5 text-xs font-semibold">
                  Özgün Katkı Bulundu
                </Badge>
              )}
              {isDirectOverlap && (
                <Badge
                  variant="destructive"
                  className="bg-destructive/10 text-destructive border-destructive/20 px-2.5 py-0.5 text-xs font-semibold"
                >
                  Doğrudan Çakışma Riski
                </Badge>
              )}
              {!isNovelGap && !isDirectOverlap && (
                <Badge className="bg-warning/10 text-warning border-warning/20 px-2.5 py-0.5 text-xs font-semibold">
                  Sınırlı Literatür
                </Badge>
              )}
            </div>

            <p className="text-sm leading-relaxed text-foreground">
              {isNovelGap &&
                "Çalışmanızın odağı, yöntemi ve kapsamı literatürdeki mevcut tezlerden belirgin biçimde ayrışmakta ve özgün bir akademik boşluk doldurmaktadır."}
              {isDirectOverlap &&
                "Çalışmanızın odağı literatürdeki mevcut tezlerle yüksek oranda çakışmaktadır. Jüri önerileri doğrultusunda teorik çerçeve veya yönteminizi güncellemeniz tavsiye edilir."}
              {!isNovelGap &&
                !isDirectOverlap &&
                "Doğrudan eşleşen tez sayısı sınırlıdır. Kavramsal çerçevenizi veya arama sınırlarınızı genişleterek tekrar değerlendirebilirsiniz."}
            </p>
          </div>
        </div>
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
              {reportData.recommendedTheses.map((thesis, idx) => (
                <RecommendedThesisCard
                  key={thesis.externalThesisId || `thesis-${idx}`}
                  thesis={thesis}
                  index={idx}
                />
              ))}
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

interface RecommendedThesisCardProps {
  thesis: NonNullable<JuryAnalysisResult["recommendedTheses"]>[number];
  index: number;
}

/**
 * Renders a rich academic guide thesis card with clean visual hierarchy,
 * metadata badges, contribution highlights, and strategic relevance notes.
 *
 * @param root0 - The component props.
 * @param root0.thesis - The recommended thesis data object.
 * @param root0.index - The 0-based index of the thesis in the list.
 * @returns The rendered thesis card.
 */
function RecommendedThesisCard({ thesis, index }: RecommendedThesisCardProps) {
  const separatorIndex = thesis.title.indexOf(" / ");
  const titleMain =
    separatorIndex === -1
      ? thesis.title
      : thesis.title.slice(0, separatorIndex).trim();
  const titleTranslation =
    separatorIndex === -1
      ? null
      : thesis.title.slice(separatorIndex + 3).trim();

  return (
    <Card className="rounded-md border border-border bg-card p-5 hover:border-primary/30 transition-all flex flex-col justify-between space-y-4">
      {/* Header & Meta Information */}
      <div className="space-y-3">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-primary/10 border-primary/20 text-primary uppercase tracking-wider">
              <Sparkles className="h-3 w-3 shrink-0" />
              Rehber Kaynak #{index + 1}
            </span>
            {thesis.thesisType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border bg-muted text-muted-foreground border-border">
                {thesis.thesisType}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {thesis.year && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                <Calendar className="h-3 w-3" />
                {thesis.year}
              </span>
            )}
            {thesis.doi && (
              <a
                href={
                  thesis.doi.startsWith("http")
                    ? thesis.doi
                    : `https://doi.org/${thesis.doi}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                DOI <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Academic Title */}
        <div className="space-y-1">
          <h4 className="font-sans text-sm font-semibold text-foreground leading-snug tracking-tight">
            {titleMain}
          </h4>
          {titleTranslation && (
            <p className="text-xs italic text-muted-foreground leading-relaxed">
              {titleTranslation}
            </p>
          )}
        </div>

        {/* Author and Institution Info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
          {thesis.author && (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {thesis.author}
            </span>
          )}
          {thesis.university && (
            <span
              className="inline-flex items-center gap-1.5 text-muted-foreground truncate"
              title={thesis.university}
            >
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{thesis.university}</span>
            </span>
          )}
        </div>
      </div>

      {/* Analysis Sections (Katkı & Ayrışma) */}
      {(thesis.contributionArea || thesis.relevanceReason) && (
        <div className="space-y-2.5 pt-1">
          {/* Katkı / Odak Alanı Block */}
          {thesis.contributionArea && (
            <div className="rounded-md bg-primary/[0.04] border border-primary/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span>Katkı / Odak Alanı</span>
              </div>
              <p className="text-xs font-medium text-foreground leading-relaxed pl-5">
                {thesis.contributionArea}
              </p>
            </div>
          )}

          {/* İlişki ve Ayrışma Sebebi Block */}
          {thesis.relevanceReason && (
            <div className="rounded-md bg-muted/30 border border-border/40 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0" />
                <span>İlişki ve Ayrışma Sebebi</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                {thesis.relevanceReason}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
