"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Check,
  RotateCcw,
  Loader2,
  Sparkles,
  Focus,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCritiqueDraft } from "../../_hooks/use-critique-draft";
import {
  toCritiqueFieldValues,
  type CritiqueFieldKey,
} from "./critique-constants";
import { CritiqueFocusEditor } from "./critique-focus-editor";
import { CritiqueGridEditor } from "./critique-grid-editor";
import { CritiqueAuditPanel } from "./critique-audit-panel";
import type {
  LibraryResourceCritique,
  ResourceAuditReport,
} from "../../_lib/types";
import type { CritiqueFormInput } from "../../_hooks/use-resource-critique";

export interface CritiqueSectionProps {
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

/**
 * Article analysis (Eser Analizi) container orchestrating step-by-step focus mode,
 * overview grid mode, debounced auto-save, and LLM audit evaluation.
 *
 * @param props - Component props.
 * @param props.resourceId - ID of the target resource.
 * @param props.critique - The saved analysis for the currently selected resource, when present.
 * @param props.onSaveCritique - Callback invoked when debounced auto-save triggers.
 * @param props.onEvaluateCritique - Callback to trigger holistic LLM evaluation.
 * @param props.isEvaluating - Loading state for LLM evaluation.
 * @returns The critique container and audit markup.
 */
export function CritiqueSection({
  resourceId,
  critique,
  onSaveCritique,
  onEvaluateCritique,
  isEvaluating = false,
}: CritiqueSectionProps) {
  const baseValues = toCritiqueFieldValues(critique);

  const {
    values,
    setFieldValue,
    handleResetDraft,
    hasDraft,
    completedCount,
  } = useCritiqueDraft(resourceId, baseValues);

  const [viewMode, setViewMode] = useState<"focus" | "all">("focus");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFieldChange = useCallback(
    (field: CritiqueFieldKey, val: string) => {
      const nextValues = setFieldValue(field, val);
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
    [setFieldValue, onSaveCritique],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const auditReport = critique?.aiEvaluation;

  return (
    <div className="space-y-4">
      <Card className="border border-border bg-background shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header Bar: Title, Save Status, View Mode Switcher, Evaluate Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <BookMarked className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-base sm:text-lg font-medium tracking-tight text-foreground">
                  Eser Analizi
                </h3>
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium border-border/60 text-muted-foreground"
                >
                  {completedCount}/5 Tamamlandı
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
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

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("focus")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                    viewMode === "focus"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Adım adım odak modu"
                >
                  <Focus className="h-3 w-3 text-primary" />
                  <span>Odak Modu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                    viewMode === "all"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Tüm boyutları göster"
                >
                  <LayoutGrid className="h-3 w-3 text-muted-foreground" />
                  <span>Bütünsel</span>
                </button>
              </div>

              {onEvaluateCritique && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEvaluateCritique(resourceId)}
                  disabled={isEvaluating}
                  className="h-7.5 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-all shadow-xs"
                >
                  <Sparkles
                    className={`h-3.5 w-3.5 text-primary ${
                      isEvaluating ? "animate-spin" : ""
                    }`}
                  />
                  {isEvaluating ? "Değerlendiriliyor..." : "Eseri Değerlendir"}
                </Button>
              )}
            </div>
          </div>

          {/* Render Active View Mode */}
          {viewMode === "focus" ? (
            <CritiqueFocusEditor
              values={values}
              onFieldChange={handleFieldChange}
            />
          ) : (
            <CritiqueGridEditor
              values={values}
              onFieldChange={handleFieldChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Holistic AI Audit Report Panel */}
      {auditReport && <CritiqueAuditPanel auditReport={auditReport} />}
    </div>
  );
}
