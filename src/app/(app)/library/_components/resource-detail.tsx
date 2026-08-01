"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  Plus,
  Trash2,
  BookmarkCheck,
  BookMarked,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getBoxTypeBadgeConfig } from "./sidebar-work-list";
import { cn } from "@/lib/utils";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import type {
  LibraryResourceItem,
  LibraryResourceNote,
  NoteType,
} from "../_types/types";

interface ResourceDetailProps {
  /** Selected library resource object */
  resource: LibraryResourceItem;
  /** Notes associated with this resource */
  notes: LibraryResourceNote[];
  /** Callback to add a new note */
  onAddNote: (
    note: Omit<LibraryResourceNote, "id" | "createdAt" | "sentToCardIndex">,
  ) => void;
  /** Callback to delete a note */
  onDeleteNote: (noteId: number) => void;
  /** Callback to toggle read status of resource */
  onToggleReadStatus: (resourceId: number) => void;
  /** Callback to upload PDF file for this resource */
  onUploadPdf?: (file: File) => Promise<void>;
  /** Callback to delete PDF file for this resource */
  onDeletePdf?: (resourceId: number) => Promise<void>;
}

/**
 * Returns badge styling for individual note classification types.
 */
function getNoteTypeBadgeConfig(noteType: NoteType) {
  switch (noteType) {
    case "DIRECT_QUOTE":
      return {
        label: "Doğrudan Alıntı",
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      };
    case "PARAPHRASE":
      return {
        label: "Parafraz",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      };
  }
}

/**
 * Detailed view component for selected library resource with note taking and automatic Kartoteks integration.
 */
