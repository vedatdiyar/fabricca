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
import type { JuryAnalysisResult } from "../_services/analysis";
import type { StrategicRole } from "../_services/validation";
import { PositioningMarkdownRenderer } from "./positioning-markdown-renderer";

interface PositioningReportViewProps {
  reportData: JuryAnalysisResult;
  onConfirm: () => void;
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
        badgeClass: "bg-info/10 text-info border-info/20",
        borderClass: "border-l-info",
      };
    case "METHODOLOGICAL_BENCHMARK":
      return {
        label: "Yöntem Referansı",
        description: "Metodolojik Model ve Saha Referansı",
        icon: GitFork,
        badgeClass: "bg-primary/10 text-primary border-primary/20",
        borderClass: "border-l-primary",
      };
    case "SPECIFIC_FOCUS":
      return {
        label: "Kısmi Odak",
        description: "Spesifik Alt Boyut veya Yakın Vaka",
        icon: Target,
        badgeClass: "bg-secondary text-secondary-foreground border-border",
        borderClass: "border-l-border",
      };
    case "ALTERNATIVE_PERSPECTIVE":
      return {
        label: "Karşıt / Alternatif Yaklaşım",
        description: "Farklı Kuramsal Eksen veya Zıt Bulgular",
        icon: Layers,
        badgeClass: "bg-warning/10 text-warning border-warning/20",
        borderClass: "border-l-warning",
      };
    default:
      return {
        label: "Kılavuz Literatür",
        description: "İlgili Literatür Kaynağı",
        icon: Compass,
        badgeClass: "bg-muted text-muted-foreground border-border",
        borderClass: "border-l-border",
      };
  }
}

/**
 * Renders the comprehensive positioning gap analysis report including:
 * 1. Global Jury Evaluation Status Banner
 * 2. 3-Dimensional Gap Analysis Synthesis Cards
 * 3. Strategic Guiding Thesis Cards with explicit role annotations and links
 * 4. Confirmation action to proceed to thesis boxes.
 */
