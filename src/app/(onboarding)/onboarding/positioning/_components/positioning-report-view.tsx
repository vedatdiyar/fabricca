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
  Layers,
  GitFork,
  BookOpen,
  Compass,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="w-full space-y-6">
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
      <div className="space-y-3">
        <div className="flex flex-col space-y-1">
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Akademik Boşluk Analizi ve Literatür Sentezi
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Çalışmanızın literatürdeki konumu, tespit edilen boşluklar ve özgün
            katkısı aşağıda 3 stratejik boyutta sentezlenmiştir.
          </p>
        </div>

        <PositioningMarkdownRenderer content={reportData.gapAnalysisSummary} />
      </div>

      {/* 3. Strategic Recommended Theses Cards */}
      {sortedTheses.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col space-y-1">
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
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
              const { mainTitle } = splitBilingualTitle(thesis.title);
              const yökUrl =
                thesis.tezaraUrl ||
                `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${thesis.externalThesisId || thesis.id}`;

              return (
                <Card
                  key={`thesis-${idx}-${thesis.title.slice(0, 20)}`}
                  className="flex flex-col justify-between p-4 rounded-md border border-border bg-card hover:border-primary/30 transition-colors space-y-3"
                >
                  {/* Top Bar: Role & Degree Badge on Left, Year on Right */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                        <RoleIcon className="size-3 text-primary shrink-0" />
                        <span>{roleConfig.label}</span>
                      </span>
                      {thesis.thesisType && (
                        <span className="font-sans text-xs font-medium text-muted-foreground">
                          · {thesis.thesisType}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {thesis.year}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div className="space-y-1">
                    <h3 className="font-serif text-sm font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
                      {mainTitle}
                    </h3>
                    <p className="font-sans text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {thesis.author}
                      </span>
                      {thesis.university && (
                        <span> · {thesis.university}</span>
                      )}
                    </p>
                  </div>

                  {/* Clearly Labeled Content Sections */}
                  <div className="space-y-2.5 text-xs">
                    {thesis.literaturePosition && (
                      <div className="space-y-1">
                        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Literatür Kapsamı
                        </span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {thesis.literaturePosition}
                        </p>
                      </div>
                    )}

                    {thesis.relevanceReason && (
                      <div className="rounded-md border border-primary/20 bg-primary/10 p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Sparkles className="size-3 shrink-0" />
                          <span className="font-sans text-[11px] font-semibold">
                            Tez Konumlandırma Stratejisi
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground">
                          {thesis.relevanceReason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Minimal Footer: Thesis ID & YÖK Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="font-mono text-xs text-muted-foreground">
                      Tez No: {thesis.externalThesisId || thesis.id}
                    </span>
                    <a
                      href={yökUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline text-xs"
                    >
                      <span>YÖK Tez Merkezi</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Bottom Action Bar (Standard Onboarding) */}
      <div className="flex justify-end pt-4 pb-8">
        <Button onClick={handleConfirm} disabled={confirming} size="lg">
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Konu Kutuları Hazırlanıyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Konumlandırmayı Onayla ve Konu Kutularını Oluştur
              <ArrowRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
