"use client";

import { useState } from "react";
import {
  BookOpen,
  FileText,
  Copy,
  Check,
  Bookmark,
  ChevronDown,
  User,
  Quote,
} from "lucide-react";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantCitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: RagSearchResultItem | null;
}

/**
 * Format page number string cleanly, preventing duplicate 's.' or 'p.' prefixes.
 *
 * @param page - Raw page number string from search chunk.
 * @returns Cleanly prefixed page string or null.
 */
function formatPageNumber(page?: string | null): string | null {
  if (!page) return null;
  const cleaned = page
    .trim()
    .replace(/^(s\.|p\.|page\s*)/i, "")
    .trim();
  return cleaned ? `s. ${cleaned}` : null;
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
  const [copied, setCopied] = useState(false);
  const [isParentExpanded, setIsParentExpanded] = useState(false);

  const handleCopy = async () => {
    if (!source?.content) return;
    try {
      await navigator.clipboard.writeText(source.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const formattedPage = formatPageNumber(source?.pageNumber);
  const hasDistinctParent =
    Boolean(source?.parentContent) && source?.parentContent !== source?.content;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-6 rounded-lg border-border bg-card shadow-lg sm:max-w-2xl">
        <DialogHeader className="space-y-2.5 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
              <BookOpen className="size-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground leading-snug">
                {source?.resourceTitle || "Kaynak Detayı"}
              </DialogTitle>

              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                  {source?.resourceAuthors &&
                    source.resourceAuthors.length > 0 && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <User className="size-3 text-muted-foreground" />
                        {source.resourceAuthors.join(", ")}
                      </span>
                    )}
                  {source?.resourceYear && (
                    <span className="font-mono px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs border border-border">
                      {source.resourceYear}
                    </span>
                  )}
                  {formattedPage && (
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-mono border border-border flex items-center gap-1">
                      <Bookmark className="size-3 text-primary" />
                      {formattedPage}
                    </span>
                  )}
                  {source?.sectionTitle && (
                    <span className="text-muted-foreground line-clamp-1">
                      • {source.sectionTitle}
                    </span>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {source ? (
          <div className="space-y-4 pt-1 max-h-[60vh] overflow-y-auto pr-1">
            {/* Main Cited Excerpt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Quote className="size-3.5 text-primary" />
                  İlgili Metin Pasajı
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Pasajı Kopyala"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-primary" />
                      <span className="text-primary font-medium">
                        Kopyalandı
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-3.5 rounded-md bg-background border border-border border-l-2 border-l-primary text-foreground font-sans text-sm leading-relaxed whitespace-pre-wrap selection:bg-primary/20">
                {source.content}
              </div>
            </div>

            {/* Expanded Context Accordion */}
            {hasDistinctParent && (
              <div className="rounded-md border border-border/40 bg-muted/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsParentExpanded((prev) => !prev)}
                  className="flex items-center justify-between w-full p-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors cursor-pointer"
                  aria-expanded={isParentExpanded}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span>Genişletilmiş Paragraf Bağlamı</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform duration-200",
                      isParentExpanded && "rotate-180 text-foreground",
                    )}
                  />
                </button>

                {isParentExpanded && (
                  <div className="p-3 pt-0 text-xs font-sans leading-relaxed text-muted-foreground whitespace-pre-wrap border-t border-border/20">
                    {source.parentContent}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Kaynak içeriği yüklenemedi.
          </div>
        )}

        <DialogFooter className="border-t border-border pt-3 sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground hidden sm:block">
            Kütüphane semantik arama alıntısı
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs px-3 rounded-md"
            >
              Kapat
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCopy}
              disabled={!source?.content}
              className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Pasajı Kopyala
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
