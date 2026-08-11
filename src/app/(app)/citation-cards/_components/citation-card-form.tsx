"use client";

import { useState } from "react";
import { MessageSquareQuote } from "lucide-react";
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
import { BOX_TYPE_LABELS } from "@/lib/box-constants";
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
        <div className="space-y-2">
          <Label htmlFor="source-select">Akademik Kaynak</Label>
          <Select
            value={formFields.selectedSourceId}
            onValueChange={(v) => setField("selectedSourceId", v)}
          >
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
          <Select
            value={formFields.selectedBoxId}
            onValueChange={(v) => setField("selectedBoxId", v)}
          >
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
            value={formFields.noteType}
            onValueChange={(val: string) =>
              setField("noteType", val as CitationNoteType)
            }
          >
            <SelectTrigger id="note-type-select">
              <SelectValue>
                {NOTE_TYPE_DISPLAY_LABELS[formFields.noteType]}
              </SelectValue>
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
            value={formFields.pageNumber}
            onChange={(e) => setField("pageNumber", e.target.value)}
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
          value={formFields.content}
          onChange={(e) => setField("content", e.target.value)}
          onPaste={handleContentPaste}
          className="font-serif leading-relaxed resize-none overflow-y-auto min-h-35"
        />
      </div>

      {/* Kişisel Yorum / Şerh (Opsiyonel) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
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
          value={formFields.comment}
          onChange={(e) => setField("comment", e.target.value)}
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
