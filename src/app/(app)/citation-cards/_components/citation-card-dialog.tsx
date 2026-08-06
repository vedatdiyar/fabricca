"use client";

import { useState } from "react";
import { MessageSquareQuote, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cleanPageNumberInput, formatPageNumber } from "@/lib/academic/utils";
import { normalizePastedText } from "@/lib/text-utils";
import { BOX_TYPE_LABELS, getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { getNoteTypeBadgeConfig } from "./citation-card";
import type {
  CitationCardItem,
  CitationNoteType,
  BoxItem,
  SourceItem,
} from "../_lib/types";

/** Turkish labels dictionary for note types. */
const NOTE_TYPE_DISPLAY_LABELS: Record<CitationNoteType, string> = {
  DIRECT_QUOTE: "Doğrudan Alıntı",
  PARAPHRASE: "Dolaylı Alıntı",
  PERSONAL_NOTE: "Kişisel Not",
};

/** Props for CitationCardDialog. */
export interface CitationCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardToEdit?: CitationCardItem | null;
  mode: "view" | "edit";
  sources: SourceItem[];
  boxes: BoxItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
}

/**
 * Dialog component for creating a new citation card, editing an existing card,
 * or viewing an existing card in read-only mode.
 *
 * @param props - Dialog visibility state, items, and save callback.
 * @returns Dialog markup.
 */
