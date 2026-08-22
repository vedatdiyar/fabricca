"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldAlert,
  Sparkles,
  Swords,
  BookCheck,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type {
  OfficeReviewReport,
  JuryCritique,
} from "../_services/pipeline/types";

interface OfficeMarginNotesProps {
  report: OfficeReviewReport;
  hasStartedDefense: boolean;
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  LOGIC_LEAP: {
    label: "Mantık Sıçraması",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  UNBACKED_CLAIM: {
    label: "Temellendirilmemiş İddia",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  METHODOLOGICAL_GAP: {
    label: "Metodolojik Boşluk",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
};

const SEVERITY_BADGES: Record<string, { label: string; variant: string }> = {
  CRITICAL: {
    label: "Kritik Çelişki",
    variant: "bg-destructive/10 text-destructive border-destructive/20",
  },
  WARNING: {
    label: "Uyarı",
    variant: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  NOTE: {
    label: "Doğrulandı",
    variant: "bg-primary/10 text-primary border-primary/20",
  },
};

/**
 * Left Panel: Margin Notes & Audit (Hocanın Ön Okuması & Kenar Notları).
 * Displays:
 * 1. Strict Citation & Page Audit (Red Pen)
 * 2. Non-destructive Polish Diff (Yellow Pen)
 * 3. Jury Remarks & Socratic Critiques (Blue Pen)
 */
interface OfficeAuditTabProps {
  audit: OfficeReviewReport["audit"];
}

function OfficeAuditTab({ audit }: OfficeAuditTabProps) {
  return (
    <div className="space-y-4">
      {/* Audit Summary Box */}
      <div className="p-3.5 rounded-lg border border-border bg-muted/30 text-xs leading-relaxed text-foreground">
        <span className="font-semibold text-primary block mb-1">
          Danışman Denetim Kararı:
        </span>
        {audit.summary}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        <h4 className="font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Kaynak & Sayfa Doğrulama Detayları
        </h4>

        {audit.findings.length === 0 ? (
          <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground text-center">
            Taslakta açık bir atıf veya sayfa uyuşmazlığı tespit edilmedi.
          </div>
        ) : (
          audit.findings.map((f, idx) => {
            const badge = SEVERITY_BADGES[f.severity] || SEVERITY_BADGES.NOTE;
            const findingKey = `${f.sourceTitle ?? "src"}-${f.citedPages ?? ""}-${f.status}-${idx}`;

            return (
              <Card
                key={findingKey}
                className="border-border bg-card shadow-xs overflow-hidden"
              >
                <div className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${badge.variant}`}
                      >
                        {badge.label}
                      </Badge>

                      {f.citedPages && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-muted text-muted-foreground"
                        >
                          {f.citedPages}
                        </Badge>
                      )}
                    </div>

                    {f.status === "VERIFIED" ? (
                      <span className="text-[10px] text-primary flex items-center gap-1">
                        <Check className="h-3 w-3" /> Doğrulandı
                      </span>
                    ) : (
                      <span className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Uyumsuz / Şüpheli
                      </span>
                    )}
                  </div>

                  {f.sourceTitle && (
                    <div className="text-xs font-medium text-foreground">
                      {f.sourceTitle}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.message}
                  </p>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

interface OfficeDiffTabProps {
  diff: OfficeReviewReport["diff"];
  onCopyPolished: () => void;
  copiedDiff: boolean;
}

function OfficeDiffTab({
  diff,
  onCopyPolished,
  copiedDiff,
}: OfficeDiffTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Yazarın özgün argümanı korunarak yalnızca akademik akış, APA ve
          anlatım pürüzleri giderilmiştir.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onCopyPolished}
          className="h-7 text-xs gap-1 border-border shrink-0 cursor-pointer"
        >
          {copiedDiff ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              Kopyalandı
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Öneriyi Kopyala
            </>
          )}
        </Button>
      </div>

      {/* Changes List */}
      {diff.changes && diff.changes.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
          <span className="font-semibold text-foreground block mb-1">
            Yapılan Editoryal İyileştirmeler:
          </span>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {diff.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-Side / Stacked Diff */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Orijinal Taslak Metni
          </span>
          <div className="p-3 rounded-md bg-muted/40 border border-border text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans">
            {diff.original}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-primary flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Önerilen Rötuşlu Metin
          </span>
          <div className="p-3.5 rounded-md bg-primary/5 border border-primary/20 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans shadow-xs">
            {diff.polished}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OfficeJuryTabProps {
  juryCritiques: JuryCritique[];
  onStartDefense: (initialCritique?: JuryCritique) => void;
}

function OfficeJuryTab({ juryCritiques, onStartDefense }: OfficeJuryTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground block mb-0.5">
          Tez Savunması Provası:
        </span>
        Jüri üyelerinin tez savunmasında yöneltebileceği olası itirazlar aşağıda
        sıralanmıştır. Bu şerhleri danışmanınızla canlı olarak müzakere
        edebilirsiniz.
      </div>

      <div className="space-y-3">
        {juryCritiques.length === 0 ? (
          <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground text-center">
            Belirgin bir jüri itiraz şerhi bulunamadı.
          </div>
        ) : (
          juryCritiques.map((critique, idx) => {
            const cat =
              CATEGORY_LABELS[critique.category] || CATEGORY_LABELS.LOGIC_LEAP;
            const critiqueKey = critique.id || `${critique.title}-${idx}`;

            return (
              <Card
                key={critiqueKey}
                className="border-border bg-card shadow-xs overflow-hidden"
              >
                <div className="p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {idx + 1}. {critique.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${cat.color}`}
                    >
                      {cat.label}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {critique.critique}
                  </p>

                  {/* Suggested Defense Point */}
                  <div className="p-2.5 rounded-md bg-muted/50 border border-border/80 text-[11px] leading-relaxed text-foreground">
                    <span className="font-semibold text-primary block mb-0.5">
                      💡 Önerilen Savunma Argümanı:
                    </span>
                    {critique.suggestedDefensePoint}
                  </div>

                  {/* Action to bring into defense chat */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onStartDefense(critique)}
                    className="self-end text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 gap-1 cursor-pointer"
                  >
                    <span>Savunmada Bu Şerhi Tartış</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Left Panel: Margin Notes & Audit (Hocanın Ön Okuması & Kenar Notları).
 * Displays:
 * 1. Strict Citation & Page Audit (Red Pen)
 * 2. Non-destructive Polish Diff (Yellow Pen)
 * 3. Jury Remarks & Socratic Critiques (Blue Pen)
 */
export function OfficeMarginNotes({
  report,
  hasStartedDefense,
  onStartDefense,
}: OfficeMarginNotesProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "diff" | "jury">(
    "audit",
  );
  const [copiedDiff, setCopiedDiff] = useState(false);

  const { audit, diff, juryCritiques } = report;

  const handleCopyPolishedText = async () => {
    if (!diff.polished) return;
    await navigator.clipboard.writeText(diff.polished);
    setCopiedDiff(true);
    toast.success("Rötuşlanmış metin panoya kopyalandı.");
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-border bg-card/80 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookCheck className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
              Hocanın Ön Okuması & Kenar Notları
            </h3>
          </div>

          {audit.hasCriticalIssues ? (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Kritik Şerhler Var
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-[10px]"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Kaynaklar Doğrulandı
            </Badge>
          )}
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "audit" | "diff" | "jury")}
          className="mt-3 w-full"
        >
          <TabsList className="grid grid-cols-3 w-full bg-muted/60 h-8 p-0.5">
            <TabsTrigger
              value="audit"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <ShieldAlert className="h-3 w-3 mr-1 text-destructive" />
              Sayfa Denetimi
              {audit.findings.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                  {audit.findings.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="diff"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
              Editoryal Diff
            </TabsTrigger>

            <TabsTrigger
              value="jury"
              className="text-xs h-7 data-[state=active]:bg-background data-[state=active]:text-foreground cursor-pointer"
            >
              <Swords className="h-3 w-3 mr-1 text-blue-500" />
              Jüri Şerhleri
              {juryCritiques.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-muted text-[10px] rounded-full">
                  {juryCritiques.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "audit" && <OfficeAuditTab audit={audit} />}
        {activeTab === "diff" && (
          <OfficeDiffTab
            diff={diff}
            onCopyPolished={handleCopyPolishedText}
            copiedDiff={copiedDiff}
          />
        )}
        {activeTab === "jury" && (
          <OfficeJuryTab
            juryCritiques={juryCritiques}
            onStartDefense={onStartDefense}
          />
        )}
      </div>

      {/* Panel Footer: Start Live Defense CTA */}
      {!hasStartedDefense && (
        <div className="p-4 border-t border-border bg-card/90 shrink-0">
          <Button
            onClick={() => onStartDefense()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium h-9 gap-2 shadow-xs cursor-pointer"
          >
            <Swords className="h-4 w-4" />
            <span>Savunmaya Başla (Danışmanla Müzakere Et)</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        </div>
      )}
    </div>
  );
}
