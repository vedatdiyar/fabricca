"use client";

import { useState } from "react";
import { MessageSquareQuote, BookOpen, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import type {
  CitationCardItem,
  CitationNoteType,
  BoxItem,
  SourceItem,
} from "../_lib/types";

/** Turkish labels dictionary for note types. */
export const NOTE_TYPE_DISPLAY_LABELS: Record<CitationNoteType, string> = {
  DIRECT_QUOTE: "Doğrudan Alıntı",
  PARAPHRASE: "Dolaylı Alıntı",
  PERSONAL_NOTE: "Kişisel Not",
};

/** Props for the citation card form component. */
export interface CitationCardFormProps {
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
 * Form handling inputs and state for card creation/editing.
 *
 * @param props - Form props.
 * @returns Form markup.
 */
export function CitationCardForm(props: CitationCardFormProps) {
  const { cardToEdit, sources, boxes, onSave, onClose } = props;
  const isEditing = Boolean(cardToEdit);

  const [formFields, setFormFields] = useState({
    selectedSourceId: cardToEdit
      ? String(cardToEdit.sourceId)
      : sources[0]
        ? String(sources[0].id)
        : "",
    selectedBoxId: cardToEdit
      ? String(cardToEdit.boxId)
      : boxes[0]
        ? String(boxes[0].id)
        : "",
    noteType: (cardToEdit
      ? cardToEdit.noteType
      : "DIRECT_QUOTE") as CitationNoteType,
    pageNumber: cardToEdit ? cleanPageNumberInput(cardToEdit.pageNumber) : "1",
    content: cardToEdit ? cardToEdit.content : "",
    comment: cardToEdit ? (cardToEdit.comment ?? "") : "",
  });

  const setField = <K extends keyof typeof formFields>(
    key: K,
    value: (typeof formFields)[K],
  ) => {
    setFormFields((prev) => ({ ...prev, [key]: value }));
  };

  const selectedSourceObj = sources.find(
    (s) => s.id === Number(formFields.selectedSourceId),
  );
  const selectedBoxObj = boxes.find(
    (b) => b.id === Number(formFields.selectedBoxId),
  );

  /**
   * Handles form submission and triggers onSave callback with filled data.
   *
   * @param e - Form submit event.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formFields.content.trim()) {
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
      pageNumber: formatPageNumber(formFields.pageNumber),
      noteType: formFields.noteType,
      content: formFields.content.trim(),
      comment: formFields.comment.trim() || undefined,
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

    setField("content", next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + cleaned.length;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* Kaynak & Konu Kutusu Seçimi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Akademik Kaynak */}
        <div className="space-y-1.5">
          <Label htmlFor="source-select" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Akademik Kaynak
          </Label>
          <Select
            value={formFields.selectedSourceId}
            onValueChange={(v) => setField("selectedSourceId", v)}
          >
            <SelectTrigger id="source-select" className="h-9 text-xs bg-background border-border">
              <SelectValue placeholder="Kaynak Seçin">
                {selectedSourceObj
                  ? `${selectedSourceObj.title} (${selectedSourceObj.authors[0] ?? "Yazar"}, ${selectedSourceObj.publicationYear})`
                  : "Kaynak Seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {sources.map((src) => (
                <SelectItem key={src.id} value={String(src.id)} className="text-xs py-2">
                  <span className="font-medium">{src.title}</span> (
                  {src.authors[0] ?? "Yazar"}, {src.publicationYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bağlı Konu Kutusu */}
        <div className="space-y-1.5">
          <Label htmlFor="box-select" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-primary" />
            Bağlı Konu Kutusu
          </Label>
          <Select
            value={formFields.selectedBoxId}
            onValueChange={(v) => setField("selectedBoxId", v)}
          >
            <SelectTrigger id="box-select" className="h-9 text-xs bg-background border-border">
              <SelectValue placeholder="Kutu Seçin">
                {selectedBoxObj
                  ? `[${BOX_TYPE_LABELS[selectedBoxObj.boxType]}] ${selectedBoxObj.title}`
                  : "Kutu Seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {boxes.map((box) => {
                const boxConfig = getBoxTypeBadgeConfig(box.boxType);
                return (
                  <SelectItem key={box.id} value={String(box.id)} className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", boxConfig.dotClassName)} />
                      <span>[{BOX_TYPE_LABELS[box.boxType]}] {box.title}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Not Türü & Sayfa Numarası */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="note-type-select" className="text-xs font-semibold text-foreground">
            Not Türü
          </Label>
          <Select
            value={formFields.noteType}
            onValueChange={(val: string) =>
              setField("noteType", val as CitationNoteType)
            }
          >
            <SelectTrigger id="note-type-select" className="h-9 text-xs bg-background border-border">
              <SelectValue>
                {NOTE_TYPE_DISPLAY_LABELS[formFields.noteType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT_QUOTE" className="text-xs">Doğrudan Alıntı</SelectItem>
              <SelectItem value="PARAPHRASE" className="text-xs">Dolaylı Alıntı</SelectItem>
              <SelectItem value="PERSONAL_NOTE" className="text-xs">Kişisel Not</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page-number-input" className="text-xs font-semibold text-foreground">
            Sayfa Numarası
          </Label>
          <Input
            id="page-number-input"
            placeholder="Örn: 15 veya 15-17"
            value={formFields.pageNumber}
            onChange={(e) => setField("pageNumber", e.target.value)}
            className="h-9 text-xs font-mono bg-background border-border"
          />
        </div>
      </div>

      {/* Fiş İçeriği (Metin) */}
      <div className="space-y-1.5">
        <Label htmlFor="content-textarea" className="text-xs font-semibold text-foreground">
          Fiş İçeriği (Metin)
        </Label>
        <Textarea
          id="content-textarea"
          rows={5}
          placeholder="Alıntılanan metni, kendi cümlenizle açımlamayı veya tez notunuzu buraya yazın..."
          value={formFields.content}
          onChange={(e) => setField("content", e.target.value)}
          onPaste={handleContentPaste}
          className="font-sans leading-relaxed resize-none overflow-y-auto text-xs bg-background border-border"
        />
      </div>

      {/* Kişisel Yorum / Şerh (Opsiyonel) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
          <Label htmlFor="comment-textarea" className="text-xs font-semibold text-foreground">
            Düşünce / Şerh
          </Label>
          <span className="text-[10px] text-muted-foreground font-normal">
            (Opsiyonel)
          </span>
        </div>
        <Textarea
          id="comment-textarea"
          rows={3}
          placeholder="Bu fişi tez çalışmanızda nasıl değerlendireceğinize dair kendi şerh veya yorumunuzu ekleyin..."
          value={formFields.comment}
          onChange={(e) => setField("comment", e.target.value)}
          className="text-xs leading-relaxed resize-none overflow-y-auto bg-background border-border"
        />
      </div>

      <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 px-4 text-xs">
          İptal
        </Button>
        <Button type="submit" size="sm" className="h-8 px-4 text-xs">
          {isEditing ? "Değişiklikleri Kaydet" : "Fiş Oluştur"}
        </Button>
      </DialogFooter>
    </form>
  );
}