export function CitationCardDialog(props: CitationCardDialogProps) {
  const { open, onOpenChange, cardToEdit, mode, sources, boxes, onSave } =
    props;

  const preventViewAutofocus = Boolean(cardToEdit) && mode === "view";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl sm:max-w-3xl p-6"
        onOpenAutoFocus={
          preventViewAutofocus ? (e) => e.preventDefault() : undefined
        }
      >
        {open && (
          <DialogBody
            key={`${cardToEdit?.id ?? "new"}-${mode}`}
            cardToEdit={cardToEdit}
            mode={mode}
            sources={sources}
            boxes={boxes}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Props for the dialog body that owns the view/edit toggle state. */
interface DialogBodyProps {
  cardToEdit?: CitationCardItem | null;
  mode: "view" | "edit";
  sources: SourceItem[];
  boxes: BoxItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
  onClose: () => void;
}

/**
 * Holds the internal view/edit state of the citation card dialog and renders
 * the read-only view or the editable form accordingly.
 *
 * @param props - Dialog body props.
 * @returns Either the read-only view or the edit form markup.
 */
function DialogBody(props: DialogBodyProps) {
  const { cardToEdit, mode, sources, boxes, onSave, onClose } = props;
  const [isEditing, setIsEditing] = useState(mode === "edit");

  const isNewCard = !cardToEdit;
  const title = isNewCard
    ? "Yeni Alıntı Fişi Oluştur"
    : isEditing
      ? "Alıntı Fişini Düzenle"
      : "Alıntı Fişi";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
        <DialogDescription className="text-xs">
          Kaynaklardan derlediğiniz doğrudan alıntı, açımlama veya kişisel
          değerlendirme notlarınızı fişleyin.
        </DialogDescription>
      </DialogHeader>

      {cardToEdit && !isEditing ? (
        <CitationCardView
          card={cardToEdit}
          onEdit={() => setIsEditing(true)}
          onClose={onClose}
        />
      ) : (
        <CitationCardForm
          cardToEdit={cardToEdit}
          sources={sources}
          boxes={boxes}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </>
  );
}

/** Props for the read-only citation card view. */
interface CitationCardViewProps {
  card: CitationCardItem;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * Read-only display of an existing citation card with an edit entry point.
 *
 * @param props - Card data and action callbacks.
 * @returns Read-only card view markup.
 */
function CitationCardView(props: CitationCardViewProps) {
  const { card, onEdit, onClose } = props;

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);

  const authorsDisplay =
    card.sourceAuthors.length > 2
      ? `${card.sourceAuthors[0]} ve diğerleri`
      : card.sourceAuthors.join(" & ");

  return (
    <div className="space-y-4 py-2">
      {/* Kaynak & Konu Kutusu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Akademik Kaynak</Label>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {card.sourceTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {authorsDisplay} ({card.sourceYear})
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Bağlı Konu Kutusu</Label>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs font-medium w-fit ${boxConfig.className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${boxConfig.dotClassName}`}
            />
            {card.boxTitle}
          </Badge>
        </div>
      </div>

      {/* Not Türü & Sayfa Numarası */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Not Türü</Label>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs font-medium w-fit ${noteConfig.className}`}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            {noteConfig.label}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Sayfa Numarası</Label>
          <p className="font-mono text-sm font-semibold text-foreground">
            {card.pageNumber}
          </p>
        </div>
      </div>

      {/* Fiş İçeriği */}
      <div className="space-y-2">
        <Label className="text-xs">Fiş İçeriği (Metin)</Label>
        <blockquote className="rounded-md border-l-2 border-primary/40 bg-muted/40 p-3 font-serif text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {card.content}
        </blockquote>
      </div>

      {/* Kişisel Yorum / Şerh (Opsiyonel) */}
      {card.comment && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary/70" />
            <Label className="text-sm font-medium">Düşünce / Şerh</Label>
          </div>
          <p className="rounded-md border border-border/40 bg-card p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {card.comment}
          </p>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 w-24"
        >
          Kapat
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onEdit}
          className="h-8 w-24 gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Düzenle
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Internal props for form component. */
interface CitationCardFormProps {
  cardToEdit?: CitationCardItem | null;
  sources: SourceItem[];
  boxes: BoxItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
  onClose: () => void;
}

/**
 * Internal form handling inputs and state for card creation/editing.
 *
 * @param props - Form props.
 * @returns Form markup.
 */
function CitationCardForm(props: CitationCardFormProps) {
  const { cardToEdit, sources, boxes, onSave, onClose } = props;
  const isEditing = Boolean(cardToEdit);

  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    cardToEdit
      ? String(cardToEdit.sourceId)
      : sources[0]
        ? String(sources[0].id)
        : "",
  );
  const [selectedBoxId, setSelectedBoxId] = useState<string>(
    cardToEdit ? String(cardToEdit.boxId) : boxes[0] ? String(boxes[0].id) : "",
  );
  const [noteType, setNoteType] = useState<CitationNoteType>(
    cardToEdit ? cardToEdit.noteType : "DIRECT_QUOTE",
  );
  const [pageNumber, setPageNumber] = useState<string>(
    cardToEdit ? cleanPageNumberInput(cardToEdit.pageNumber) : "1",
  );
  const [content, setContent] = useState<string>(
    cardToEdit ? cardToEdit.content : "",
  );
  const [comment, setComment] = useState<string>(
    cardToEdit ? (cardToEdit.comment ?? "") : "",
  );

  const selectedSourceObj = sources.find(
    (s) => s.id === Number(selectedSourceId),
  );
  const selectedBoxObj = boxes.find((b) => b.id === Number(selectedBoxId));

  /**
   * Handles form submission and triggers onSave callback with filled data.
   *
   * @param e - Form submit event.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Lütfen alıntı veya not içeriğini doldurun.");
      return;
    }

    const sourceObj = selectedSourceObj || sources[0];
    const boxObj = selectedBoxObj || boxes[0];

    if (!sourceObj) {
      toast.error(
        "Lütfen önce Kütüphane sayfasından bir akademik kaynak ekleyin.",
      );
      return;
    }

    if (!boxObj) {
      toast.error("Lütfen geçerli bir konu kutusu seçin.");
      return;
    }

    onSave({
      id: cardToEdit ? cardToEdit.id : undefined,
      sourceId: sourceObj.id,
      sourceTitle: sourceObj.title,
      sourceAuthors: sourceObj.authors,
      sourceYear: sourceObj.publicationYear,
      boxId: boxObj.id,
      boxType: boxObj.boxType,
      boxTitle: boxObj.title,
      pageNumber: formatPageNumber(pageNumber),
      noteType,
      content: content.trim(),
      comment: comment.trim() || undefined,
      sentToCitationCards: true,
    });

    toast.success(
      isEditing
        ? "Alıntı fişi başarıyla güncellendi."
        : "Yeni alıntı fişi başarıyla eklendi.",
    );
    onClose();
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
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* Kaynak & Konu Kutusu Seçimi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="source-select">Akademik Kaynak</Label>
          <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
            <SelectTrigger id="source-select">
              <SelectValue placeholder="Kaynak Seçin">
                {selectedSourceObj
                  ? `${selectedSourceObj.title} (${selectedSourceObj.authors[0]}, ${selectedSourceObj.publicationYear})`
                  : "Kaynak Seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sources.map((src) => (
                <SelectItem key={src.id} value={String(src.id)}>
                  <span className="font-medium">{src.title}</span> (
                  {src.authors[0]}, {src.publicationYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="box-select">Bağlı Konu Kutusu</Label>
          <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
            <SelectTrigger id="box-select">
              <SelectValue placeholder="Kutu Seçin">
                {selectedBoxObj
                  ? `[${BOX_TYPE_LABELS[selectedBoxObj.boxType]}] ${selectedBoxObj.title}`
                  : "Kutu Seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {boxes.map((box) => (
                <SelectItem key={box.id} value={String(box.id)}>
                  [{BOX_TYPE_LABELS[box.boxType]}] {box.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Not Türü & Sayfa Numarası */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="note-type-select">Not Türü</Label>
          <Select
            value={noteType}
            onValueChange={(val: string) =>
              setNoteType(val as CitationNoteType)
            }
          >
            <SelectTrigger id="note-type-select">
              <SelectValue>{NOTE_TYPE_DISPLAY_LABELS[noteType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT_QUOTE">Doğrudan Alıntı</SelectItem>
              <SelectItem value="PARAPHRASE">Dolaylı Alıntı</SelectItem>
              <SelectItem value="PERSONAL_NOTE">Kişisel Not</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-number-input">Sayfa Numarası</Label>
          <Input
            id="page-number-input"
            placeholder="Örn: 15 veya 15-17"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
          />
        </div>
      </div>

      {/* Fiş İçeriği */}
      <div className="space-y-2">
        <Label htmlFor="content-textarea">Fiş İçeriği (Metin)</Label>
        <Textarea
          id="content-textarea"
          rows={6}
          placeholder="Alıntılanan metni, kendi cümlenizle açımlamayı veya tez notunuzu buraya yazın..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handleContentPaste}
          className="font-serif leading-relaxed resize-none overflow-y-auto min-h-[140px]"
        />
      </div>

      {/* Kişisel Yorum / Şerh (Opsiyonel) */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-primary/70" />
          <Label htmlFor="comment-textarea" className="text-sm font-medium">
            Düşünce / Şerh
          </Label>
          <span className="text-[10px] text-muted-foreground font-normal">
            (Opsiyonel)
          </span>
        </div>
        <Textarea
          id="comment-textarea"
          rows={2}
          placeholder="Bu fişi tez çalışmanızda nasıl değerlendireceğinize dair kendi şerh veya yorumunuzu ekleyin..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="text-sm leading-relaxed resize-none"
        />
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          İptal
        </Button>
        <Button type="submit">
          {isEditing ? "Değişiklikleri Kaydet" : "Fiş Oluştur"}
        </Button>
      </DialogFooter>
    </form>
  );
}
