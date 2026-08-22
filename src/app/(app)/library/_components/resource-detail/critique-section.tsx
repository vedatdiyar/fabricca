"use client";

import React, {
  useSyncExternalStore,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Search,
  Layers,
  FlaskConical,
  Target,
  Sparkles,
  BookMarked,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type {
  LibraryResourceCritique,
  ResourceAuditReport,
} from "../../_lib/types";
import type { CritiqueFormInput } from "../../_hooks/use-resource-critique";

interface CritiqueSectionProps {
  resourceId: number;
  critique?: LibraryResourceCritique;
  onSaveCritique: (
    input: CritiqueFormInput,
    silent?: boolean,
  ) => void | Promise<void>;
  onEvaluateCritique?: (
    resourceId?: number,
  ) => Promise<ResourceAuditReport | null>;
  isEvaluating?: boolean;
}

const CRITIQUE_FIELDS = [
  {
    key: "researchQuestion",
    icon: Search,
    number: 1,
    label: "Araştırma Sorusu",
    question: "Bu çalışma neyi çözmeye veya anlamaya çalışıyor?",
  },
  {
    key: "theoreticalFramework",
    icon: Layers,
    number: 2,
    label: "Teorik ve Kavramsal Çerçeve",
    question: "Hangi teoriye, kavramlara veya anahtar terimlere dayanıyor?",
  },
  {
    key: "methodology",
    icon: FlaskConical,
    number: 3,
    label: "Metodoloji",
    question: "Hangi yöntem kullanılmış?",
  },
  {
    key: "mainArgument",
    icon: Target,
    number: 4,
    label: "Temel Argüman",
    question: "Yazarın ulaştığı ana sonuç ve savunduğu temel tez?",
  },
  {
    key: "literatureGap",
    icon: Sparkles,
    number: 5,
    label: "Literatür Boşluğu",
    question:
      "Yazar nerede eksik kalmış veya gelecekte ne yapılması gerektiğini söylemiş?",
  },
] as const;

type CritiqueFieldKey = (typeof CRITIQUE_FIELDS)[number]["key"];

type CritiqueDraftMap = Record<CritiqueFieldKey, string>;

const CRITIQUE_STORAGE_PREFIX = "fabricca_library_critique_draft_";

const memoryCache = new Map<number, CritiqueDraftMap>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function toFieldValues(critique?: LibraryResourceCritique): CritiqueDraftMap {
  return {
    researchQuestion: critique?.researchQuestion ?? "",
    theoreticalFramework: critique?.theoreticalFramework ?? "",
    methodology: critique?.methodology ?? "",
    mainArgument: critique?.mainArgument ?? "",
    literatureGap: critique?.literatureGap ?? "",
  };
}

function getDraftSnapshot(
  resourceId: number,
  baseValues: CritiqueDraftMap,
): CritiqueDraftMap {
  if (typeof window === "undefined") {
    return baseValues;
  }

  if (memoryCache.has(resourceId)) {
    return memoryCache.get(resourceId)!;
  }

  try {
    const saved = localStorage.getItem(
      `${CRITIQUE_STORAGE_PREFIX}${resourceId}`,
    );
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<CritiqueDraftMap>;
      const draft: CritiqueDraftMap = {
        researchQuestion:
          parsed.researchQuestion ?? baseValues.researchQuestion,
        theoreticalFramework:
          parsed.theoreticalFramework ?? baseValues.theoreticalFramework,
        methodology: parsed.methodology ?? baseValues.methodology,
        mainArgument: parsed.mainArgument ?? baseValues.mainArgument,
        literatureGap: parsed.literatureGap ?? baseValues.literatureGap,
      };
      memoryCache.set(resourceId, draft);
      return draft;
    }
  } catch {
    // Ignore storage parse errors
  }

  memoryCache.set(resourceId, baseValues);
  return baseValues;
}

