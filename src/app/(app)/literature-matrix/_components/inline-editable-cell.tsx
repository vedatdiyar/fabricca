"use client";

import React, { useState } from "react";
import { Loader2, Check, Pencil, Plus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InlineEditableCellProps {
  title?: string;
  sourceTitle?: string;
  value: string | null;
  placeholder?: string;
  onSave: (newValue: string) => Promise<void>;
}

/**
 * Table cell component that opens a mini Dialog modal for editing long academic texts cleanly.
 *
 * @param root0 - Component props.
 * @param root0.title - Field title displayed in the modal header (e.g. "Araştırma Sorusu").
 * @param root0.sourceTitle - Source title shown as context in the modal header.
 * @param root0.value - Initial or current text value.
 * @param root0.placeholder - Text shown when the cell is empty.
 * @param root0.onSave - Async callback triggered to persist edits.
 * @returns The interactive cell and edit modal markup.
 */
export function InlineEditableCell({
  title = "Metin Düzenle",
  sourceTitle,
  value,
  placeholder = "İçerik ekleyin...",
  onSave,
}: InlineEditableCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentValue, setCurrentValue] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setCurrentValue(value ?? "");
  }

  const handleOpen = () => {
    setCurrentValue(value ?? "");
    setIsOpen(true);
  };

  const handleSave = async () => {
    const trimmed = currentValue.trim();
    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsOpen(false);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2000);
    } catch {
      setCurrentValue(value ?? "");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <>
      {/* Cell Content Trigger */}
      <div
        onClick={handleOpen}
        className="group relative flex min-h-[48px] w-full cursor-pointer items-center justify-between text-left rounded-md border border-transparent p-2 text-sm transition-all hover:border-border hover:bg-accent/40"
      >
        {hasValue ? (
          <div className="line-clamp-3 w-full text-left font-sans leading-relaxed text-foreground/90">
            {value}
          </div>
        ) : (
          <div className="flex w-full items-center justify-start gap-1.5 rounded-md border border-dashed border-border/80 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary text-left">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>{placeholder}</span>
          </div>
        )}

        <div className="ml-1 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : showSavedFeedback ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            hasValue && (
              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            )
          )}
        </div>
      </div>

      {/* Mini Edit Dialog Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg border-border bg-card">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-serif text-lg font-semibold text-foreground">
              {title}
            </DialogTitle>
            {sourceTitle && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Kaynak:</span>{" "}
                {sourceTitle}
              </p>
            )}
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Textarea
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="w-full resize-none bg-background text-sm leading-relaxed text-foreground focus-visible:ring-1 focus-visible:ring-primary border-border p-3 font-sans"
              placeholder={`${title} içeriğini buraya detaylıca yazabilirsiniz...`}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground text-right">
              ⌘+Enter veya Ctrl+Enter ile kaydedebilirsiniz.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
              className="text-xs"
            >
              Vazgeç
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Kaydet</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