export function PositioningReportView({
  reportData,
  onConfirm,
}: PositioningReportViewProps) {
  const [confirming, setConfirming] = useState(false);
  const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
  const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";
  const isNoRelated = reportData.globalStatus === "NO_RELATED_LITERATURE";

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
          "rounded-md border transition-all shadow-sm",
          isNovelGap
            ? "bg-success/5 border-success/30"
            : isDirectOverlap
              ? "bg-destructive/5 border-destructive/30"
              : "bg-info/5 border-info/30",
        )}
      >
        <CardContent className="p-4 sm:p-6 flex items-start gap-4">
          <div
            className={cn(
              "p-2.5 rounded-md shrink-0 border",
              isNovelGap
                ? "bg-background/90 text-success border-success/30"
                : isDirectOverlap
                  ? "bg-background/90 text-destructive border-destructive/30"
                  : "bg-background/90 text-info border-info/30",
            )}
          >
            {isNovelGap && <CheckCircle2 className="h-5 w-5" />}
            {isDirectOverlap && <AlertTriangle className="h-5 w-5" />}
            {isNoRelated && <HelpCircle className="h-5 w-5" />}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Akademik Jüri Kararı & Özgünlük Durumu
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold shrink-0",
                  isNovelGap
                    ? "bg-success/15 text-success border-success/30"
                    : isDirectOverlap
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : "bg-info/15 text-info border-info/30",
                )}
              >
                {isNovelGap
                  ? "Açık Literatür Boşluğu"
                  : isDirectOverlap
                    ? "Özgünlük Riski"
                    : "Öncü Alan"}
              </Badge>
            </div>

            <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {isNovelGap && "Özgün Katkı: Belirgin Bir Literatür Boşluğu Tespit Edildi"}
              {isDirectOverlap && "Dikkat: Birebir Çakışan Tamamlanmış Tez Tespit Edildi"}
              {isNoRelated && "Öncü Çalışma: Doğrudan İlgili Tez Bulunamadı"}
            </h3>

            <p className="text-sm leading-relaxed text-muted-foreground font-sans">
              {isNovelGap &&
                "Ulusal tez merkezinde yapılan taramada konunuzla ilişkili öncül tezler incelenmiş; araştırmanızın kuramsal, yöntemsel ve ampirik odağının literatürde özgün bir araştırma boşluğunu doldurduğu doğrulanmıştır."}
              {isDirectOverlap &&
                "Mevcut veri tabanında sunduğunuz araştırma sorunsalı, kuramsal modeli ve yöntemiyle doğrudan örtüşen tamamlanmış tez(ler) bulunmaktadır. Tezinizin kabul edilebilirliği için ampirik kapsamı, dönemi veya kuramsal odağı farklılaştırmanız önerilir."}
              {isNoRelated &&
                "Veri tabanındaki mevcut tezler arasında konunuzla doğrudan örtüşen bir çalışmaya rastlanmamıştır. Teziniz literatürde bakir bir alanda öncü bir araştırma niteliği taşımaktadır."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. 3-Dimensional Gap Analysis Report */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="font-serif text-xl font-bold tracking-tight text-foreground">
            Akademik Boşluk Analizi ve Literatür Sentezi
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Çalışmanızın literatürdeki konumu, tespit edilen boşluklar ve özgün katkısı aşağıda 3 boyutta sentezlenmiştir.
          </p>
        </div>

        <PositioningMarkdownRenderer
          content={reportData.gapAnalysisSummary}
        />
      </div>

      {/* 3. Strategic Recommended Theses Cards */}
      {reportData.recommendedTheses.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col space-y-1">
              <h2 className="font-serif text-xl font-bold tracking-tight text-foreground">
                Kılavuz ve Öncül Tezler ({reportData.recommendedTheses.length})
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Çalışmanızın temel kuramsal, yöntemsel ve olgusal zeminini oluşturan en stratejik tezler ve konumlandırma rehberi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportData.recommendedTheses.map((thesis, idx) => {
              const roleConfig = getRoleBadgeConfig(thesis.strategicRole);
              const RoleIcon = roleConfig.icon;
              const yökUrl =
                thesis.tezaraUrl ||
                `https://tez.yok.gov.tr/UlusalTezMerkezi/tezDetay.jsp?id=${thesis.externalThesisId || thesis.id}`;

              return (
                <Card
                  key={thesis.id || thesis.externalThesisId || `thesis-${idx}`}
                  className={cn(
                    "flex flex-col justify-between border rounded-md bg-card transition-all hover:border-border/80 border-l-4 shadow-sm",
                    roleConfig.borderClass,
                  )}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3 sm:pb-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2.5 py-0.5 text-xs font-semibold gap-1.5 flex items-center",
                          roleConfig.badgeClass,
                        )}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {roleConfig.label}
                      </Badge>
                      {thesis.thesisType && (
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                          {thesis.thesisType}
                        </span>
                      )}
                    </div>

                    <CardTitle className="font-serif text-base font-bold leading-snug tracking-tight text-foreground line-clamp-2">
                      {thesis.title}
                    </CardTitle>

                    {/* Metadata chips */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="font-medium text-foreground/80">
                          {thesis.author}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {thesis.year}
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span className="truncate max-w-[180px]">
                          {thesis.university}
                        </span>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs leading-relaxed text-muted-foreground font-sans flex-1">
                    {thesis.literaturePosition && (
                      <div className="rounded-md bg-muted/40 p-2.5 border border-border/40 space-y-1">
                        <span className="font-semibold text-foreground text-[11px] block">
                          Literatürdeki Yeri (Ne Yaptı?):
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {thesis.literaturePosition}
                        </p>
                      </div>
                    )}

                    {thesis.relevanceReason && (
                      <div className="rounded-md bg-primary/5 p-2.5 border border-primary/15 space-y-1">
                        <span className="font-semibold text-primary text-[11px] block">
                          Stratejik Kullanım / Boşluk Doldurma:
                        </span>
                        <p className="text-foreground/90 leading-relaxed">
                          {thesis.relevanceReason}
                        </p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 sm:p-5 pt-2 flex items-center justify-between border-t border-border/40 gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      ID: <span className="font-mono">{thesis.externalThesisId || thesis.id}</span>
                    </span>

                    <a
                      href={yökUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <span>YÖK Tez Merkezi</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
        <div className="text-xs text-muted-foreground text-center sm:text-left">
          Konumlandırma raporunu onayladığınızda tezinizin altyapısal konu kutuları otomatik olarak üretilecektir.
        </div>

        <Button
          onClick={handleConfirm}
          disabled={confirming}
          size="lg"
          className="w-full sm:w-auto font-sans font-semibold gap-2 shadow-sm"
        >
          {confirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Konu Kutuları Hazırlanıyor...</span>
            </>
          ) : (
            <>
              <span>Konumlandırmayı Onayla ve Konu Kutularını Oluştur</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
