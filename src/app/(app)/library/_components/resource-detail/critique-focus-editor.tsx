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
 * Step-by-step focused critique editor offering spacious writing area and progress indicators.
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
  const CurrentIcon = currentField.icon;

  return (
    <div className="space-y-4">
      {/* Step Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/40">
        {CRITIQUE_FIELDS.map((field, idx) => {
          const Icon = field.icon;
          const isActive = activeStepIndex === idx;
          const isFilled = values[field.key].trim().length > 0;

          return (
            <button
              key={field.key}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              className={`flex items-center justify-start sm:justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all text-left sm:text-center ${
                idx === 4 ? "col-span-2 sm:col-span-1" : ""
              } ${
                isActive
                  ? "bg-background text-foreground shadow-xs border border-border/60 font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              <span
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isFilled
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isFilled && !isActive ? (
                  <Check className="h-3 w-3" />
                ) : (
                  field.number
                )}
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{field.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Active Dimension Editor Box */}
      <div className="rounded-lg border border-border/60 bg-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/30 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                {currentField.number}
              </span>
              <CurrentIcon className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold text-foreground">
                {currentField.label}
              </Label>
            </div>
            <p className="text-xs text-foreground/80 font-medium">
              {currentField.question}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {currentField.hint}
            </p>
          </div>

          <span className="text-[11px] text-muted-foreground font-mono self-start">
            {getWordCount(values[currentField.key])} kelime
          </span>
        </div>

        <Textarea
          value={values[currentField.key]}
          onChange={(e) => onFieldChange(currentField.key, e.target.value)}
          placeholder={currentField.question}
          rows={8}
          className="textarea-academic text-sm leading-relaxed p-3.5 min-h-[220px] resize-y rounded-md"
        />

        {/* Step Navigator Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={activeStepIndex === 0}
            className="h-8 gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Önceki Boyut
          </Button>

          <div className="text-xs text-muted-foreground font-medium">
            Adım {activeStepIndex + 1} / {CRITIQUE_FIELDS.length}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setActiveStepIndex((prev) =>
                Math.min(prev + 1, CRITIQUE_FIELDS.length - 1),
              )
            }
            disabled={activeStepIndex === CRITIQUE_FIELDS.length - 1}
            className="h-8 gap-1 text-xs"
          >
            Sonraki Boyut
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
