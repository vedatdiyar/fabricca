"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border border-border/50">
        {CRITIQUE_FIELDS.map((field, idx) => {
          const isActive = activeStepIndex === idx;
          const isFilled = values[field.key].trim().length > 0;

          return (
            <button
              key={field.key}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap overflow-hidden transition-all ${
                isActive
                  ? "bg-card text-foreground font-semibold border border-border/70 shadow-xs"
                  : isFilled
                    ? "text-foreground hover:bg-card/40 font-medium"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-mono text-xs shrink-0 text-muted-foreground">
                {field.number}.
              </span>
              <span className="truncate">{field.shortLabel}</span>
              {isFilled && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Dimension Editor Flow */}
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
            <p className="text-xs text-muted-foreground">{currentField.hint}</p>
          </div>

          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {getWordCount(values[currentField.key])} kelime
          </span>
        </div>

        <Textarea
          value={values[currentField.key]}
          onChange={(e) => onFieldChange(currentField.key, e.target.value)}
          placeholder={currentField.question}
          rows={7}
          className="textarea-academic text-sm leading-relaxed p-3.5 resize-none bg-card/60 hover:bg-card/80 focus:bg-card border-border/60 focus:border-primary/40"
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
