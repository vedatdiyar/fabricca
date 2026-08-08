"use client";

import React from "react";
import { ExternalLink, Pencil, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { LibraryResourceItem } from "../../_types/types";

interface ResourceHeaderProps {
  resource: LibraryResourceItem;
  onOpenEditModal: () => void;
  onToggleReadStatus: (resourceId: number) => void;
  onDeletePdfClick?: () => void;
}

/**
 * Renders the top metadata section for a library resource including badges, title, authors, publisher, DOI link, and header action buttons.
 *
 * @param root0 - Component props.
 * @param root0.resource - Selected library resource.
 * @param root0.onOpenEditModal - Callback to open the edit modal.
 * @param root0.onToggleReadStatus - Callback to toggle the read status of a resource.
 * @param root0.onDeletePdfClick - Optional callback to trigger PDF deletion confirmation.
 * @returns The resource header markup.
 */
export function ResourceHeader({
  resource,
  onOpenEditModal,
  onToggleReadStatus,
  onDeletePdfClick,
}: ResourceHeaderProps) {
  const boxBadge = getBoxTypeBadgeConfig(resource.boxType);

  return (
    <div className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[11px]", boxBadge.className)}
          >
            {boxBadge.label}
          </Badge>
          {resource.subBoxTitle && (
            <Badge
              variant="outline"
              className={cn(
                "max-w-full text-[11px] px-1.5 py-0.5 border font-medium",
                boxBadge.className,
              )}
            >
              <span className="truncate">{resource.subBoxTitle}</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenEditModal}
            title="Künyeyi Düzenle"
            className="h-8 gap-1.5 text-[11px] font-medium border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span>Künyeyi Düzenle</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleReadStatus(resource.id)}
            title={
              resource.isRead ? "Okunacak Yap" : "Okundu Olarak İşaretle"
            }
            className="h-8 gap-1.5 text-[11px] font-medium border-border/80"
          >
            {resource.isRead ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Okundu
                </span>
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Okundu Olarak İşaretle
                </span>
              </>
            )}
          </Button>

          {resource.pdfStatus === "READY" && onDeletePdfClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeletePdfClick}
              title="PDF'i Sil"
              className="h-8 w-8 p-0 border-border/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground leading-tight">
        {resource.title}
      </h2>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-1">
          <span className="font-medium text-foreground">Yazarlar:</span>
          <span>{resource.authors.join(", ")}</span>
        </div>
        <span className="text-muted-foreground font-bold select-none">•</span>
        <div className="flex items-center gap-1">
          <span className="font-medium text-foreground">Yayıncı:</span>
          <span>
            {resource.publisher}
            {resource.publicationYear ? ` (${resource.publicationYear})` : ""}
          </span>
        </div>
        {resource.doi && (
          <>
            <span className="text-muted-foreground font-bold select-none">
              •
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">DOI:</span>
              <a
                href={`https://doi.org/${resource.doi}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-mono"
              >
                {resource.doi}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}
        {resource.pdfStatus === "READY" && (
          <>
            <span className="text-muted-foreground font-bold select-none">
              •
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                PDF Yüklendi
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
