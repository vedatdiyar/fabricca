"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Target,
  Loader2,
  Calendar,
  User,
  GraduationCap,
  Layers,
  GitFork,
  BookOpen,
  Compass,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import { splitBilingualTitle } from "@/lib/academic/title-utils";
import type { JuryAnalysisResult } from "../_services/analysis";
import type { StrategicRole } from "../_services/validation";
import { PositioningMarkdownRenderer } from "./positioning-markdown-renderer";

interface PositioningReportViewProps {
  reportData: JuryAnalysisResult;
  onConfirm: () => void;
}

const ROLE_SORT_PRIORITY: Record<StrategicRole, number> = {
  FOUNDATIONAL_WORK: 1,
  METHODOLOGICAL_BENCHMARK: 2,
  SPECIFIC_FOCUS: 3,
  ALTERNATIVE_PERSPECTIVE: 4,
};

function getRoleSortPriority(role?: StrategicRole): number {
  if (!role) return 5;
  return ROLE_SORT_PRIORITY[role] ?? 5;
}

/**
 * Returns a human-friendly Turkish label and color configuration for each strategic role.
 *
 * @param role - The strategic role assigned by the academic evaluation.
 * @returns Label, icon, and styling classes.
 */
function getRoleBadgeConfig(role?: StrategicRole) {
  switch (role) {
    case "FOUNDATIONAL_WORK":
      return {
        label: "Öncül Çalışma",
        description: "Temel Kuramsal / Kavramsal Çerçeve Referansı",
        icon: BookOpen,
      };
    case "METHODOLOGICAL_BENCHMARK":
      return {
        label: "Yöntem Referansı",
        description: "Metodolojik Model ve Saha Referansı",
        icon: GitFork,
      };
    case "SPECIFIC_FOCUS":
      return {
        label: "Kısmi Odak",
        description: "Spesifik Alt Boyut veya Yakın Vaka",
        icon: Target,
      };
    case "ALTERNATIVE_PERSPECTIVE":
      return {
        label: "Karşıt / Alternatif Yaklaşım",
        description: "Farklı Kuramsal Eksen veya Zıt Bulgular",
        icon: Layers,
      };
    default:
      return {
        label: "Kılavuz Literatür",
        description: "İlgili Literatür Kaynağı",
        icon: Compass,
      };
  }
}

/**
 * Renders the comprehensive positioning gap analysis report following onboarding design standards.
 */
