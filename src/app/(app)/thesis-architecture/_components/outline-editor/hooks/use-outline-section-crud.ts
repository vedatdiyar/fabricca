"use client";

import { useState } from "react";
import { Outline } from "@/core/db/schema";
import {
  createOutlineSectionAction,
  updateOutlineSectionAction,
  deleteOutlineSectionAction,
} from "../../../actions";
import { toast } from "sonner";

interface UseOutlineSectionCrudOptions {
  outlinesList: Outline[];
  rootOutlines: Outline[];
  selectedOutlineId: number | null;
  setSelectedOutlineId: (id: number | null) => void;
}

export interface CreateSectionInput {
  title: string;
  description: string;
}

export interface UpdateSectionInput {
  title: string;
  description: string;
  sortOrder: number;
}

interface UseOutlineSectionCrudResult {
  isAddOpen: boolean;
  addParentId: number | null;
  isAddSaving: boolean;
  openAddModal: (parentId?: number | null) => void;
  closeAddModal: () => void;
  createSection: (data: CreateSectionInput) => Promise<void>;
  isEditOpen: boolean;
  outlineToEdit: Outline | null;
  isEditSaving: boolean;
  openEditModal: (outline: Outline) => void;
  closeEditModal: () => void;
  updateSection: (data: UpdateSectionInput) => Promise<void>;
  isDeleteOpen: boolean;
  outlineToDelete: Outline | null;
  isDeleting: boolean;
  promptDelete: (outline: Outline) => void;
  closeDeleteModal: () => void;
  confirmDelete: () => Promise<void>;
}

interface SectionModalState {
  isAddOpen: boolean;
  addParentId: number | null;
  isAddSaving: boolean;
  isEditOpen: boolean;
  outlineToEdit: Outline | null;
  isEditSaving: boolean;
  isDeleteOpen: boolean;
  outlineToDelete: Outline | null;
  isDeleting: boolean;
}

/**
 * Wires the outline section CRUD server actions (add/edit/delete) with their
 * modal visibility states, toasts and post-delete reselection logic.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.rootOutlines - Root-level outline sections.
 * @param root0.selectedOutlineId - The currently selected outline id.
 * @param root0.setSelectedOutlineId - Selection mutator used to move off a deleted section.
 * @returns Modal states, open/close handlers and server action triggers.
 */
export function useOutlineSectionCrud({
  outlinesList,
  rootOutlines,
  selectedOutlineId,
  setSelectedOutlineId,
}: UseOutlineSectionCrudOptions): UseOutlineSectionCrudResult {
  const [modalState, setModalState] = useState<SectionModalState>({
    isAddOpen: false,
    addParentId: null,
    isAddSaving: false,
    isEditOpen: false,
    outlineToEdit: null,
    isEditSaving: false,
    isDeleteOpen: false,
    outlineToDelete: null,
    isDeleting: false,
  });

  const updateModalState = (patch: Partial<SectionModalState>) =>
    setModalState((prev) => ({ ...prev, ...patch }));

  const openAddModal = (parentId: number | null = null) => {
    updateModalState({ addParentId: parentId, isAddOpen: true });
  };

  const closeAddModal = () => updateModalState({ isAddOpen: false });

  const createSection = async ({ title, description }: CreateSectionInput) => {
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }

    updateModalState({ isAddSaving: true });
    const siblings = modalState.addParentId
      ? outlinesList.filter((o) => o.parentId === modalState.addParentId)
      : rootOutlines;
    const nextSortOrder = siblings.length + 1;

    const res = await createOutlineSectionAction({
      title: title.trim(),
      description: description.trim() || undefined,
      parentId: modalState.addParentId,
      sortOrder: nextSortOrder,
    });

    updateModalState({ isAddSaving: false });
    if (res.success) {
      toast.success("Bölüm başarıyla eklendi.");
      updateModalState({ isAddOpen: false });
    } else {
      toast.error(res.error ?? "Bölüm eklenirken bir hata oluştu.");
    }
  };

  const openEditModal = (outline: Outline) => {
    updateModalState({ outlineToEdit: outline, isEditOpen: true });
  };

  const closeEditModal = () => updateModalState({ isEditOpen: false });

  const updateSection = async ({
    title,
    description,
    sortOrder,
  }: UpdateSectionInput) => {
    if (!modalState.outlineToEdit) return;
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }

    updateModalState({ isEditSaving: true });
    const res = await updateOutlineSectionAction({
      id: modalState.outlineToEdit.id,
      title: title.trim(),
      description: description.trim() || undefined,
      sortOrder,
    });

    updateModalState({ isEditSaving: false });
    if (res.success) {
      toast.success("Bölüm güncellendi.");
      updateModalState({ isEditOpen: false });
    } else {
      toast.error(res.error ?? "Güncelleme sırasında bir hata oluştu.");
    }
  };

  const promptDelete = (outline: Outline) => {
    updateModalState({ outlineToDelete: outline, isDeleteOpen: true });
  };

  const closeDeleteModal = () => updateModalState({ isDeleteOpen: false });

  const confirmDelete = async () => {
    if (!modalState.outlineToDelete) return;
    updateModalState({ isDeleting: true });

    const targetId = modalState.outlineToDelete.id;
    const res = await deleteOutlineSectionAction(targetId);
    updateModalState({ isDeleting: false });

    if (res.success) {
      toast.success("Bölüm silindi.");
      updateModalState({ isDeleteOpen: false, outlineToDelete: null });
      if (selectedOutlineId === targetId) {
        const remaining = outlinesList.filter(
          (o) => o.id !== targetId && o.parentId !== targetId,
        );
        setSelectedOutlineId(remaining.length > 0 ? remaining[0].id : null);
      }
    } else {
      toast.error(res.error ?? "Bölüm silinirken bir hata oluştu.");
    }
  };

  return {
    isAddOpen: modalState.isAddOpen,
    addParentId: modalState.addParentId,
    isAddSaving: modalState.isAddSaving,
    openAddModal,
    closeAddModal,
    createSection,
    isEditOpen: modalState.isEditOpen,
    outlineToEdit: modalState.outlineToEdit,
    isEditSaving: modalState.isEditSaving,
    openEditModal,
    closeEditModal,
    updateSection,
    isDeleteOpen: modalState.isDeleteOpen,
    outlineToDelete: modalState.outlineToDelete,
    isDeleting: modalState.isDeleting,
    promptDelete,
    closeDeleteModal,
    confirmDelete,
  };
}
