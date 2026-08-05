"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { BOX_TYPE_LABELS } from "@/lib/box-constants";
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
  sources: SourceItem[];
  boxes: BoxItem[];
  onSave: (
    card: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => void;
}

/**
 * Dialog component for creating a new citation card or editing an existing card.
 *
 * @param props - Dialog visibility state, items, and save callback.
 * @returns Dialog markup.
 */
export function CitationCardDialog(props: CitationCardDialogProps) {
  const { open, onOpenChange, cardToEdit, sources, boxes, onSave } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {cardToEdit ? "Alıntı Fişini Düzenle" : "Yeni Alıntı Fişi Oluştur"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kaynaklardan derlediğiniz doğrudan alıntı, açımlama veya kişisel
            değerlendirme notlarınızı fişleyin.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <CitationCardForm
            cardToEdit={cardToEdit}
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
      sentToCitationCards: true,
    });

    toast.success(
      isEditing
        ? "Alıntı fişi başarıyla güncellendi."
        : "Yeni alıntı fişi başarıyla eklendi.",
    );
    onClose();
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
          className="font-serif leading-relaxed resize-none overflow-y-auto min-h-[140px]"
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
