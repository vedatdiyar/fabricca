"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  RefreshCw,
  HelpCircle as QuestionIcon,
  Scale,
  Building2,
  Scroll,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIBanner } from "@/components/shared/ai-banner";
import { splitBilingualTitle } from "@/lib/academic/title-utils";
import type { JuryAnalysisResult } from "../_services/analysis";
import type { StrategicRole } from "../_services/validation";
import { PositioningMarkdownRenderer } from "./positioning-markdown-renderer";
import {
  applyPositioningPivotAction,
  completePositioningClarificationsAction,
} from "../actions";

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

function getPublicationBadge(pubType?: string) {
  switch (pubType) {
    case "Tez":
      return {
        label: "Tez",
        className:
          "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
      };
    case "Kitap":
      return {
        label: "Kitap",
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      };
    case "Kitap Bölümü":
      return {
        label: "Kitap Bölümü",
        className:
          "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
      };
    case "Rapor":
      return {
        label: "Rapor",
        className:
          "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
      };
    default:
      return {
        label: "Makale",
        className:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      };
  }
}

function getChannelLabel(channel?: string) {
  switch (channel) {
    case "yok":
      return "YÖK Tez Arşivi";
    case "openalex":
      return "OpenAlex";
    case "semantic_scholar":
      return "Semantic Scholar";
    case "exa":
      return "DergiPark & Web";
    default:
      return "Akademik Kaynak";
  }
}

