"use client";

import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { QuadrantConfig } from "./quadrant-config";

interface QuadrantCardProps {
  quadrant: QuadrantConfig;
  content: string;
  draftContent: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDraftChange: (value: string) => void;
}

/**
 * Renders a single 4-quadrant card with preview/edit toggle.
 *
 * @param props - Quadrant card props.
 * @returns Quadrant card markup.
 */
export function QuadrantCard({
  quadrant,
  content,
  draftContent,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDraftChange,
}: QuadrantCardProps) {
  const Icon = quadrant.icon;

  return (
    <Card
      className={`p-5 sm:p-6 space-y-3.5 rounded-md border bg-card transition-all ${
        isEditing
          ? "border-primary/40 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center size-6 rounded bg-primary/10 text-primary font-mono text-xs font-semibold shrink-0">
            {quadrant.number}
          </span>
          <Icon className="size-4 text-primary shrink-0" />
          <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground truncate">
            {quadrant.title}
          </h3>
          {quadrant.required && (
            <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
              Zorunlu
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                className="h-7 text-xs px-2.5 rounded-md text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="size-3.5" />
                <span>İptal</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onSaveEdit}
                className="h-7 text-xs px-2.5 rounded-md font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 gap-1"
              >
                <Check className="size-3.5" />
                <span>Kaydet</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onStartEdit}
              className="h-7 text-xs px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary gap-1.5 transition-colors"
              title={`${quadrant.title} alanını düzenle`}
            >
              <Pencil className="size-3.5 text-primary" />
              <span>Düzenle</span>
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2 pt-1">
          <Textarea
            id={quadrant.key}
            value={draftContent}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={quadrant.rows}
            placeholder={quadrant.placeholder}
            className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {quadrant.placeholder}
          </p>
        </div>
      ) : (
        <div
          onClick={onStartEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStartEdit();
            }
          }}
          className={`p-4 rounded-md text-sm leading-relaxed text-foreground whitespace-pre-wrap transition-colors cursor-pointer border ${
            content.trim().length > 0
              ? "bg-secondary/30 border-border/40 hover:border-primary/30 hover:bg-secondary/50 font-normal"
              : "bg-muted/20 border-dashed border-border/60 hover:border-primary/40 text-xs italic text-muted-foreground flex items-center gap-2"
          }`}
          title="Düzenlemek için tıklayın"
        >
          {content.trim().length > 0 ? (
            content
          ) : (
            <>
              <Pencil className="size-3.5 text-muted-foreground shrink-0" />
              <span>Henüz içerik girilmedi. Düzenlemek için tıklayın.</span>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
