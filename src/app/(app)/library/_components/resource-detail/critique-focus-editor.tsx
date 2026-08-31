"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CRITIQUE_FIELDS,
  type CritiqueDraftMap,
  type CritiqueFieldKey,
  getWordCount,
} from "./critique-constants";

interface CritiqueFocusEditorProps {
  values: CritiqueDraftMap;
  onFieldChange: (field: CritiqueFieldKey, val: string) => void;
  onTriggerEvaluate?: () => void;
  isEvaluating?: boolean;
}

/**
 * Step-by-step focused critique editor offering a clean writing canvas,
 * responsive 5-dimension stepper rail, academic guidance, and ergonomic navigation.
 *
 * @param props - Component props.
 * @param props.values - Current draft values for all critique dimensions.
 * @param props.onFieldChange - Callback invoked when text changes for any dimension.
 * @param props.onTriggerEvaluate - Optional callback to trigger holistic AI evaluation.
 * @param props.isEvaluating - Loading state for AI evaluation.
 * @returns The redesigned 5-dimensional critique editor markup.
 */
export function CritiqueFocusEditor({
  values,
  onFieldChange,
  onTriggerEvaluate,
  isEvaluating = false,
}: CritiqueFocusEditorProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const currentField = CRITIQUE_FIELDS[activeStepIndex];
  const currentWordCount = getWordCount(values[currentField.key]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (activeStepIndex < CRITIQUE_FIELDS.length - 1) {
        setActiveStepIndex((prev) => prev + 1);
      } else if (onTriggerEvaluate && !isEvaluating) {
        onTriggerEvaluate();
      }
    }
  };

  const completedCount = CRITIQUE_FIELDS.filter(
    (field) => values[field.key].trim().length > 0,
  ).length;

  return (
    <div className="space-y-3.5">
      {/* 5-Dimension Stepper Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CRITIQUE_FIELDS.map((field, idx) => {
          const isActive = activeStepIndex === idx;
          const isFilled = values[field.key].trim().length > 0;
          const FieldIcon = field.icon;

          return (
            <button
              key={field.key}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={cn(
                "group relative flex flex-col items-start justify-between p-2.5 sm:p-3 rounded-md border text-left transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-card border-primary/50 text-foreground ring-1 ring-primary/20 shadow-xs"
                  : isFilled
                    ? "bg-card/40 border-border text-foreground hover:bg-card/60 hover:border-border"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-card/30 hover:text-foreground",
              )}
            >
              {/* Top Row: Step Number, Icon & Completion Pill */}
              <div className="flex w-full items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded text-xs transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : isFilled
                          ? "bg-muted text-foreground border border-border/50"
                          : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    <FieldIcon className="size-3" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    0{field.number}
                  </span>
                </div>

                {isFilled ? (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Check className="size-2.5 stroke-[2.5]" />
                  </span>
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </div>

              {/* Bottom Row: Dimension Label */}
              <div className="w-full">
                <span
                  className={cn(
                    "block text-xs font-medium leading-tight font-sans",
                    isActive
                      ? "text-foreground font-semibold"
                      : isFilled
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {field.shortLabel}
                </span>
              </div>

              {/* Active Step Indicator Line */}
              {isActive && (
                <span className="absolute -bottom-px left-3 right-3 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Dimension Workspace Canvas */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
        {/* Academic Guidance & Word Count Bar */}
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 sm:p-3.5 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-xs font-medium text-foreground">
              <HelpCircle className="size-3.5 text-primary shrink-0 mt-0.5" />
              <span className="font-semibold text-foreground">
                {currentField.question}
              </span>
            </div>

            <span
              className={cn(
                "text-xs font-mono px-2 py-0.5 rounded-md border shrink-0 transition-colors",
                currentWordCount > 0
                  ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                  : "bg-muted/60 text-muted-foreground border-border/50 font-normal",
              )}
            >
              {currentWordCount} kelime
            </span>
          </div>

          <p className="text-xs text-muted-foreground font-sans leading-relaxed pl-5.5">
            {currentField.hint}
          </p>
        </div>

        {/* The Textarea Writing Canvas */}
        <div className="space-y-1.5">
          <Textarea
            value={values[currentField.key]}
            onChange={(e) => onFieldChange(currentField.key, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentField.placeholder}
            rows={7}
            className="min-h-[180px] text-sm leading-relaxed p-3.5 resize-none font-sans placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-end text-xs text-muted-foreground px-1 pt-0.5">
            <span className="text-xs font-mono ml-auto">
              {values[currentField.key].length} karakter
            </span>
          </div>
        </div>

        {/* Navigator Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={activeStepIndex === 0}
            className="h-8 gap-1.5 text-xs font-medium border-border hover:bg-muted/60"
          >
            <ChevronLeft className="size-3.5" />
            <span>Önceki Boyut</span>
          </Button>

          {/* Step Indicator Circles */}
          <div className="flex items-center gap-1.5">
            {CRITIQUE_FIELDS.map((field, i) => (
              <button
                key={field.key}
                type="button"
                onClick={() => setActiveStepIndex(i)}
                className={cn(
                  "size-2 rounded-full transition-all duration-200 cursor-pointer",
                  activeStepIndex === i
                    ? "bg-primary w-5"
                    : values[field.key].trim().length > 0
                      ? "bg-primary/50 hover:bg-primary"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
                aria-label={`Boyut ${i + 1}`}
              />
            ))}
          </div>

          {activeStepIndex < CRITIQUE_FIELDS.length - 1 ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() =>
                setActiveStepIndex((prev) =>
                  Math.min(prev + 1, CRITIQUE_FIELDS.length - 1),
                )
              }
              className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <span>Sonraki Boyut</span>
              <ChevronRight className="size-3.5" />
            </Button>
          ) : onTriggerEvaluate && completedCount === 5 ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onTriggerEvaluate}
              disabled={isEvaluating}
              className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              <Sparkles
                className={cn("size-3.5", isEvaluating && "animate-spin")}
              />
              <span>
                {isEvaluating ? "Değerlendiriliyor..." : "Analizi Değerlendir"}
              </span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveStepIndex(0)}
              className="h-8 gap-1.5 text-xs font-medium border-border"
            >
              <span>Başa Dön</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
