"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
 * Article analysis (Eser Analizi) container orchestrating 5-dimension focused writing,
 * live debounced auto-save, dimension progress metrics, and holistic LLM audit evaluation.
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

  const handleTriggerEvaluate = () => {
    if (onEvaluateCritique) {
      onEvaluateCritique(resourceId);
    }
  };

  const auditReport = critique?.aiEvaluation;
  const progressPercentage = Math.round((completedCount / 5) * 100);

  return (
    <div className="space-y-5">
      {/* Top Controls & Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-card/60 border border-border">
        {/* Left: Dimension Completion Tracker with Mini Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground font-sans">
              Analiz İlerlemesi
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              {completedCount} / 5 Boyut
            </span>
          </div>

          <Progress
            value={progressPercentage}
            className="hidden sm:flex w-24 h-2 bg-muted border border-border/50"
          />
        </div>

        {/* Right: Auto-save status & Evaluate Action */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium animate-pulse">
              <Loader2 className="size-3 animate-spin text-primary" />
              Kaydediliyor...
            </span>
          )}

          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <Check className="size-3 text-primary" /> Kaydedildi
            </span>
          )}

          {saveStatus === "idle" && hasDraft && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-primary" /> Taslak korundu
              </span>
              <button
                type="button"
                onClick={handleResetDraft}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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
              onClick={handleTriggerEvaluate}
              disabled={isEvaluating}
              className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles
                className={`h-3.5 w-3.5 text-primary ${
                  isEvaluating ? "animate-spin" : ""
                }`}
              />
              <span>
                {isEvaluating ? "Değerlendiriliyor..." : "Analizi Değerlendir"}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Focused Step-by-Step 5-Dimension Editor */}
      <CritiqueFocusEditor
        values={values}
        onFieldChange={handleFieldChange}
        onTriggerEvaluate={handleTriggerEvaluate}
        isEvaluating={isEvaluating}
      />

      {/* Holistic AI Audit Report Panel */}
      {auditReport && <CritiqueAuditPanel auditReport={auditReport} />}
    </div>
  );
}
