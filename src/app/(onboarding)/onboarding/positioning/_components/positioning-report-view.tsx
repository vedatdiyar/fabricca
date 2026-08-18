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
  Calendar,
  User,
  GraduationCap,
  Layers,
  GitFork,
  History,
  BookOpen,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JuryAnalysisResult } from "@/app/(onboarding)/onboarding/positioning/_services/analysis";
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
      {/* 1. Global Jury Evaluation Status Banner */}
      <Card
        className={cn(
          "rounded-md border transition-all",
          isNovelGap
            ? "bg-success/10 border-success/20"
            : isDirectOverlap
              ? "bg-destructive/10 border-destructive/20"
              : "bg-warning/10 border-warning/20",
        )}
      >
        <CardContent className="p-4 sm:p-6 flex items-start gap-4">
          <div
            className={cn(
              "p-2.5 rounded-md shrink-0 border",
              isNovelGap
                ? "bg-background/80 text-success border-success/20"
                : isDirectOverlap
                  ? "bg-background/80 text-destructive border-destructive/20"
                  : "bg-background/80 text-warning border-warning/20",
            )}
          >
            {isNovelGap && <CheckCircle2 className="h-5 w-5" />}
            {isDirectOverlap && <AlertTriangle className="h-5 w-5" />}
            {!isNovelGap && !isDirectOverlap && (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <span className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
        </CardContent>
      </Card>

      {/* 2. Structured Academic Jury Synthesis */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/40" />
          <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Akademik Jüri Sentezi
          </h4>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        <PositioningMarkdownRenderer content={reportData.gapAnalysisSummary} />
      </div>

      {/* 3. Strategic Guide Thesis Cards */}
      {reportData.recommendedTheses &&
        reportData.recommendedTheses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stratejik Rehber Tez Kartları (
                {reportData.recommendedTheses.length})
              </h4>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
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

      {/* 4. Action Confirmation Button */}
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

const STRATEGIC_ROLE_CONFIG = {
  BROAD_CONTEXT: {
    label: "Geniş Çerçeve (Makro Zemin)",
    className: "bg-primary/10 text-primary border-primary/20",
    icon: Layers,
  },
  SPECIFIC_FOCUS: {
    label: "Kısmi Odak (Çapraz Doğrulama)",
    className: "bg-info/10 text-info border-info/20",
    icon: GitFork,
  },
  FOUNDATIONAL_WORK: {
    label: "Öncül Çalışma (Tarihsel Kökler)",
    className: "bg-accent text-accent-foreground border-accent-foreground/20",
    icon: History,
  },
  METHODOLOGICAL_BENCHMARK: {
    label: "Yöntem Rehberi (Model Kıyası)",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: BookOpen,
  },
  ALTERNATIVE_PERSPECTIVE: {
    label: "Karşıt Yaklaşım (Eleştirel Tartışma)",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: Lightbulb,
  },
} as const;

/**
 * Renders a rich academic guide thesis card with clean visual hierarchy,
 * metadata badges, strategic role highlights, and literature positioning notes.
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

  const roleConfig =
    thesis.strategicRole &&
    (thesis.strategicRole as keyof typeof STRATEGIC_ROLE_CONFIG) in
      STRATEGIC_ROLE_CONFIG
      ? STRATEGIC_ROLE_CONFIG[
          thesis.strategicRole as keyof typeof STRATEGIC_ROLE_CONFIG
        ]
      : STRATEGIC_ROLE_CONFIG.SPECIFIC_FOCUS;
  const RoleIcon = roleConfig.icon;

  return (
    <Card className="rounded-md border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between h-full group overflow-hidden">
      {/* Header & Meta Information */}
      <CardHeader className="p-4 pb-3 space-y-2.5 border-b border-border/40 shrink-0">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                roleConfig.className,
              )}
            >
              <RoleIcon className="h-3 w-3 shrink-0" />
              {roleConfig.label}
            </span>
          </div>

          {/* Right Meta Group: Degree + Year + DOI */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {thesis.thesisType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground border border-border">
                {thesis.thesisType}
              </span>
            )}
            {thesis.year && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/40">
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
                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
              >
                DOI <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Academic Title */}
        <div className="space-y-1">
          <CardTitle className="font-serif text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {titleMain}
          </CardTitle>
          {titleTranslation && (
            <p className="text-xs italic text-muted-foreground leading-relaxed">
              {titleTranslation}
            </p>
          )}
        </div>

        {/* Author and Institution Info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground pt-1">
          {thesis.author && (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-primary shrink-0" />
              {thesis.author}
            </span>
          )}
          {thesis.university && (
            <span
              className="inline-flex items-center gap-1.5 text-muted-foreground leading-snug"
              title={thesis.university}
            >
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{thesis.university}</span>
            </span>
          )}
        </div>
      </CardHeader>

      {/* 3 Structured Sub-Cards with Uniform Stability */}
      <CardContent className="p-4 space-y-2.5 flex-1 flex flex-col justify-start">
        {/* 1. Literatür Konumu */}
        {thesis.literaturePosition && (
          <div className="rounded-md bg-background/50 border border-border/50 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-sans text-xs font-semibold text-foreground">
                Literatür Konumu
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              {thesis.literaturePosition}
            </p>
          </div>
        )}

        {/* 2. Tezinizdeki Stratejik Rolü & Katkı */}
        {thesis.relevanceReason && (
          <div className="rounded-md bg-background/50 border border-primary/20 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-sans text-xs font-semibold text-foreground">
                Tezinizdeki Stratejik Rolü & Katkı
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              {thesis.relevanceReason}
            </p>
          </div>
        )}

        {/* 3. Odak Alanı */}
        {thesis.contributionArea && (
          <div className="rounded-md bg-background/50 border border-border/50 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-sans text-xs font-semibold text-foreground">
                Odak Alanı
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              {thesis.contributionArea}
            </p>
          </div>
        )}
      </CardContent>

      {/* Footer: Guide Index */}
      <CardFooter className="px-4 py-2 bg-background/30 border-t border-border/40 flex items-center justify-between gap-2 text-xs shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Rehber Kaynak #{index + 1}
        </span>
      </CardFooter>
    </Card>
  );
}
