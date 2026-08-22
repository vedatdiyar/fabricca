"use client";

import React from "react";
import {
  ExternalLink,
  Pencil,
  CheckCircle2,
  Circle,
  Trash2,
  BookOpen,
  FileText,
  Book,
  GraduationCap,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { LibraryResourceItem } from "../../_lib/types";

interface ResourceHeaderProps {
  resource: LibraryResourceItem;
  onOpenEditModal: () => void;
  onToggleReadStatus: (resourceId: number) => void;
  onDeletePdfClick?: () => void;
}

/**
 * Derives document type badge configuration (label, icon, styling).
 */
function getDocumentTypeConfig(docType?: string) {
  const norm = docType?.toLowerCase() || "";
  if (norm.includes("chapter")) {
    return {
      label: "Kitap Bölümü",
      icon: BookOpen,
      className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    };
  }
  if (norm.includes("article") || norm.includes("journal")) {
    return {
      label: "Makale",
      icon: FileText,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    };
  }
  if (norm.includes("book") || norm.includes("monograph")) {
    return {
      label: "Kitap",
      icon: Book,
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    };
  }
  if (norm.includes("thesis") || norm.includes("dissertation")) {
    return {
      label: "Tez",
      icon: GraduationCap,
      className: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    };
  }
  if (norm.includes("report")) {
    return {
      label: "Rapor",
      icon: FileSpreadsheet,
      className: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    };
  }
  return null;
}

/**
 * Determines the primary academic source venue (Journal name, Parent Book, or Publishing House).
 */
function getPrimarySourceVenue(resource: LibraryResourceItem): string | null {
  if (resource.containerTitle && resource.containerTitle.trim()) {
    return resource.containerTitle.trim();
  }

  if (
    resource.publisher &&
    resource.publisher.trim() &&
    resource.publisher !== "Belirtilmemiş"
  ) {
    let pub = resource.publisher.trim();
    if (pub.includes("Informa UK")) pub = "Taylor & Francis / Routledge";
    if (pub.includes("(CUP)")) pub = "Cambridge University Press";
    return pub;
  }

  return null;
}

/**
 * Renders the top metadata section for a library resource with an ultra-minimal, clean layout focused on essential source information.
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
  const docTypeConfig = getDocumentTypeConfig(resource.documentType);
  const sourceVenue = getPrimarySourceVenue(resource);

  return (
    <div className="space-y-2.5 border-b border-border/60 pb-3.5">
      {/* Top Bar: Subject Badges, Document Type, and Compact Icon Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] px-2 py-0.5 font-medium shrink-0",
              boxBadge.className,
            )}
          >
            {boxBadge.label}
          </Badge>

          {resource.subBoxTitle && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] px-2 py-0.5 border font-medium",
                boxBadge.className,
              )}
            >
              {resource.subBoxTitle}
            </Badge>
          )}

          {docTypeConfig && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] px-2 py-0.5 font-medium flex items-center gap-1 shrink-0",
                docTypeConfig.className,
              )}
            >
              <docTypeConfig.icon className="h-3 w-3" />
              <span>{docTypeConfig.label}</span>
            </Badge>
          )}
        </div>

        {/* Compact Action Buttons Toolbar: Düzenle - Sil - Okundu - PDF */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 1. Düzenle */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenEditModal}
            title="Künyeyi Düzenle"
            className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/80"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span className="sr-only">Künyeyi Düzenle</span>
          </Button>

          {/* 2. Sil */}
          {resource.pdfStatus === "READY" && onDeletePdfClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeletePdfClick}
              title="PDF Sil"
              className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">PDF Sil</span>
            </Button>
          )}

          {/* 3. Okundu */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleReadStatus(resource.id)}
            title={resource.isRead ? "Okunacak Yap" : "Okundu Olarak İşaretle"}
            className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/80"
          >
            {resource.isRead ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/70" />
            )}
            <span className="sr-only">
              {resource.isRead ? "Okundu" : "Okundu Olarak İşaretle"}
            </span>
          </Button>

          {/* 4. PDF Durumu */}
          {resource.pdfStatus === "READY" && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              title="PDF Yüklendi"
            >
              <FileText className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Main Academic Title */}
      <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
        {resource.title}
      </h2>

      {/* Essential Minimal Metadata Strip */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        {resource.authors.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-medium text-foreground/80">Yazar:</span>
            <span className="text-foreground/95">
              {resource.authors.join(", ")}
            </span>
          </div>
        )}

        {sourceVenue && (
          <>
            <span className="text-muted-foreground/40 font-bold select-none">
              •
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Yayıncı:</span>
              <span className="text-foreground/90">
                {sourceVenue}
                {resource.publicationYear
                  ? ` (${resource.publicationYear})`
                  : ""}
              </span>
            </div>
          </>
        )}

        {!sourceVenue && resource.publicationYear && (
          <>
            <span className="text-muted-foreground/40 font-bold select-none">
              •
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Yıl:</span>
              <span>{resource.publicationYear}</span>
            </div>
          </>
        )}

        {resource.doi && (
          <>
            <span className="text-muted-foreground/40 font-bold select-none">
              •
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">DOI:</span>
              <a
                href={`https://doi.org/${resource.doi}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline font-mono text-[11px]"
              >
                {resource.doi}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