function persistCritiqueDraft(
  resourceId: number,
  draft: CritiqueDraftMap,
  baseValues: CritiqueDraftMap,
) {
  memoryCache.set(resourceId, draft);

  if (typeof window !== "undefined") {
    const storageKey = `${CRITIQUE_STORAGE_PREFIX}${resourceId}`;
    const isDifferent = Object.keys(draft).some(
      (k) =>
        draft[k as CritiqueFieldKey].trim() !==
        baseValues[k as CritiqueFieldKey].trim(),
    );

    try {
      if (isDifferent) {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage access fallback
    }
  }

  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Article analysis (Eser Analizi) form with debounced auto-save and on-demand LLM audit evaluation.
 *
 * @param root0 - Component props.
 * @param root0.resourceId - ID of the target resource.
 * @param root0.critique - The saved analysis for the currently selected resource, when present.
 * @param root0.onSaveCritique - Callback invoked when debounced auto-save triggers.
 * @param root0.onEvaluateCritique - Callback to trigger holistic LLM evaluation.
 * @param root0.isEvaluating - Loading state for LLM evaluation.
 * @returns The critique form and audit markup.
 */
export function CritiqueSection({
  resourceId,
  critique,
  onSaveCritique,
  onEvaluateCritique,
  isEvaluating = false,
}: CritiqueSectionProps) {
  const baseValues = toFieldValues(critique);

  const values = useSyncExternalStore(
    subscribe,
    () => getDraftSnapshot(resourceId, baseValues),
    () => baseValues,
  );

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [isAuditOpen, setIsAuditOpen] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFieldChange = useCallback(
    (field: CritiqueFieldKey, val: string) => {
      const nextValues = { ...values, [field]: val };
      persistCritiqueDraft(resourceId, nextValues, baseValues);

      setSaveStatus("saving");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          await onSaveCritique(
            {
              researchQuestion: nextValues.researchQuestion.trim(),
              theoreticalFramework: nextValues.theoreticalFramework.trim(),
              methodology: nextValues.methodology.trim(),
              mainArgument: nextValues.mainArgument.trim(),
              literatureGap: nextValues.literatureGap.trim(),
            },
            true,
          );
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2500);
        } catch {
          setSaveStatus("idle");
        }
      }, 1200);
    },
    [resourceId, values, baseValues, onSaveCritique],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleResetDraft = useCallback(() => {
    persistCritiqueDraft(resourceId, baseValues, baseValues);
  }, [resourceId, baseValues]);

  const hasDraft = Object.keys(values).some(
    (k) =>
      values[k as CritiqueFieldKey].trim() !==
      baseValues[k as CritiqueFieldKey].trim(),
  );

  const auditReport = critique?.aiEvaluation;

  return (
    <div className="space-y-4">
      <Card className="border border-border bg-background">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                Eser Analizi
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />{" "}
                  Kaydediliyor...
                </span>
              )}

              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-[11px] text-success font-medium">
                  <Check className="h-3 w-3 text-success" /> Kaydedildi
                </span>
              )}

              {saveStatus === "idle" && hasDraft && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                    <Check className="h-3 w-3 text-success" /> Taslak kaydedildi
                  </span>
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    title="Taslağı sıfırla"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    <span>Sıfırla</span>
                  </button>
                </div>
              )}

              {onEvaluateCritique && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEvaluateCritique(resourceId)}
                  disabled={isEvaluating}
                  className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-all shadow-xs"
                >
                  <Sparkles
                    className={`h-3.5 w-3.5 text-primary ${
                      isEvaluating ? "animate-spin" : ""
                    }`}
                  />
                  {isEvaluating
                    ? "Değerlendiriliyor..."
                    : "Notları ve Eseri Değerlendir"}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {CRITIQUE_FIELDS.map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-border/40 bg-muted text-[10px] font-semibold text-muted-foreground">
                      {field.number}
                    </span>
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <Label className="text-xs text-foreground font-medium">
                      {field.label}
                    </Label>
                  </div>
                  <Textarea
                    value={values[field.key]}
                    onChange={(e) =>
                      handleFieldChange(field.key, e.target.value)
                    }
                    placeholder={field.question}
                    rows={3}
                    className="textarea-academic text-sm resize-none"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Holistic AI Audit Report Panel */}
      {auditReport && (
        <Card className="border border-primary/20 bg-primary/5 shadow-xs overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-primary/20 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h4 className="font-serif text-sm font-semibold tracking-tight text-foreground">
                  Akademik Not ve Eser Değerlendirme Raporu
                </h4>
                <Badge
                  variant="outline"
                  className={
                    auditReport.statusBadge === "EXCELLENT"
                      ? "bg-success/10 text-success border-success/30 text-[10px]"
                      : auditReport.statusBadge === "SOLID"
                        ? "bg-primary/10 text-primary border-primary/30 text-[10px]"
                        : "bg-warning/10 text-warning border-warning/30 text-[10px]"
                  }
                >
                  Skor: {auditReport.overallScore}/100
                </Badge>
              </div>

              <button
                type="button"
                onClick={() => setIsAuditOpen(!isAuditOpen)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Raporu genişlet veya daralt"
              >
                {isAuditOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {isAuditOpen && (
              <div className="space-y-3 pt-1 text-xs">
                <p className="text-foreground font-sans leading-relaxed">
                  {auditReport.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Strengths */}
                  {auditReport.strengths.length > 0 && (
                    <div className="rounded-md border border-success/20 bg-success/5 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-success font-semibold text-[11px]">
                        <Check className="h-3.5 w-3.5" /> Güçlü Yakalanan
                        Boyutlar
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                        {auditReport.strengths.map((str, i) => (
                          <li key={i}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Blind spots */}
                  {auditReport.blindSpots.length > 0 && (
                    <div className="rounded-md border border-warning/20 bg-warning/5 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-warning font-semibold text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5" /> Gözden Kaçan /
                        Eksik Noktalar
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                        {auditReport.blindSpots.map((spot, i) => (
                          <li key={i}>{spot}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Commentary risks */}
                {auditReport.commentaryRisks.length > 0 && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-destructive font-semibold text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5" /> Şerh ve Yorum
                      Uyarısı
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                      {auditReport.commentaryRisks.map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Thesis Alignment Advice */}
                {auditReport.thesisAlignmentAdvice && (
                  <div className="rounded-md border border-primary/20 bg-background/80 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
                      <Lightbulb className="h-3.5 w-3.5" /> Tez Probleminizle
                      Eklemlenme Tavsiyesi
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {auditReport.thesisAlignmentAdvice}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
