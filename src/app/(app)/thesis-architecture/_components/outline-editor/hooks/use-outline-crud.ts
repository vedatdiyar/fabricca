"use client";

import { useState } from "react";
import { Outline } from "@/core/db/schema";
import {
  createOutlineSectionAction,
  updateOutlineSectionAction,
  deleteOutlineSectionAction,
  linkAnnotationToOutlineAction,
  unlinkAnnotationFromOutlineAction,
  linkSourceToOutlineAction,
  unlinkSourceFromOutlineAction,
} from "../../../actions";
import { toast } from "sonner";

interface UseOutlineCrudOptions {
  outlinesList: Outline[];
  rootOutlines: Outline[];
  selectedOutline: Outline | null;
  selectedOutlineId: number | null;
  setSelectedOutlineId: (id: number | null) => void;
  localPinnedAnnotationsMap: Record<number, number[]>;
  applyAnnotationLinkOverride: (
    outlineId: number,
    annotationIds: number[],
  ) => void;
  localLinkedSourcesMap: Record<number, number[]>;
  applySourceLinkOverride: (outlineId: number, sourceIds: number[]) => void;
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

interface UseOutlineCrudResult {
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
  isAnnotationLinkModalOpen: boolean;
  openAnnotationLinkModal: () => void;
  closeAnnotationLinkModal: () => void;
  toggleAnnotationLink: (annotationId: number) => Promise<void>;
  isSourceLinkModalOpen: boolean;
  openSourceLinkModal: () => void;
  closeSourceLinkModal: () => void;
  toggleSourceLink: (sourceId: number) => Promise<void>;
}

/**
 * Wires the outline section CRUD server actions (add/edit/delete and
 * annotation/source linking) with their modal visibility states, toasts and
 * optimistic updates.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.rootOutlines - Root-level outline sections.
 * @param root0.selectedOutline - The currently selected outline section or null.
 * @param root0.selectedOutlineId - The currently selected outline id.
 * @param root0.setSelectedOutlineId - Selection mutator used to move off a deleted section.
 * @param root0.localPinnedAnnotationsMap - Effective annotation to outline link map (with optimistic overrides).
 * @param root0.applyAnnotationLinkOverride - Applies/rolls back an optimistic annotation-link change.
 * @param root0.localLinkedSourcesMap - Effective source to outline link map (with optimistic overrides).
 * @param root0.applySourceLinkOverride - Applies/rolls back an optimistic source-link change.
 * @returns Modal states, open/close handlers and server action triggers.
 */
interface OutlineModalState {
  isAddOpen: boolean;
  addParentId: number | null;
  isAddSaving: boolean;
  isEditOpen: boolean;
  outlineToEdit: Outline | null;
  isEditSaving: boolean;
  isDeleteOpen: boolean;
  outlineToDelete: Outline | null;
  isDeleting: boolean;
  isAnnotationLinkModalOpen: boolean;
  isSourceLinkModalOpen: boolean;
}

export function useOutlineCrud({
  outlinesList,
  rootOutlines,
  selectedOutline,
  selectedOutlineId,
  setSelectedOutlineId,
  localPinnedAnnotationsMap,
  applyAnnotationLinkOverride,
  localLinkedSourcesMap,
  applySourceLinkOverride,
}: UseOutlineCrudOptions): UseOutlineCrudResult {
  const [modalState, setModalState] = useState<OutlineModalState>({
    isAddOpen: false,
    addParentId: null,
    isAddSaving: false,
    isEditOpen: false,
    outlineToEdit: null,
    isEditSaving: false,
    isDeleteOpen: false,
    outlineToDelete: null,
    isDeleting: false,
    isAnnotationLinkModalOpen: false,
    isSourceLinkModalOpen: false,
  });

  const updateModalState = (patch: Partial<OutlineModalState>) =>
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

  const openAnnotationLinkModal = () =>
    updateModalState({ isAnnotationLinkModalOpen: true });

  const closeAnnotationLinkModal = () =>
    updateModalState({ isAnnotationLinkModalOpen: false });

  const toggleAnnotationLink = async (annotationId: number) => {
    if (!selectedOutline) return;
    const currentIds = localPinnedAnnotationsMap[selectedOutline.id] ?? [];
    const isLinked = currentIds.includes(annotationId);

    // Optimistic update
    const updated = isLinked
      ? currentIds.filter((id) => id !== annotationId)
      : [...currentIds, annotationId];

    applyAnnotationLinkOverride(selectedOutline.id, updated);

    const res = isLinked
      ? await unlinkAnnotationFromOutlineAction(
          selectedOutline.id,
          annotationId,
        )
      : await linkAnnotationToOutlineAction(selectedOutline.id, annotationId);

    if (res.success) {
      toast.success(
        isLinked
          ? "Alıntı kartının bölüm bağı kaldırıldı."
          : "Alıntı kartı bölüme başarıyla bağlandı.",
      );
    } else {
      toast.error(res.error ?? "İşlem gerçekleştirilemedi.");
      // Rollback
      applyAnnotationLinkOverride(selectedOutline.id, currentIds);
    }
  };

  const openSourceLinkModal = () =>
    updateModalState({ isSourceLinkModalOpen: true });

  const closeSourceLinkModal = () =>
    updateModalState({ isSourceLinkModalOpen: false });

  const toggleSourceLink = async (sourceId: number) => {
    if (!selectedOutline) return;
    const currentIds = localLinkedSourcesMap[selectedOutline.id] ?? [];
    const isLinked = currentIds.includes(sourceId);

    // Optimistic update
    const updated = isLinked
      ? currentIds.filter((id) => id !== sourceId)
      : [...currentIds, sourceId];

    applySourceLinkOverride(selectedOutline.id, updated);

    const res = isLinked
      ? await unlinkSourceFromOutlineAction(selectedOutline.id, sourceId)
      : await linkSourceToOutlineAction(selectedOutline.id, sourceId);

    if (res.success) {
      toast.success(
        isLinked
          ? "Kaynağın bölüm bağı kaldırıldı."
          : "Kaynak bölüme başarıyla bağlandı.",
      );
    } else {
      toast.error(res.error ?? "İşlem gerçekleştirilemedi.");
      // Rollback
      applySourceLinkOverride(selectedOutline.id, currentIds);
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
    isAnnotationLinkModalOpen: modalState.isAnnotationLinkModalOpen,
    openAnnotationLinkModal,
    closeAnnotationLinkModal,
    toggleAnnotationLink,
    isSourceLinkModalOpen: modalState.isSourceLinkModalOpen,
    openSourceLinkModal,
    closeSourceLinkModal,
    toggleSourceLink,
  };
}
