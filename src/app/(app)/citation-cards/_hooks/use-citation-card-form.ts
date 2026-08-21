"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cleanPageNumberInput, formatPageNumber } from "@/lib/academic/utils";
import { normalizePastedText } from "@/lib/text-utils";
import type {
  CitationCardItem,
  CitationNoteType,
  BoxItem,
  OutlineItem,
  SourceItem,
} from "../_lib/types";

/** Props for the citation card form component. */
export interface CitationCardFormProps {
  cardToEdit?: CitationCardItem | null;
  sources: SourceItem[];
  boxes: BoxItem[];
  outlines: OutlineItem[];
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
  selectedOutlineId: string;
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
  selectedOutlineObj?: OutlineItem;
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
  const { cardToEdit, sources, boxes, outlines, onSave, onClose } = props;
  const isEditing = Boolean(cardToEdit);

  const initialSourceId = cardToEdit
    ? String(cardToEdit.sourceId)
    : sources[0]
      ? String(sources[0].id)
      : "";

  const initialOutlineId =
    cardToEdit && cardToEdit.outlineIds.length > 0
      ? String(cardToEdit.outlineIds[0])
      : "NONE";

  const [formFields, setFormFields] = useState<CitationCardFormFields>({
    selectedSourceId: initialSourceId,
    selectedOutlineId: initialOutlineId,
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

  const selectedBoxObj = selectedSourceObj
    ? boxes.find((b) => b.id === selectedSourceObj.boxId)
    : boxes[0];

  const selectedOutlineObj = outlines.find(
    (o) => o.id === Number(formFields.selectedOutlineId),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formFields.content.trim()) {
      toast.error("Fiş içeriği boş olamaz.");
      return;
    }

    if (!formFields.selectedSourceId || !selectedSourceObj) {
      toast.error("Lütfen bağlı akademik kaynağı seçin.");
      return;
    }

    const formattedPage = formatPageNumber(formFields.pageNumber);
    const targetOutlineId =
      formFields.selectedOutlineId !== "NONE"
        ? Number(formFields.selectedOutlineId)
        : null;

    onSave({
      id: cardToEdit?.id,
      sourceId: selectedSourceObj.id,
      sourceTitle: selectedSourceObj.title,
      sourceAuthors: selectedSourceObj.authors,
      sourceYear: selectedSourceObj.publicationYear,
      boxId: selectedSourceObj.boxId,
      boxType: selectedBoxObj?.boxType ?? "SUBJECT_PROBLEM",
      boxTitle: selectedBoxObj?.title ?? "",
      pageNumber: formattedPage,
      noteType: formFields.noteType,
      content: formFields.content.trim(),
      comment: formFields.comment.trim() || undefined,
      sentToCitationCards: true,
      outlineIds: targetOutlineId !== null ? [targetOutlineId] : [],
      outlineTitles: selectedOutlineObj ? [selectedOutlineObj.title] : [],
    });

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
    selectedOutlineObj,
    handleSubmit,
    handleContentPaste,
    isEditing,
  };
}