export function PositioningReportView({
  reportData,
  onConfirm,
}: PositioningReportViewProps) {
  const [confirming, setConfirming] = useState(false);
  const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
  const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";

  const sortedTheses = [...reportData.recommendedTheses].sort((a, b) => {
    const priorityA = getRoleSortPriority(a.strategicRole);
    const priorityB = getRoleSortPriority(b.strategicRole);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return (b.year || 0) - (a.year || 0);
  });

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
      {/* 1. Global Jury Evaluation Status Banner (Standard Central AIBanner) */}
      <AIBanner
        icon={
          isNovelGap
            ? CheckCircle2
            : isDirectOverlap
              ? AlertTriangle
              : HelpCircle
        }
        variant={
          isNovelGap ? "success" : isDirectOverlap ? "warning" : "info"
        }
        title={
          isNovelGap
            ? "Özgün Katkı: Belirgin Bir Literatür Boşluğu Tespit Edildi"
            : isDirectOverlap
              ? "Dikkat: Birebir Çakışan Tamamlanmış Tez Tespit Edildi"
              : "Öncü Çalışma: Doğrudan İlgili Tez Bulunamadı"
        }
        description={
          isNovelGap
            ? "Ulusal tez merkezinde yapılan taramada konunuzla ilişkili öncül tezler incelenmiş; araştırmanızın kuramsal, yöntemsel ve ampirik odağının literatürde özgün bir araştırma boşluğunu doldurduğu doğrulanmıştır."
            : isDirectOverlap
              ? "Mevcut veri tabanında sunduğunuz araştırma sorunsalı, kuramsal modeli ve yöntemiyle doğrudan örtüşen tamamlanmış tez(ler) bulunmaktadır. Tezinizin kabul edilebilirliği için ampirik kapsamı, dönemi veya kuramsal odağı farklılaştırmanız önerilir."
              : "Veri tabanındaki mevcut tezler arasında konunuzla doğrudan örtüşen bir çalışmaya rastlanmamıştır. Teziniz literatürde bakir bir alanda öncü bir araştırma niteliği taşımaktadır."
        }
      />

      {/* 2. 3-Dimensional Gap Analysis Report */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Akademik Boşluk Analizi ve Literatür Sentezi
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Çalışmanızın literatürdeki konumu, tespit edilen boşluklar ve özgün
            katkısı aşağıda 3 boyutta sentezlenmiştir.
          </p>
        </div>

        <PositioningMarkdownRenderer content={reportData.gapAnalysisSummary} />
      </div>

      {/* 3. Strategic Recommended Theses Cards */}
      {sortedTheses.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col space-y-1">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Kılavuz ve Öncül Tezler ({sortedTheses.length})
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Çalışmanızın temel kuramsal, yöntemsel ve olgusal zeminini
              oluşturan en stratejik tezler ve konumlandırma rehberi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTheses.map((thesis, idx) => {
              const roleConfig = getRoleBadgeConfig(thesis.strategicRole);
              const RoleIcon = roleConfig.icon;
              const { mainTitle, secondaryTitle } = splitBilingualTitle(
                thesis.title,
              );
              const yökUrl =
                thesis.tezaraUrl ||
                `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${thesis.externalThesisId || thesis.id}`;

              return (
                <Card
                  key={thesis.id || thesis.externalThesisId || `thesis-${idx}`}
                  className="group flex flex-col justify-between rounded-md border border-border bg-card hover:border-primary/20 transition-all duration-200"
                >
                  <CardHeader className="p-5 pb-3 space-y-3">
                    {/* Top Row: Role Badge & Thesis Type */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/40">
                        <RoleIcon className="w-3.5 h-3.5 text-primary" />
                        <span>{roleConfig.label}</span>
                      </span>
                      {thesis.thesisType && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20 bg-primary/10 text-primary">
                          {thesis.thesisType}
                        </span>
                      )}
                    </div>

                    {/* Title & Secondary Title */}
                    <div className="space-y-1">
                      <CardTitle className="font-serif text-base font-semibold leading-snug tracking-tight text-foreground line-clamp-2 break-words hyphens-auto">
                        {mainTitle}
                      </CardTitle>
                      {secondaryTitle && (
                        <p className="font-sans text-xs text-muted-foreground leading-normal italic line-clamp-2">
                          {secondaryTitle}
                        </p>
                      )}
                    </div>

                    {/* Metadata Strip */}
                    <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pt-0.5 border-b border-border/40 pb-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[150px]">{thesis.author}</span>
                      </span>
                      <span className="text-border/80">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{thesis.year}</span>
                      </span>
                      {thesis.university && (
                        <>
                          <span className="text-border/80">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]">{thesis.university}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-4 pt-0 space-y-3.5 flex-1 flex flex-col justify-start">
                    {/* Literatürdeki Yeri */}
                    {thesis.literaturePosition && (
                      <div className="space-y-1.5">
                        <h4 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          <span>Literatürdeki Yeri</span>
                        </h4>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {thesis.literaturePosition}
                        </p>
                      </div>
                    )}

                    {/* Stratejik Boşluk Doldurma (Hero Strategic Callout) */}
                    {thesis.relevanceReason && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 mt-auto">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-sans text-xs font-semibold text-primary">
                            Stratejik Boşluk Doldurma
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground">
                          {thesis.relevanceReason}
                        </p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-secondary/10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">ID</span>
                      <code className="font-mono text-xs font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                        {thesis.externalThesisId || thesis.id}
                      </code>
                    </div>

                    <a
                      href={yökUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary transition-colors text-xs group/link"
                    >
                      <span className="group-hover/link:underline">YÖK Tez Merkezi</span>
                      <ExternalLink className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </a>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Bottom Action Bar (Standard Onboarding) */}
      <div className="flex justify-end mt-8 pb-8">
        <Button onClick={handleConfirm} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Konu Kutuları Hazırlanıyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Konumlandırmayı Onayla ve Konu Kutularını Oluştur
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
