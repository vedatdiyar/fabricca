"use client";

import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { updateLibraryResourceAction } from "../actions";
import { useBoxHierarchySelection } from "./use-box-hierarchy-selection";
import type { LibraryResourceItem } from "../_lib/types";

/** Form field values for the edit resource metadata form. */
export interface EditResourceFormFields {
  title: string;
  authorsText: string;
  containerTitle: string;
  documentType: string;
  publisher: string;
  publicationYear: number | string;
  doi: string;
}

interface UseEditResourceFormParams {
  resource: LibraryResourceItem;
  onClose: () => void;
  onUpdateSuccess: (updatedResource: LibraryResourceItem) => void;
}

/**
 * Custom hook managing the edit-resource metadata form state, box hierarchy
 * selection and the update server action submission.
 *
 * @param params - Modal callbacks and the resource being edited.
 * @param params.resource - The resource being edited.
 * @param params.onClose - Callback invoked when the form should be closed.
 * @param params.onUpdateSuccess - Callback invoked after a successful update.
 * @returns Form fields, box selection state and the submit handler.
 */
export function useEditResourceForm({
  resource,
  onClose,
  onUpdateSuccess,
}: UseEditResourceFormParams) {
  const [formFields, setFormFields] = useState<EditResourceFormFields>({
    title: resource.title,
    authorsText: resource.authors.join(", "),
    containerTitle: resource.containerTitle || "",
    documentType: resource.documentType || "",
    publisher: resource.publisher || "",
    publicationYear: resource.publicationYear ?? "",
    doi: resource.doi || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    hierarchy,
    selectedParentId,
    selectedSubBoxId,
    setParentId,
    setSubBoxId,
  } = useBoxHierarchySelection({
    initialSubBoxId: resource.subBoxId,
    initialBoxType: resource.boxType,
  });

  const parentBoxes = hierarchy ?? [];
  const selectedParent =
    parentBoxes.find((b) => b.id === selectedParentId) ?? null;
  const hasSubBoxes = !!selectedParent && selectedParent.children.length > 0;

  const setField = useCallback(
    <K extends keyof EditResourceFormFields>(
      key: K,
      value: EditResourceFormFields[K],
    ) => {
      setFormFields((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!formFields.title.trim()) {
        toast.error("Lütfen eser başlığını giriniz.");
        return;
      }

      const parsedAuthors = formFields.authorsText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      if (parsedAuthors.length === 0) {
        toast.error("Lütfen en az bir yazar adı giriniz.");
        return;
      }

      const targetBoxId =
        hasSubBoxes && selectedSubBoxId !== null
          ? selectedSubBoxId
          : (selectedParentId ?? undefined);

      try {
        setIsSubmitting(true);

        const res = await updateLibraryResourceAction({
          resourceId: resource.id,
          title: formFields.title.trim(),
          authors: parsedAuthors,
          containerTitle: formFields.containerTitle.trim() || undefined,
          documentType: formFields.documentType.trim() || undefined,
          publisher: formFields.publisher.trim() || undefined,
          publicationYear:
            typeof formFields.publicationYear === "number"
              ? formFields.publicationYear
              : null,
          doi: formFields.doi.trim() || undefined,
          boxId: targetBoxId,
        });

        if (res.success && res.data) {
          onUpdateSuccess(res.data);
          toast.success("Eser metadataları başarıyla güncellendi.");
          onClose();
        } else {
          toast.error(res.error || "Eser güncellenirken hata oluştu.");
        }
      } catch {
        toast.error("İşlem gerçekleştirilirken beklenmeyen bir hata oluştu.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formFields,
      hasSubBoxes,
      selectedSubBoxId,
      selectedParentId,
      resource.id,
      onClose,
      onUpdateSuccess,
    ],
  );

  return {
    formFields,
    setField,
    parentBoxes,
    selectedParentId,
    selectedSubBoxId,
    hasSubBoxes,
    setParentId,
    setSubBoxId,
    isSubmitting,
    handleSubmit,
  };
}
