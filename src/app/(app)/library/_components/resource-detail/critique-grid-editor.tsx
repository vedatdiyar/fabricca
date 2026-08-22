"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITIQUE_FIELDS,
  type CritiqueDraftMap,
  type CritiqueFieldKey,
  getWordCount,
} from "./critique-constants";

interface CritiqueGridEditorProps {
  values: CritiqueDraftMap;
  onFieldChange: (field: CritiqueFieldKey, val: string) => void;
}

/**
 * Responsive 2-column grid layout rendering all 5 critique dimensions simultaneously.
 *
 * @param props - Component props.
 * @param props.values - Current draft values for all critique dimensions.
 * @param props.onFieldChange - Callback invoked when text changes for any dimension.
 * @returns Overview grid editor markup.
 */
export function CritiqueGridEditor({
  values,
  onFieldChange,
}: CritiqueGridEditorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {CRITIQUE_FIELDS.map((field, idx) => {
        const isLast = idx === CRITIQUE_FIELDS.length - 1;

        return (
          <div
            key={field.key}
            className={`rounded-md border border-border/40 bg-background p-3.5 space-y-2.5 ${
              isLast ? "md:col-span-2" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-primary">
                    {field.number}.
                  </span>
                  <Label className="text-xs font-semibold text-foreground truncate">
                    {field.label}
                  </Label>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {field.question}
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {getWordCount(values[field.key])} kelime
              </span>
            </div>

            <Textarea
              value={values[field.key]}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              placeholder={field.question}
              rows={4}
              className="textarea-academic text-sm leading-relaxed p-3 resize-none"
            />
          </div>
        );
      })}
    </div>
  );
}

