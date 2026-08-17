"use client";

import { useState } from "react";
import { Outline } from "@/db/schema";
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
  // Add new section modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<number | null>(null);
  const [isAddSaving, setIsAddSaving] = useState(false);

  // Edit section modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [outlineToEdit, setOutlineToEdit] = useState<Outline | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Delete confirmation modal state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [outlineToDelete, setOutlineToDelete] = useState<Outline | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Annotation (citation card) linkage modal state
  const [isAnnotationLinkModalOpen, setIsAnnotationLinkModalOpen] =
    useState(false);

  // Source linkage modal state
  const [isSourceLinkModalOpen, setIsSourceLinkModalOpen] = useState(false);

  const openAddModal = (parentId: number | null = null) => {
    setAddParentId(parentId);
    setIsAddOpen(true);
  };

  const closeAddModal = () => setIsAddOpen(false);

  const createSection = async ({ title, description }: CreateSectionInput) => {
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }

    setIsAddSaving(true);
    const siblings = addParentId
      ? outlinesList.filter((o) => o.parentId === addParentId)
      : rootOutlines;
    const nextSortOrder = siblings.length + 1;

    const res = await createOutlineSectionAction({
      title: title.trim(),
      description: description.trim() || undefined,
      parentId: addParentId,
      sortOrder: nextSortOrder,
    });

    setIsAddSaving(false);
    if (res.success) {
      toast.success("Bölüm başarıyla eklendi.");
      setIsAddOpen(false);
    } else {
      toast.error(res.error ?? "Bölüm eklenirken bir hata oluştu.");
    }
  };

  const openEditModal = (outline: Outline) => {
    setOutlineToEdit(outline);
    setIsEditOpen(true);
  };

  const closeEditModal = () => setIsEditOpen(false);

  const updateSection = async ({
    title,
    description,
    sortOrder,
  }: UpdateSectionInput) => {
    if (!outlineToEdit) return;
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }

    setIsEditSaving(true);
    const res = await updateOutlineSectionAction({
      id: outlineToEdit.id,
      title: title.trim(),
      description: description.trim() || undefined,
      sortOrder,
    });

    setIsEditSaving(false);
    if (res.success) {
      toast.success("Bölüm güncellendi.");
      setIsEditOpen(false);
    } else {
      toast.error(res.error ?? "Güncelleme sırasında bir hata oluştu.");
    }
  };

  const promptDelete = (outline: Outline) => {
    setOutlineToDelete(outline);
    setIsDeleteOpen(true);
  };

  const closeDeleteModal = () => setIsDeleteOpen(false);

  const confirmDelete = async () => {
    if (!outlineToDelete) return;
    setIsDeleting(true);

    const res = await deleteOutlineSectionAction(outlineToDelete.id);
    setIsDeleting(false);

    if (res.success) {
      toast.success("Bölüm silindi.");
      setIsDeleteOpen(false);
      if (selectedOutlineId === outlineToDelete.id) {
        const remaining = outlinesList.filter(
          (o) =>
            o.id !== outlineToDelete.id && o.parentId !== outlineToDelete.id,
        );
        setSelectedOutlineId(remaining.length > 0 ? remaining[0].id : null);
      }
      setOutlineToDelete(null);
    } else {
      toast.error(res.error ?? "Bölüm silinirken bir hata oluştu.");
    }
  };

  const openAnnotationLinkModal = () => setIsAnnotationLinkModalOpen(true);

  const closeAnnotationLinkModal = () => setIsAnnotationLinkModalOpen(false);

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

  const openSourceLinkModal = () => setIsSourceLinkModalOpen(true);

  const closeSourceLinkModal = () => setIsSourceLinkModalOpen(false);

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
    isAddOpen,
    addParentId,
    isAddSaving,
    openAddModal,
    closeAddModal,
    createSection,
    isEditOpen,
    outlineToEdit,
    isEditSaving,
    openEditModal,
    closeEditModal,
    updateSection,
    isDeleteOpen,
    outlineToDelete,
    isDeleting,
    promptDelete,
    closeDeleteModal,
    confirmDelete,
    isAnnotationLinkModalOpen,
    openAnnotationLinkModal,
    closeAnnotationLinkModal,
    toggleAnnotationLink,
    isSourceLinkModalOpen,
    openSourceLinkModal,
    closeSourceLinkModal,
    toggleSourceLink,
  };
}
