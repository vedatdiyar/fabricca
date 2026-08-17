"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  updateBoxAction,
  createSubBoxAction,
  deleteSubBoxAction,
} from "../../../actions";
import type { BoxWithRelations } from "../constants/quadrant-config";

/** Form payload submitted by the add/edit sub-box modals. */
export interface SubBoxFormData {
  title: string;
  description: string;
  concepts: string[];
  semanticQuery: string;
}

/** Form payload submitted by the edit root box modal. */
export interface RootBoxFormData {
  title: string;
  description: string;
}

export interface UseBoxModalsOptions {
  rootBoxes: BoxWithRelations[];
}

interface ModalState {
  editSubBox: BoxWithRelations | null;
  isSubSaving: boolean;
  isAddOpen: boolean;
  addParentId: number | null;
  isAddSaving: boolean;
  editRootBox: BoxWithRelations | null;
  isRootSaving: boolean;
  deleteTargetBox: BoxWithRelations | null;
  isDeleting: boolean;
}

/**
 * Owns the open/close state of every box dialog (edit sub-box, add sub-box,
 * edit root box, delete confirmation) together with the server action calls,
 * loading flags and their success/error toasts.
 */
export function useBoxModals({ rootBoxes }: UseBoxModalsOptions) {
  const [modalState, setModalState] = useState<ModalState>({
    editSubBox: null,
    isSubSaving: false,
    isAddOpen: false,
    addParentId: null,
    isAddSaving: false,
    editRootBox: null,
    isRootSaving: false,
    deleteTargetBox: null,
    isDeleting: false,
  });

  const updateState = (patch: Partial<ModalState>) =>
    setModalState((prev) => ({ ...prev, ...patch }));

  // Edit Sub-Box Dialog
  const openEditSubModal = (box: BoxWithRelations) =>
    updateState({ editSubBox: box });
  const closeEditSubModal = () => updateState({ editSubBox: null });

  const saveEditSubBox = async (data: SubBoxFormData): Promise<boolean> => {
    if (!modalState.editSubBox) return false;
    if (!data.title.trim()) {
      toast.error("Alt konu başlığı boş olamaz.");
      return false;
    }

    updateState({ isSubSaving: true });
    const res = await updateBoxAction({
      id: modalState.editSubBox.id,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      concepts: data.concepts,
      semanticQuery: data.semanticQuery.trim() || undefined,
    });
    updateState({ isSubSaving: false });

    if (res.success) {
      toast.success("Alt konu başarıyla güncellendi.");
      updateState({ editSubBox: null });
      return true;
    }
    toast.error(res.error ?? "Güncellenemedi.");
    return false;
  };

  // Add Sub-Box Dialog
  const openAddModal = (parentId?: number) => {
    updateState({
      addParentId: parentId ?? rootBoxes[0]?.id ?? null,
      isAddOpen: true,
    });
  };
  const closeAddModal = () => updateState({ isAddOpen: false });
  const setAddParentId = (id: number | null) =>
    updateState({ addParentId: id });

  const saveAddSubBox = async (data: SubBoxFormData): Promise<boolean> => {
    if (!modalState.addParentId) {
      toast.error("Lütfen bir ana araştırma ekseni seçin.");
      return false;
    }
    if (!data.title.trim()) {
      toast.error("Alt konu başlığı boş olamaz.");
      return false;
    }

    updateState({ isAddSaving: true });
    const res = await createSubBoxAction({
      parentId: modalState.addParentId,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      concepts: data.concepts,
      semanticQuery: data.semanticQuery.trim() || undefined,
    });
    updateState({ isAddSaving: false });

    if (res.success) {
      toast.success("Yeni alt konu başarıyla eklendi.");
      updateState({ isAddOpen: false });
      return true;
    }
    toast.error(res.error ?? "Alt konu eklenemedi.");
    return false;
  };

  // Edit Root Box Dialog
  const openEditRootModal = (box: BoxWithRelations) =>
    updateState({ editRootBox: box });
  const closeEditRootModal = () => updateState({ editRootBox: null });

  const saveEditRootBox = async (data: RootBoxFormData): Promise<boolean> => {
    if (!modalState.editRootBox) return false;
    if (!data.title.trim()) {
      toast.error("Eksen başlığı boş olamaz.");
      return false;
    }

    updateState({ isRootSaving: true });
    const res = await updateBoxAction({
      id: modalState.editRootBox.id,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
    });
    updateState({ isRootSaving: false });

    if (res.success) {
      toast.success("Araştırma ekseni güncellendi.");
      updateState({ editRootBox: null });
      return true;
    }
    toast.error(res.error ?? "Güncellenemedi.");
    return false;
  };

  // Delete Sub-Box Confirmation Dialog
  const requestDelete = (box: BoxWithRelations) =>
    updateState({ deleteTargetBox: box });
  const closeDeleteModal = () => updateState({ deleteTargetBox: null });

  const confirmDeleteSubBox = async (): Promise<boolean> => {
    if (!modalState.deleteTargetBox) return false;

    updateState({ isDeleting: true });
    const res = await deleteSubBoxAction(modalState.deleteTargetBox.id);
    updateState({ isDeleting: false });

    if (res.success) {
      toast.success(`"${modalState.deleteTargetBox.title}" silindi.`);
      updateState({ deleteTargetBox: null });
      return true;
    }
    toast.error(res.error ?? "Silinemedi.");
    return false;
  };

  return {
    editSubBox: modalState.editSubBox,
    openEditSubModal,
    closeEditSubModal,
    saveEditSubBox,
    isSubSaving: modalState.isSubSaving,

    isAddOpen: modalState.isAddOpen,
    addParentId: modalState.addParentId,
    setAddParentId,
    openAddModal,
    closeAddModal,
    saveAddSubBox,
    isAddSaving: modalState.isAddSaving,

    editRootBox: modalState.editRootBox,
    openEditRootModal,
    closeEditRootModal,
    saveEditRootBox,
    isRootSaving: modalState.isRootSaving,

    deleteTargetBox: modalState.deleteTargetBox,
    requestDelete,
    closeDeleteModal,
    confirmDeleteSubBox,
    isDeleting: modalState.isDeleting,
  };
}
