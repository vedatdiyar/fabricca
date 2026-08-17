"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cleanPageNumberInput, formatPageNumber } from "@/lib/academic/utils";
import { normalizePastedText } from "@/lib/text-utils";
import type {
  CitationCardItem,
  CitationNoteType,
  BoxItem,
  SourceItem,
} from "../_lib/types";

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

/** The editable fields of the citation card form. */
export interface CitationCardFormFields {
  selectedSourceId: string;
  selectedBoxId: string;
  noteType: CitationNoteType;
  pageNumber: string;
  content: string;
  comment: string;
}

export interface UseCitationCardFormResult {
  formFields: CitationCardFormFields;
  setField: <K extends keyof CitationCardFormFields>(
    key: K,
    value: CitationCardFormFields[K],
  ) => void;
  selectedSourceObj?: SourceItem;
  selectedBoxObj?: BoxItem;
  handleSubmit: (e: React.FormEvent) => void;
  handleContentPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  isEditing: boolean;
}

/**
 * Manages the citation card form state, validation and submit flow for both
 * create and edit modes.
 *
 * @param props - Form props.
 * @returns Form state, setters and handlers.
 */
export function useCitationCardForm(
  props: CitationCardFormProps,
): UseCitationCardFormResult {
  const { cardToEdit, sources, boxes, onSave, onClose } = props;
  const isEditing = Boolean(cardToEdit);

  const [formFields, setFormFields] = useState<CitationCardFormFields>({
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

  const setField = <K extends keyof CitationCardFormFields>(
    key: K,
    value: CitationCardFormFields[K],
  ) => {
    setFormFields((prev) => ({ ...prev, [key]: value }));
  };

  const selectedSourceObj = sources.find(
    (s) => s.id === Number(formFields.selectedSourceId),
  );
  const selectedBoxObj = boxes.find(
    (b) => b.id === Number(formFields.selectedBoxId),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formFields.content.trim()) {
      toast.error("Fiş içeriği boş olamaz.");
      return;
    }

    if (!formFields.selectedSourceId) {
      toast.error("Lütfen bağlı akademik kaynağı seçin.");
      return;
    }

    if (!formFields.selectedBoxId) {
      toast.error("Lütfen bağlı konu kutusunu seçin.");
      return;
    }

    const formattedPage = formatPageNumber(formFields.pageNumber);

    onSave({
      id: cardToEdit?.id,
      sourceId: Number(formFields.selectedSourceId),
      sourceTitle: selectedSourceObj?.title ?? "",
      sourceAuthors: selectedSourceObj?.authors ?? [],
      sourceYear: selectedSourceObj?.publicationYear ?? 0,
      boxId: Number(formFields.selectedBoxId),
      boxType:
        selectedBoxObj?.boxType ?? boxes[0]?.boxType ?? "SUBJECT_PROBLEM",
      boxTitle: selectedBoxObj?.title ?? "",
      pageNumber: formattedPage,
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

  return {
    formFields,
    setField,
    selectedSourceObj,
    selectedBoxObj,
    handleSubmit,
    handleContentPaste,
    isEditing,
  };
}