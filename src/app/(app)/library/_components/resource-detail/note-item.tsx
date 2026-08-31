"use client";

import React, { useState } from "react";
import {
  BookmarkCheck,
  MessageSquareQuote,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  LibraryOutlineItem,
  LibraryResourceNote,
  NoteType,
} from "../../_lib/types";

interface NoteItemProps {
  note: LibraryResourceNote;
  outlines?: LibraryOutlineItem[];
  onDeleteNoteClick: (noteId: number) => void;
  onUpdateNote?: (input: {
    noteId: number;
    pageNumber?: string;
    noteType?: NoteType;
  }) => void;
}

/**
 * Returns badge label and className for a given note type.
 *
 * @param noteType - Type of the note.
 * @returns Badge configuration with label and className.
 */
export function getNoteTypeBadgeConfig(noteType: NoteType) {
  switch (noteType) {
    case "DIRECT_QUOTE":
      return {
        label: "Doğrudan Alıntı",
        className: "bg-secondary text-secondary-foreground border-border",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        className: "bg-secondary text-secondary-foreground border-border",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        className: "bg-secondary text-secondary-foreground border-border",
      };
  }
}

/**
 * Renders an individual note or citation card with verification badge and diagnostic alerts.
 *
 * @param root0 - Component props.
 * @param root0.note - Note item to display.
 * @param root0.outlines - Optional thesis outline sections to resolve section name.
 * @param root0.onDeleteNoteClick - Callback triggered when the delete button is clicked.
 * @param root0.onUpdateNote - Optional callback to update note fields upon verification suggestions.
 * @returns The note item markup.
 */
export function NoteItem({
  note,
  outlines = [],
  onDeleteNoteClick,
  onUpdateNote,
}: NoteItemProps) {
  const noteBadge = getNoteTypeBadgeConfig(note.noteType);
  const [isIssuesExpanded, setIsIssuesExpanded] = useState(false);

  const linkedOutline =
    note.outlineIds && note.outlineIds.length > 0
      ? outlines.find((o) => note.outlineIds?.includes(o.id))
      : undefined;

  const verification = note.verificationData;
  const hasIssues =
    note.verificationStatus === "WARNING" ||
    (verification?.issues && verification.issues.length > 0);

  return (
    <div className="rounded-md border border-border bg-card/60 p-4 space-y-3 transition-all hover:border-border/80">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className="font-mono text-xs font-semibold bg-muted text-foreground border border-border/40"
          >
            {note.pageNumber}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs font-medium border ${noteBadge.className}`}
          >
            {noteBadge.label}
          </Badge>
          {linkedOutline && (
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-primary/30 bg-primary/10 text-primary flex items-center gap-1 max-w-[200px] truncate"
              title={linkedOutline.title}
            >
              <FolderTree className="h-3 w-3 shrink-0" />
              <span className="truncate">{linkedOutline.title}</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Verification Status Badge */}
          {note.verificationStatus === "PENDING" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />{" "}
              Doğrulanıyor...
            </span>
          )}

          {note.verificationStatus === "VERIFIED" && (
            <span
              className="flex items-center gap-1 text-xs text-primary font-medium"
              title={
                verification?.summary ||
                "Kaynak metinle ve sayfayla tam örtüşüyor."
              }
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Doğrulandı
            </span>
          )}

          {hasIssues && (
            <button
              type="button"
              onClick={() => setIsIssuesExpanded(!isIssuesExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 hover:bg-warning/20 border border-warning/20 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span>Olası Uyuşmazlık</span>
              {isIssuesExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}

          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> Alıntı Fişi
          </span>
        </div>
      </div>

      <p className="font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>

      {note.comment && (
        <div className="flex gap-2 rounded-md border border-border/40 border-l-2 border-l-primary bg-card/40 px-3 py-2">
          <MessageSquareQuote className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kişisel Yorum / Şerh
            </p>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {note.comment}
            </p>
          </div>
        </div>
      )}

      {/* Expandable Verification Issues / Suggestions Panel */}
      {hasIssues && isIssuesExpanded && verification && (
        <div className="rounded-md border border-warning/20 bg-warning/10 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-warning font-semibold text-[11px]">
            <Sparkles className="h-3.5 w-3.5" /> LLM Doğrulama Uyarısı & İpucu
          </div>

          <p className="text-muted-foreground leading-relaxed">
            {verification.summary}
          </p>

          <div className="space-y-2 pt-1">
            {verification.issues.map((issue, idx) => (
              <div
                key={`issue-${idx}-${issue.title.slice(0, 32)}`}
                className="p-2 rounded bg-background/80 border border-warning/20 space-y-1"
              >
                <p className="font-medium text-foreground text-[11px]">
                  {issue.title}
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {issue.description}
                </p>

                {issue.suggestedPage && onUpdateNote && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onUpdateNote({
                          noteId: note.id,
                          pageNumber: issue.suggestedPage,
                        })
                      }
                      className="h-6 text-[10px] font-medium gap-1 text-primary hover:bg-primary/10"
                    >
                      Sayfayı &quot;{issue.suggestedPage}&quot; Olarak Güncelle
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {verification.academicAdvice && (
            <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-warning/20">
              💡 {verification.academicAdvice}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
        <span className="text-[10px] text-muted-foreground font-mono">
          {new Date(note.createdAt).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteNoteClick(note.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
