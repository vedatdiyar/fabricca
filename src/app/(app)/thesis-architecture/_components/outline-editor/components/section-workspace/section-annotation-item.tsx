"use client";

import { Annotation, Source } from "@/core/db/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Quote, Sparkles, Bookmark } from "lucide-react";

export type CitationNoteType = "DIRECT_QUOTE" | "PARAPHRASE" | "PERSONAL_NOTE";

/**
 * Returns badge styling and Turkish label for a given citation note type.
 *
 * @param noteType - The citation note type enum value.
 * @returns Config object with label, icon and Tailwind style classes.
 */
export function getNoteTypeBadgeConfig(noteType: CitationNoteType) {
  switch (noteType) {
    case "DIRECT_QUOTE":
      return {
        label: "Doğrudan Alıntı",
        icon: Quote,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-primary",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-primary/60",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-border",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-border",
      };
  }
}

interface SectionAnnotationItemProps {
  annotation: Annotation & { source?: Source };
}

/**
 * Pinned citation card rendered inside the section workspace: note type badge,
 * citation/note text with page number and the source it belongs to.
 *
 * @param root0 - Component props.
 * @param root0.annotation - The pinned annotation (citation card).
 */
export function SectionAnnotationItem({
  annotation,
}: SectionAnnotationItemProps) {
  const noteConfig = getNoteTypeBadgeConfig(annotation.noteType);
  const NoteIcon = noteConfig.icon;
  const sourceTitle = annotation.source?.title ?? "Kaynak bilinmiyor";
  const authors = annotation.source?.authors?.join(", ");

  return (
    <Card className="p-3.5 space-y-2.5 border-border/60 bg-card hover:border-border transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${noteConfig.className}`}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            {noteConfig.label}
          </span>
          {annotation.comment && (
            <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
              Şerh: {annotation.comment}
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[10px] border-primary/20 text-primary shrink-0"
        >
          s. {annotation.pageNumber}
        </Badge>
      </div>

      {annotation.noteType === "DIRECT_QUOTE" ? (
        <blockquote
          className={`relative pl-3 text-xs leading-relaxed text-foreground font-sans border-l-2 ${noteConfig.borderAccent}`}
        >
          &ldquo;{annotation.content}&rdquo;
        </blockquote>
      ) : (
        <p className="text-xs leading-relaxed text-foreground font-sans">
          {annotation.content}
        </p>
      )}

      <div className="pt-1.5 border-t border-border/40 flex items-center justify-between gap-2 text-[11px]">
        <span
          className="font-medium text-foreground truncate min-w-0"
          title={sourceTitle}
        >
          {authors ? `${authors} — ` : ""}
          {sourceTitle}
        </span>
      </div>
    </Card>
  );
}
