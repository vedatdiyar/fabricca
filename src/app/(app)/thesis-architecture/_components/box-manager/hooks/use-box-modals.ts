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

/**
 * Owns the open/close state of every box dialog (edit sub-box, add sub-box,
 * edit root box, delete confirmation) together with the server action calls,
 * loading flags and their success/error toasts.
 */
export function useBoxModals({ rootBoxes }: UseBoxModalsOptions) {
  // Edit Sub-Box Dialog
  const [editSubBox, setEditSubBox] = useState<BoxWithRelations | null>(null);
  const [isSubSaving, setIsSubSaving] = useState(false);

  const openEditSubModal = (box: BoxWithRelations) => setEditSubBox(box);
  const closeEditSubModal = () => setEditSubBox(null);

  const saveEditSubBox = async (data: SubBoxFormData): Promise<boolean> => {
    if (!editSubBox) return false;
    if (!data.title.trim()) {
      toast.error("Alt konu başlığı boş olamaz.");
      return false;
    }

    setIsSubSaving(true);
    const res = await updateBoxAction({
      id: editSubBox.id,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      concepts: data.concepts,
      semanticQuery: data.semanticQuery.trim() || undefined,
    });
    setIsSubSaving(false);

    if (res.success) {
      toast.success("Alt konu başarıyla güncellendi.");
      setEditSubBox(null);
      return true;
    }
    toast.error(res.error ?? "Güncellenemedi.");
    return false;
  };

  // Add Sub-Box Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<number | null>(null);
  const [isAddSaving, setIsAddSaving] = useState(false);

  const openAddModal = (parentId?: number) => {
    setAddParentId(parentId ?? rootBoxes[0]?.id ?? null);
    setIsAddOpen(true);
  };
  const closeAddModal = () => setIsAddOpen(false);

  const saveAddSubBox = async (data: SubBoxFormData): Promise<boolean> => {
    if (!addParentId) {
      toast.error("Lütfen bir ana araştırma ekseni seçin.");
      return false;
    }
    if (!data.title.trim()) {
      toast.error("Alt konu başlığı boş olamaz.");
      return false;
    }

    setIsAddSaving(true);
    const res = await createSubBoxAction({
      parentId: addParentId,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      concepts: data.concepts,
      semanticQuery: data.semanticQuery.trim() || undefined,
    });
    setIsAddSaving(false);

    if (res.success) {
      toast.success("Yeni alt konu başarıyla eklendi.");
      setIsAddOpen(false);
      return true;
    }
    toast.error(res.error ?? "Alt konu eklenemedi.");
    return false;
  };

  // Edit Root Box Dialog
  const [editRootBox, setEditRootBox] = useState<BoxWithRelations | null>(null);
  const [isRootSaving, setIsRootSaving] = useState(false);

  const openEditRootModal = (box: BoxWithRelations) => setEditRootBox(box);
  const closeEditRootModal = () => setEditRootBox(null);

  const saveEditRootBox = async (data: RootBoxFormData): Promise<boolean> => {
    if (!editRootBox) return false;
    if (!data.title.trim()) {
      toast.error("Eksen başlığı boş olamaz.");
      return false;
    }

    setIsRootSaving(true);
    const res = await updateBoxAction({
      id: editRootBox.id,
      title: data.title.trim(),
      description: data.description.trim() || undefined,
    });
    setIsRootSaving(false);

    if (res.success) {
      toast.success("Araştırma ekseni güncellendi.");
      setEditRootBox(null);
      return true;
    }
    toast.error(res.error ?? "Güncellenemedi.");
    return false;
  };

  // Delete Sub-Box Confirmation Dialog
  const [deleteTargetBox, setDeleteTargetBox] =
    useState<BoxWithRelations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = (box: BoxWithRelations) => setDeleteTargetBox(box);
  const closeDeleteModal = () => setDeleteTargetBox(null);

  const confirmDeleteSubBox = async (): Promise<boolean> => {
    if (!deleteTargetBox) return false;

    setIsDeleting(true);
    const res = await deleteSubBoxAction(deleteTargetBox.id);
    setIsDeleting(false);

    if (res.success) {
      toast.success(`"${deleteTargetBox.title}" silindi.`);
      setDeleteTargetBox(null);
      return true;
    }
    toast.error(res.error ?? "Silinemedi.");
    return false;
  };

  return {
    // Edit Sub-Box
    editSubBox,
    openEditSubModal,
    closeEditSubModal,
    saveEditSubBox,
    isSubSaving,
    // Add Sub-Box
    isAddOpen,
    addParentId,
    setAddParentId,
    openAddModal,
    closeAddModal,
    saveAddSubBox,
    isAddSaving,
    // Edit Root Box
    editRootBox,
    openEditRootModal,
    closeEditRootModal,
    saveEditRootBox,
    isRootSaving,
    // Delete
    deleteTargetBox,
    requestDelete,
    closeDeleteModal,
    confirmDeleteSubBox,
    isDeleting,
  };
}
