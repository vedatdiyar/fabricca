"use client";

import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITIQUE_FIELDS,
  type CritiqueDraftMap,
  type CritiqueFieldKey,
  getWordCount,
} from "./critique-constants";

interface CritiqueFocusEditorProps {
  values: CritiqueDraftMap;
  onFieldChange: (field: CritiqueFieldKey, val: string) => void;
}

/**
 * Step-by-step focused critique editor offering a clean writing area and minimal progress pills.
 *
 * @param props - Component props.
 * @param props.values - Current draft values for all critique dimensions.
 * @param props.onFieldChange - Callback invoked when text changes for any dimension.
 * @returns Step navigation tabs and active step editor markup.
 */
export function CritiqueFocusEditor({
  values,
  onFieldChange,
}: CritiqueFocusEditorProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const currentField = CRITIQUE_FIELDS[activeStepIndex];

  return (
    <div className="space-y-4">
      {/* Minimal Segmented Step Navigation Bar */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-md border border-border/40 overflow-x-auto">
        {CRITIQUE_FIELDS.map((field, idx) => {
          const isActive = activeStepIndex === idx;
          const isFilled = values[field.key].trim().length > 0;

          return (
            <button
              key={field.key}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-background text-foreground font-semibold border border-border/40 shadow-xs"
                  : isFilled
                    ? "text-foreground hover:bg-background/50"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-[11px] font-mono">{field.number}.</span>
              <span>{field.shortLabel}</span>
              {isFilled && <Check className="h-3 w-3 text-success ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Active Dimension Editor Flow (No redundant nested card frame) */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold text-foreground">
                {currentField.label}
              </Label>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                — {currentField.question}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {currentField.hint}
            </p>
          </div>

          <span className="text-[11px] text-muted-foreground font-mono shrink-0">
            {getWordCount(values[currentField.key])} kelime
          </span>
        </div>

        <Textarea
          value={values[currentField.key]}
          onChange={(e) => onFieldChange(currentField.key, e.target.value)}
          placeholder={currentField.question}
          rows={7}
          className="textarea-academic text-sm leading-relaxed p-3.5 resize-none"
        />

        {/* Step Navigator Footer */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={activeStepIndex === 0}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Önceki Boyut
          </Button>

          <div className="text-xs text-muted-foreground font-medium font-mono">
            Adım {activeStepIndex + 1} / {CRITIQUE_FIELDS.length}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setActiveStepIndex((prev) =>
                Math.min(prev + 1, CRITIQUE_FIELDS.length - 1),
              )
            }
            disabled={activeStepIndex === CRITIQUE_FIELDS.length - 1}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Sonraki Boyut
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

