"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookMarked, Check, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCritiqueDraft } from "../../_hooks/use-critique-draft";
import {
  toCritiqueFieldValues,
  type CritiqueFieldKey,
} from "./critique-constants";
import { CritiqueFocusEditor } from "./critique-focus-editor";
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
 * debounced auto-save, and LLM audit evaluation.
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

  const { values, setFieldValue, handleResetDraft, hasDraft, completedCount } =
    useCritiqueDraft(resourceId, baseValues);

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
    <div className="space-y-6">
      {/* Workspace 1 Card: Eser Analizi Editor */}
      <div className="rounded-md border border-border bg-card/50 p-4 sm:p-5 space-y-4">
        {/* Header Bar: Title, Progress Badge, Save Status, Evaluate Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <BookMarked className="size-3.5 text-primary" />
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
              Eser Analizi
            </h3>
            <span className="text-xs font-medium text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/40">
              {completedCount}/5 Tamamlandı
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium animate-pulse">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Kaydediliyor...
              </span>
            )}

            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Check className="size-3.5 text-primary" /> Kaydedildi
              </span>
            )}

            {saveStatus === "idle" && hasDraft && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-primary" /> Taslak kaydedildi
                </span>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  title="Taslağı sıfırla"
                >
                  <RotateCcw className="h-3 w-3" />
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
                className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all"
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

        {/* Focused Step-by-Step Editor */}
        <CritiqueFocusEditor
          values={values}
          onFieldChange={handleFieldChange}
        />
      </div>

      {/* Holistic AI Audit Report Panel */}
      {auditReport && <CritiqueAuditPanel auditReport={auditReport} />}
    </div>
  );
}