export function PositioningReportView({
  reportData,
  onConfirm,
}: PositioningReportViewProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [activePivotLoading, setActivePivotLoading] = useState<string | null>(
    null,
  );

  const gapSummary = reportData.gapAnalysisSummary;
  const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
  const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";

  // Clarification answers state
  const questions = gapSummary?.clarificationQuestions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswerChange = (questionId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
  };

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
      if (questions.length > 0) {
        const answersList = questions
          .filter((q) => answers[q.id]?.trim())
          .map((q) => ({ question: q.question, answer: answers[q.id] }));
        if (answersList.length > 0) {
          await completePositioningClarificationsAction(answersList);
        }
      }
      await onConfirm();
    } catch {
      toast.error("İşlem sırasında bir hata oluştu.");
    } finally {
      setConfirming(false);
    }
  };

  const handleApplyPivot = async (pivot: {
    id: string;
    title: string;
    suggestedFocus: string;
  }) => {
    if (activePivotLoading) return;
    setActivePivotLoading(pivot.id);
    try {
      const res = await applyPositioningPivotAction({
        pivotId: pivot.id,
        title: pivot.title,
        suggestedFocus: pivot.suggestedFocus,
      });

      if ("error" in res) {
        toast.error(res.error);
        setActivePivotLoading(null);
        return;
      }

      toast.success(`"${pivot.title}" rotası kabul edildi.`);
      await onConfirm();
    } catch {
      toast.error("Farklılaşma rotası uygulanırken bir hata oluştu.");
      setActivePivotLoading(null);
    }
  };

  const pivotOptions = gapSummary?.pivotOptions ?? [];
  const overlappingWorks = gapSummary?.overlappingWorks ?? [];

  return (
    <div className="w-full space-y-6">
      {/* 1. Global Jury Evaluation Status Banner */}
      <AIBanner
        icon={
          isNovelGap
            ? CheckCircle2
            : isDirectOverlap
              ? AlertTriangle
              : HelpCircle
        }
        variant={isNovelGap ? "success" : isDirectOverlap ? "warning" : "info"}
        title={
          isNovelGap
            ? "Özgün Katkı: Belirgin Bir Akademik Literatür Boşluğu Doğrulandı"
            : isDirectOverlap
              ? "Akademik Çakışma Riski: Doğrudan Emsal Çalışma Tespit Edildi"
              : "Öncü Çalışma: Doğrudan Emsal Çalışmaya Rastlanmadı"
        }
        description={
          isNovelGap
            ? "4 kanallı literatür taraması (YÖK, OpenAlex, Semantic Scholar, DergiPark) tamamlanmış; araştırmanızın dönemsel, kuramsal ve yöntemsel odağının özgün bir literatür boşluğunu doldurduğu akademik jüri tarafından teyit edilmiştir."
            : isDirectOverlap
              ? "Taranan ulusal tez ve makale veritabanlarında araştırma konunuz, ampirik sahanız veya yönteminizle doğrudan örtüşen tamamlanmış çalışma(lar) tespit edilmiştir. Tezinizin savunulabilirliği ve akademik kabulü için aşağıdaki farklılaşma (pivot) rotalarından birini seçmeniz veya taslağınızı yeniden düzenlemeniz önerilir."
              : "Taranan çok kanallı veri tabanında konunuzla doğrudan örtüşen bir çalışmaya rastlanmamıştır. Teziniz literatürde bakir bir alanda öncü bir araştırma niteliği taşımaktadır."
        }
      />

      {/* 2. DIRECT OVERLAP ACTION PANEL (If Overlap Occurs) */}
      {isDirectOverlap && (
        <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/5 p-5">
          {/* Overlapping works summary */}
          {overlappingWorks.length > 0 && (
            <div className="space-y-2">
              <span className="font-serif text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                Çakışan veya Benzer Emsal Çalışma(lar):
              </span>
              <div className="space-y-2">
                {overlappingWorks.map((work, i) => (
                  <div
                    key={`overlap-${i}`}
                    className="p-3 rounded-md bg-background border border-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {work.title}
                      </span>
                      {work.year && (
                        <span className="font-mono text-muted-foreground">
                          {work.year}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {work.author && <span>Yazar: {work.author} · </span>}
                      <span>Tür: {work.sourceType || "Tez"}</span>
                    </div>
                    {work.reason && (
                      <p className="text-warning-foreground font-medium pt-1">
                        Çakışma Gerekçesi: {work.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3 Actionable Differentiation (Pivot) Options */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col space-y-1">
              <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Tezinizi Özgünleştirecek 3 Farklılaşma (Pivot) Rotası
              </h3>
              <p className="text-xs text-muted-foreground">
                Emsal tezden ayrışmak için aşağıdaki akademik rotalardan birini
                seçerek tez tasarımınızı anında özgünleştirebilirsiniz:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {pivotOptions.map((pivot) => {
                const isField = pivot.dimension === "SAHA_ORNEKLEM";
                const isTheory = pivot.dimension === "KURAMSAL_CERCEVE";
                const PivotIcon = isField
                  ? Building2
                  : isTheory
                    ? Scale
                    : Scroll;
                const isLoading = activePivotLoading === pivot.id;

                return (
                  <Card
                    key={pivot.id}
                    className="p-4 flex flex-col justify-between space-y-3 border-border hover:border-primary/50 transition-all bg-card"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono"
                        >
                          <PivotIcon className="size-3 mr-1 text-primary" />
                          {isField
                            ? "Saha & Örneklem"
                            : isTheory
                              ? "Kuramsal Mercek"
                              : "Yöntemsel Desen"}
                        </Badge>
                      </div>
                      <h4 className="font-serif text-xs font-bold text-foreground">
                        {pivot.title}
                      </h4>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {pivot.description}
                      </p>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground font-medium">
                        Öneri: {pivot.suggestedFocus}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleApplyPivot(pivot)}
                      disabled={activePivotLoading !== null}
                      className="w-full text-xs cursor-pointer"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" />
                          Uygulanıyor...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          Bu Rotayla Özgünleştir
                          <ArrowRight className="size-3" />
                        </span>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>

            {/* Back to Draft button */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                Farklılaşma seçenekleri yerine taslağınızı baştan değiştirmek
                ister misiniz?
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/onboarding/proposal")}
                disabled={activePivotLoading !== null || confirming}
                className="cursor-pointer text-xs"
              >
                <RefreshCw className="size-3 mr-1.5" />
                Taslağı Yeniden Düzenle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CLARIFICATION QUESTIONS (If Novel Gap Identified) */}
      {isNovelGap && questions.length > 0 && (
        <Card className="p-5 border-border bg-card space-y-4">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <QuestionIcon className="size-4 text-primary" />
              <h3 className="font-serif text-sm font-semibold text-foreground">
                Tez Tasarımınızı Keskinleştirecek Odak Tercihleri
              </h3>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Jüri, çalışmanızın özgünlüğünü pekiştirmek ve konu kutularını en
              doğru şekilde yapılandırmak için aşağıdaki tercihleri
              netleştirmenizi önermektedir:
            </p>
          </div>

          <div className="space-y-3 pl-6">
            {questions.map((q, idx) => (
              <div key={q.id || `q-${idx}`} className="space-y-1.5">
                <Label
                  htmlFor={`q-${q.id}`}
                  className="text-xs font-semibold text-foreground"
                >
                  {idx + 1}. {q.question}
                </Label>
                {q.contextNote && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Not: {q.contextNote}
                  </p>
                )}
                <Input
                  id={`q-${q.id}`}
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Tercihinizi veya odak kararınızı kısaca belirtin (opsiyonel)..."
                  className="text-xs h-9"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. 3-Dimensional Gap Analysis Report */}
      <div className="space-y-3">
        <div className="flex flex-col space-y-1">
          <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
            Akademik Boşluk Analizi ve Çok Kanallı Literatür Sentezi
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Çalışmanızın literatürdeki konumu, tespit edilen boşluklar ve özgün
            katkısı aşağıda 3 stratejik boyutta sentezlenmiştir.
          </p>
        </div>

        <PositioningMarkdownRenderer content={reportData.gapAnalysisSummary} />
      </div>

      {/* 5. Strategic Recommended Guiding Literature Cards */}
      {sortedTheses.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
                Kılavuz ve Emsal Literatür ({sortedTheses.length})
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                YÖK Tezleri · Makaleler · Kitaplar
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Çalışmanızın temel kuramsal, yöntemsel ve olgusal zeminini
              oluşturan en stratejik kaynaklar ve konumlandırma rehberi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTheses.map((thesis, idx) => {
              const roleConfig = getRoleBadgeConfig(thesis.strategicRole);
              const pubBadge = getPublicationBadge(
                thesis.publicationType || thesis.thesisType,
              );
              const RoleIcon = roleConfig.icon;
              const { mainTitle } = splitBilingualTitle(thesis.title);
              const sourceLabel = getChannelLabel(thesis.sourceChannel);

              const outUrl =
                thesis.url ||
                thesis.yokUrl ||
                (thesis.doi ? `https://doi.org/${thesis.doi}` : undefined);

              return (
                <Card
                  key={`lit-${idx}-${thesis.id}`}
                  className="flex flex-col justify-between p-4 rounded-md border border-border bg-card hover:border-primary/30 transition-colors space-y-3"
                >
                  {/* Top Bar: Badges & Year */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                        <RoleIcon className="size-3 text-primary shrink-0" />
                        <span>{roleConfig.label}</span>
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${pubBadge.className}`}
                      >
                        {pubBadge.label}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {sourceLabel}
                      </span>
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
                      {thesis.university && <span> · {thesis.university}</span>}
                    </p>
                  </div>

                  {/* Content Sections */}
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

                  {/* Footer: ID & External Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                      ID: {thesis.externalThesisId || thesis.id}
                    </span>
                    {outUrl ? (
                      <a
                        href={outUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline text-xs"
                      >
                        <span>Kaynağı İncele</span>
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        Bağlantı bulunamadı
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Bottom Action Bar */}
      <div className="flex justify-between items-center pt-4 pb-8 border-t border-border/40">
        <Button
          variant="outline"
          onClick={() => router.push("/onboarding/proposal")}
          disabled={confirming || activePivotLoading !== null}
        >
          <RefreshCw className="size-3.5 mr-2" />
          Taslağı Düzenle
        </Button>

        <Button
          onClick={handleConfirm}
          disabled={
            confirming || isDirectOverlap || activePivotLoading !== null
          }
          size="lg"
          className="cursor-pointer"
        >
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Konu Kutuları Hazırlanıyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {isDirectOverlap
                ? "Lütfen Bir Farklılaşma Rotası Seçin"
                : "Konumlandırmayı Onayla ve Konu Kutularını Oluştur"}
              <ArrowRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
