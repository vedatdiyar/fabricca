"use client";

import React, { useEffect, useRef } from "react";
import { Plus, MessageSquareQuote, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPageNumber } from "@/lib/academic/utils";
import { normalizePastedText } from "@/lib/text-utils";
import { getNoteTypeBadgeConfig } from "./note-item";
import { useNoteDraft } from "../../_hooks/use-note-draft";
import type { LibraryResourceNote, NoteType } from "../../_lib/types";

interface NoteFormProps {
  resourceId: number;
  onAddNote: (
    note: Omit<
      LibraryResourceNote,
      | "id"
      | "createdAt"
      | "sentToCitationCards"
      | "verificationStatus"
      | "verificationData"
    >,
  ) => void;
}

/**
 * Form component for adding a new academic note or direct quote with page numbers and comments.
 *
 * @param root0 - Component props.
 * @param root0.resourceId - ID of the target resource.
 * @param root0.onAddNote - Callback to add a new note.
 * @returns The note form markup.
 */
export function NoteForm({ resourceId, onAddNote }: NoteFormProps) {
  const {
    content,
    setContent,
    comment,
    setComment,
    pageNumber,
    setPageNumber,
    noteType,
    setNoteType,
    hasDraft,
    clearDraft,
  } = useNoteDraft(resourceId);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    el.style.height = "auto";

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const verticalPadding =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0);
    const maxHeight = lineHeight * 8 + verticalPadding;

    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [content]);

  useEffect(() => {
    const el = commentRef.current;
    if (!el) return;

    el.style.height = "auto";

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const verticalPadding =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0);
    const maxHeight = lineHeight * 5 + verticalPadding;

    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [comment]);

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Lütfen not veya alıntı metnini giriniz.");
      return;
    }

    if (!pageNumber.trim()) {
      toast.error("Lütfen sayfa numarasını giriniz.");
      return;
    }

    onAddNote({
      resourceId,
      pageNumber: formatPageNumber(pageNumber),
      noteType,
      content: content.trim(),
      comment: comment.trim() || undefined,
    });

    clearDraft();
  };

  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!raw) return;

    const cleaned = normalizePastedText(raw);
    if (cleaned === raw) return;

    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = el.value.slice(0, start) + cleaned + el.value.slice(end);

    setContent(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + cleaned.length;
    });
  };

  return (
    <div className="rounded-md border border-border bg-card/50 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base sm:text-lg font-medium tracking-tight text-foreground">
            Yeni Not veya Alıntı Ekle
          </h3>
        </div>

        {hasDraft && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <Check className="h-3 w-3 text-primary" /> Otomatik kaydedildi
            </span>
            <button
              type="button"
              onClick={clearDraft}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              title="Taslağı temizle"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Taslağı Temizle</span>
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveNote} className="space-y-4">
        <div className="space-y-1">
          <Textarea
            ref={contentRef}
            placeholder="Eserden doğrudan alıntı veya kişisel notunuzu buraya yazınız..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handleContentPaste}
            rows={5}
            className="textarea-academic text-sm leading-relaxed p-3.5 resize-none bg-card/60 hover:bg-card/80 focus:bg-card border-border/60 focus:border-primary/40"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
            <Label className="text-xs text-foreground font-medium">
              Düşünce / Şerh
            </Label>
            <span className="text-xs text-muted-foreground font-normal">
              (Opsiyonel)
            </span>
          </div>
          <Textarea
            ref={commentRef}
            placeholder="Bu alıntıyı tez çalışmanızda nasıl değerlendirdiğinizi, kendi şerh veya yorumunuzu buraya ekleyin..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="textarea-academic text-sm leading-relaxed p-3 resize-none bg-card/60 hover:bg-card/80 focus:bg-card border-border/60 focus:border-primary/40"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-36">
              <Input
                type="text"
                placeholder="Örn: 15 veya 15-17"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                className="text-xs bg-card/70 border-border/60"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border border-border/50">
              {(
                ["DIRECT_QUOTE", "PARAPHRASE", "PERSONAL_NOTE"] as NoteType[]
              ).map((type) => {
                const isActive = noteType === type;
                const badgeInfo = getNoteTypeBadgeConfig(type);
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setNoteType(type)}
                    className={
                      isActive
                        ? "px-2.5 py-1 text-xs font-semibold rounded bg-card text-foreground border border-border/70 shadow-xs"
                        : "px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    }
                  >
                    {badgeInfo.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            variant="default"
            size="sm"
            className="gap-2 font-medium"
          >
            <Plus className="h-4 w-4" /> Notu Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}
