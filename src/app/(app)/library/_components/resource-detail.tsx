"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Plus,
  Trash2,
  BookmarkCheck,
  BookMarked,
  CheckCircle2,
  Circle,
  Sparkles,
  Pencil,
  MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatPageNumber } from "@/lib/academic/utils";
import { normalizePastedText } from "@/lib/text-utils";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import { EditResourceModal } from "./edit-resource-modal";
import type {
  LibraryResourceItem,
  LibraryResourceNote,
  NoteType,
} from "../_types/types";

interface ResourceDetailProps {
  resource: LibraryResourceItem;
  notes: LibraryResourceNote[];
  onAddNote: (
    note: Omit<LibraryResourceNote, "id" | "createdAt" | "sentToCitationCards">,
  ) => void;
  onDeleteNote: (noteId: number) => void;
  onToggleReadStatus: (resourceId: number) => void;
  onUpdateResource?: (updatedResource: LibraryResourceItem) => void;
  onUploadPdf?: (file: File) => Promise<boolean>;
  onDeletePdf?: (resourceId: number) => Promise<void>;
}

/**
 * Returns badge label and className for a given note type.
 *
 * @param noteType - Type of the note.
 * @returns Badge configuration with label and className.
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
        label: "Dolaylı Alıntı",
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
 * Detailed view for a selected library resource with note taking and automatic citation card integration.
 *
 * @param root0 - Component props.
 * @param root0.resource - Selected library resource.
 * @param root0.notes - Notes associated with the resource.
 * @param root0.onAddNote - Callback to add a new note to the resource.
 * @param root0.onDeleteNote - Callback to delete a note by id.
 * @param root0.onToggleReadStatus - Callback to toggle the read status of a resource.
 * @param root0.onUpdateResource - Optional callback invoked after the resource metadata is updated.
 * @param root0.onUploadPdf - Optional callback that uploads a PDF for the resource.
 * @param root0.onDeletePdf - Optional callback that deletes the resource PDF.
 * @returns The resource detail markup.
 */
export function ResourceDetail({
  resource,
  notes,
  onAddNote,
  onDeleteNote,
  onToggleReadStatus,
  onUpdateResource,
  onUploadPdf,
  onDeletePdf,
}: ResourceDetailProps) {
  const [content, setContent] = useState("");
  const [comment, setComment] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("DIRECT_QUOTE");

  const [noteToDeleteId, setNoteToDeleteId] = useState<number | null>(null);
  const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const boxBadge = getBoxTypeBadgeConfig(resource.boxType);

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
      pageNumber: formatPageNumber(pageNumber),
      noteType,
      content: content.trim(),
      comment: comment.trim() || undefined,
    });

    setContent("");
    setComment("");
    setPageNumber("");
    setNoteType("DIRECT_QUOTE");
  };

  const handleConfirmDelete = () => {
    if (noteToDeleteId !== null) {
      onDeleteNote(noteToDeleteId);
      setNoteToDeleteId(null);
    }
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
    <div className="flex h-full w-full flex-col space-y-6 rounded-md border border-border bg-card p-6">
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
              onClick={() => setIsEditModalOpen(true)}
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

            {resource.pdfStatus === "READY" && onDeletePdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfToDeleteId(resource.id)}
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

      {resource.pdfStatus !== "READY" && onUploadPdf && (
        <PdfUploadDropzone
          resourceTitle={resource.title}
          pdfStatus={resource.pdfStatus}
          onUploadPdf={onUploadPdf}
        />
      )}

      {resource.pdfStatus === "READY" && (
        <>
          <Card className="border border-border bg-background">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                  Yeni Not veya Alıntı Ekle
                </h3>
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
                    className="textarea-academic text-sm resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MessageSquareQuote className="h-3.5 w-3.5 text-primary/70" />
                    <Label className="text-xs text-foreground font-medium">
                      Düşünce / Şerh
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (Opsiyonel)
                    </span>
                  </div>
                  <Textarea
                    ref={commentRef}
                    placeholder="Bu alıntıyı tez çalışmanızda nasıl değerlendirdiğinizi, kendi şerh veya yorumunuzu buraya ekleyin..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="textarea-academic text-sm resize-none"
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
                        className="text-xs bg-background border-border"
                      />
                    </div>

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
                                ? "px-2 py-1 text-xs font-semibold rounded bg-background text-foreground shadow-sm border border-border/60"
                                : "px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
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
            </CardContent>
          </Card>

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
                {notes.length} Alıntı Fişi
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
                            {"Alıntı Fişi"}
                          </span>
                        </div>

                        <p className="font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>

                        {note.comment && (
                          <div className="flex gap-2 rounded-md border border-border/40 border-l-2 border-l-primary/40 bg-muted/40 px-3 py-2.5">
                            <MessageSquareQuote className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                            <div className="space-y-1 min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Kişisel Yorum / Şerh
                              </p>
                              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                {note.comment}
                              </p>
                            </div>
                          </div>
                        )}

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
              Bu akademik not ve alıntı fişlerinizden kalıcı olarak
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

      <AlertDialog
        open={pdfToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPdfToDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold text-foreground">
              PDF&apos;i Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Bu PDF ve ilişkili tüm vektör verileri kalıcı olarak silinecektir.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pdfToDeleteId && onDeletePdf) {
                  try {
                    await onDeletePdf(pdfToDeleteId);
                  } catch {}
                }
                setPdfToDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditResourceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        resource={resource}
        onUpdateSuccess={(updatedResource) => {
          onUpdateResource?.(updatedResource);
        }}
      />
    </div>
  );
}