export function ResourceDetail({
  resource,
  notes,
  onAddNote,
  onDeleteNote,
  onToggleReadStatus,
  onUploadPdf,
  onDeletePdf,
}: ResourceDetailProps) {
  // Form state
  const [content, setContent] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("DIRECT_QUOTE");

  // Deletion confirmation modal state
  const [noteToDeleteId, setNoteToDeleteId] = useState<number | null>(null);

  const boxBadge = getBoxTypeBadgeConfig(resource.boxType);

  /**
   * Handles submitting the inline note form.
   */
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
      resourceId: resource.id,
      pageNumber: pageNumber.trim(),
      noteType,
      content: content.trim(),
    });

    // Reset form
    setContent("");
    setPageNumber("");
    setNoteType("DIRECT_QUOTE");

    toast.success("Not kaydedildi ve Kartoteks'e fiş olarak eklendi.");
  };

  /**
   * Confirms and deletes the selected note.
   */
  const handleConfirmDelete = () => {
    if (noteToDeleteId !== null) {
      onDeleteNote(noteToDeleteId);
      setNoteToDeleteId(null);
      toast.info("Not başarıyla silindi.");
    }
  };

  return (
    <div className="flex h-full w-full flex-col space-y-6 rounded-md border border-border bg-card p-6">
      {/* 1. TOP METADATA HEADER / KÜNYE */}
      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Box Badge(s) */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={boxBadge.className}>
              {boxBadge.label}
            </Badge>
            {resource.subBoxTitle && (
              <Badge
                variant="outline"
                className={cn(
                  "max-w-full text-[10px] px-1.5 py-0.5 border font-medium",
                  boxBadge.className,
                )}
              >
                <span className="truncate">{resource.subBoxTitle}</span>
              </Badge>
            )}
          </div>

          {/* Toggle Read Status Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onToggleReadStatus(resource.id);
              toast.success(
                resource.isRead
                  ? "Eser 'Okunacak' olarak işaretlendi."
                  : "Eser 'Okundu' olarak işaretlendi.",
              );
            }}
            className="gap-2 text-xs font-medium"
          >
            {resource.isRead ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Okundu</span>
              </>
            ) : (
              <>
                <Circle className="h-4 w-4 text-muted-foreground" />
                <span>Okundu Olarak İşaretle</span>
              </>
            )}
          </Button>
        </div>

        {/* Title */}
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground leading-tight">
          {resource.title}
        </h2>

        {/* Authors, Publisher, Year & DOI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border border-border/40">
          <div>
            <span className="font-medium text-foreground">Yazarlar: </span>
            {resource.authors.join(", ")}
          </div>
          <div>
            <span className="font-medium text-foreground">
              Yayıncı / Mecra:{" "}
            </span>
            {resource.publisher} ({resource.publicationYear})
          </div>
          {resource.doi && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">DOI: </span>
              <a
                href={`https://doi.org/${resource.doi}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
              >
                {resource.doi}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {resource.pdfStatus === "READY" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  PDF Durumu:{" "}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  PDF Yüklendi
                </span>
              </div>
              {onDeletePdf && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await onDeletePdf(resource.id);
                    } catch {
                      // Handled in parent
                    }
                  }}
                  className="h-6 text-[11px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 font-normal"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. PDF UPLOAD DROPZONE IF NOT YET READY */}
      {resource.pdfStatus !== "READY" && onUploadPdf && (
        <PdfUploadDropzone
          resourceTitle={resource.title}
          pdfStatus={resource.pdfStatus}
          onUploadPdf={onUploadPdf}
        />
      )}

      {/* 3. NOTE TAKING AND CITATIONS (ONLY WHEN PDF IS READY) */}
      {resource.pdfStatus === "READY" && (
        <>
          {/* INLINE NOTE / CITATION ADDITION FORM */}
          <Card className="border border-border bg-background">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                  Yeni Not / Sayfa Numaralı Alıntı Ekle
                </h3>
              </div>

              <form onSubmit={handleSaveNote} className="space-y-4">
                {/* Note Content Textarea */}
                <div className="space-y-1">
                  <Textarea
                    placeholder="Eserden doğrudan alıntı veya kişisel notunuzu buraya yazınız..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    className="textarea-academic text-sm"
                  />
                </div>

                {/* Controls Row: Sayfa No + Note Type Select + Submit Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    {/* Sayfa No Input */}
                    <div className="w-28">
                      <Input
                        type="text"
                        placeholder="Sayfa No"
                        value={pageNumber}
                        onChange={(e) => setPageNumber(e.target.value)}
                        className="text-xs bg-background border-border"
                      />
                    </div>

                    {/* Note Type Select Pills */}
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-md border border-border/40">
                      {(
                        [
                          "DIRECT_QUOTE",
                          "PARAPHRASE",
                          "PERSONAL_NOTE",
                        ] as NoteType[]
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
                                ? "px-2 py-1 text-xs font-semibold rounded bg-background text-foreground shadow-sm border border-border/60 cursor-pointer"
                                : "px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            }
                          >
                            {badgeInfo.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Button */}
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
            </CardContent>
          </Card>

          {/* SAVED NOTES & CITATION CARDS LIST (KARTOTEKS FİŞ FORMATI) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  Akademik Notlarım ve Alıntılarım
                </h3>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-medium border-border"
              >
                {notes.length} Kartoteks Fişi
              </Badge>
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
                <Sparkles className="h-6 w-6 opacity-40 mb-2" />
                <p className="text-sm font-medium">
                  Henüz bu eser için not veya alıntı girilmemiş.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Yukarıdaki formu kullanarak ilk sayfa numaralı alıntınızı
                  ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => {
                  const noteBadge = getNoteTypeBadgeConfig(note.noteType);

                  return (
                    <Card
                      key={note.id}
                      className="border border-border bg-background transition-all hover:border-primary/40"
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Header: Page Badge + Type Badge + Automatic Kartoteks Status */}
                        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs font-semibold bg-muted text-foreground border border-border/60"
                            >
                              {note.pageNumber}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${noteBadge.className}`}
                            >
                              {noteBadge.label}
                            </Badge>
                          </div>

                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <BookmarkCheck className="h-3.5 w-3.5" />{" "}
                            {"Kartoteks Fişi"}
                          </span>
                        </div>

                        {/* Content Text */}
                        <p className="font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(note.createdAt).toLocaleDateString(
                              "tr-TR",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Delete Action (Triggers Confirmation Dialog) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setNoteToDeleteId(note.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. DELETE CONFIRMATION DIALOG */}
      <AlertDialog
        open={noteToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setNoteToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              Notu Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu akademik not ve alıntı Kartoteks fişlerinizden kalıcı olarak
              silinecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
