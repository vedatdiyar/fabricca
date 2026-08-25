"use client";

import { BookOpen, FileText } from "lucide-react";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AssistantCitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: RagSearchResultItem | null;
}

/**
 * Modal dialog presenting detailed information and content for a selected citation chunk.
 *
 * @param props - Component props.
 * @param props.isOpen - Whether the dialog is visible.
 * @param props.onClose - Callback to dismiss the dialog.
 * @param props.source - The active RAG search source item.
 * @returns The rendered dialog markup.
 */
export function AssistantCitationDialog({
  isOpen,
  onClose,
  source,
}: AssistantCitationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-5 rounded-lg border-border bg-card">
        <DialogHeader className="space-y-1.5 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="size-3.5" />
            </div>
            <DialogTitle className="font-serif text-sm font-semibold tracking-tight text-foreground">
              {source?.resourceTitle || "Kaynak Detayı"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            {source?.resourceAuthors && source.resourceAuthors.length > 0 && (
              <span>{source.resourceAuthors.join(", ")}</span>
            )}
            {source?.resourceYear && (
              <span className="font-mono">({source.resourceYear})</span>
            )}
            {source?.pageNumber && (
              <span className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-mono border border-border">
                s. {source.pageNumber}
              </span>
            )}
            {source?.sectionTitle && (
              <span className="text-muted-foreground">• {source.sectionTitle}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {source ? (
          <div className="space-y-3 pt-2 text-xs leading-relaxed max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FileText className="size-3 text-primary" />
                İlgili Metin Pasajı
              </span>
              <div className="p-3 rounded-md bg-background border border-border text-foreground font-sans whitespace-pre-wrap leading-relaxed">
                {source.content}
              </div>
            </div>

            {source.parentContent && source.parentContent !== source.content && (
              <div className="space-y-1 pt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Genişletilmiş Paragraf Bağlamı
                </span>
                <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 text-muted-foreground font-sans text-xs whitespace-pre-wrap leading-relaxed">
                  {source.parentContent}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Kaynak içeriği yüklenemedi.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
