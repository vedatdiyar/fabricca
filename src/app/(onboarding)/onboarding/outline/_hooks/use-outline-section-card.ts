"use client";

import { useCallback, useMemo, useState } from "react";

export interface OutlineSubSectionData {
  title: string;
  description: string;
  sortOrder: number;
}

export interface OutlineSectionData {
  title: string;
  description: string;
  sortOrder: number;
  subSections?: OutlineSubSectionData[];
}

export interface OutlineSectionCardProps {
  section: OutlineSectionData;
  sectionIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateSection: (updated: OutlineSectionData) => void;
  onDeleteSection: () => void;
  // Drag & drop props for main sections
  onDragStartSection: (index: number) => void;
  onDragOverSection: (index: number) => void;
  onDropSection: (targetIndex: number) => void;
  onDragEndSection: () => void;
  isDraggingSection?: boolean;
  isDragOverSection?: boolean;
}

export interface OutlineCardState {
  isEditingSection: boolean;
  editTitle: string;
  editDescription: string;
  editingSubIndex: number | null;
  subEditTitle: string;
  subEditDescription: string;
  draggedSubIdx: number | null;
  dragOverSubIdx: number | null;
}

export interface UseOutlineSectionCardResult {
  cardState: OutlineCardState;
  updateCardState: (patch: Partial<OutlineCardState>) => void;
  sectionNumber: number;
  subSections: OutlineSubSectionData[];
  hasSubSections: boolean;
  isSpecialSection: boolean;
  handleSaveSectionEdit: () => void;
  handleCancelSectionEdit: () => void;
  handleAddSubSection: () => void;
  handleDeleteSubSection: (subIdx: number) => void;
  handleSubDrop: (targetIdx: number) => void;
  handleStartSubEdit: (subIdx: number) => void;
  handleSaveSubEdit: (subIdx: number) => void;
}

/**
 * Holds the interactive editing, drag-and-drop and subsection management logic
 * for a single outline section card.
 *
 * @param props - The section card props.
 * @returns The card state, derived values and event handlers.
 */
export function useOutlineSectionCard(
  props: OutlineSectionCardProps,
): UseOutlineSectionCardResult {
  const { section, sectionIndex, isExpanded, onToggleExpand, onUpdateSection } =
    props;

  const [cardState, setCardState] = useState<OutlineCardState>({
    isEditingSection: false,
    editTitle: section.title,
    editDescription: section.description,
    editingSubIndex: null,
    subEditTitle: "",
    subEditDescription: "",
    draggedSubIdx: null,
    dragOverSubIdx: null,
  });

  const updateCardState = useCallback((patch: Partial<OutlineCardState>) => {
    setCardState((prev) => ({ ...prev, ...patch }));
  }, []);

  const sectionNumber = sectionIndex + 1;
  const subSections = useMemo(
    () => section.subSections ?? [],
    [section.subSections],
  );
  const hasSubSections = subSections.length > 0;

  const isSpecialSection = useMemo(() => {
    const titleUpper = section.title.toLocaleUpperCase("tr-TR");
    return (
      titleUpper.includes("GİRİŞ") ||
      titleUpper.includes("GIRIS") ||
      titleUpper.includes("SONUÇ") ||
      titleUpper.includes("SONUC")
    );
  }, [section.title]);

  const handleSaveSectionEdit = useCallback(() => {
    if (!cardState.editTitle.trim()) return;
    onUpdateSection({
      ...section,
      title: cardState.editTitle.trim(),
      description: cardState.editDescription.trim(),
    });
    updateCardState({ isEditingSection: false });
  }, [
    cardState.editTitle,
    cardState.editDescription,
    section,
    onUpdateSection,
    updateCardState,
  ]);

  const handleCancelSectionEdit = useCallback(() => {
    updateCardState({
      editTitle: section.title,
      editDescription: section.description,
      isEditingSection: false,
    });
  }, [section, updateCardState]);

  const handleAddSubSection = useCallback(() => {
    if (isSpecialSection) return;
    const newSub: OutlineSubSectionData = {
      title: `Yeni Alt Bölüm ${subSections.length + 1}`,
      description: "Alt bölüm kapsamı ve açıklaması...",
      sortOrder: subSections.length + 1,
    };
    const updatedSubs = [...subSections, newSub];
    onUpdateSection({
      ...section,
      subSections: updatedSubs,
    });
    if (!isExpanded) {
      onToggleExpand();
    }
  }, [
    isSpecialSection,
    subSections,
    section,
    onUpdateSection,
    isExpanded,
    onToggleExpand,
  ]);

  const handleDeleteSubSection = useCallback(
    (subIdx: number) => {
      const updatedSubs = subSections
        .filter((_, i) => i !== subIdx)
        .map((sub, i) => ({ ...sub, sortOrder: i + 1 }));
      onUpdateSection({
        ...section,
        subSections: updatedSubs,
      });
    },
    [subSections, section, onUpdateSection],
  );

  const handleSubDrop = useCallback(
    (targetIdx: number) => {
      if (
        cardState.draggedSubIdx === null ||
        cardState.draggedSubIdx === targetIdx
      ) {
        updateCardState({ draggedSubIdx: null, dragOverSubIdx: null });
        return;
      }

      const newSubs = [...subSections];
      const [movedItem] = newSubs.splice(cardState.draggedSubIdx, 1);
      newSubs.splice(targetIdx, 0, movedItem);

      const reordered = newSubs.map((s, i) => ({ ...s, sortOrder: i + 1 }));
      onUpdateSection({
        ...section,
        subSections: reordered,
      });

      updateCardState({ draggedSubIdx: null, dragOverSubIdx: null });
    },
    [
      cardState.draggedSubIdx,
      subSections,
      section,
      onUpdateSection,
      updateCardState,
    ],
  );

  const handleStartSubEdit = (subIdx: number) => {
    updateCardState({
      editingSubIndex: subIdx,
      subEditTitle: subSections[subIdx].title,
      subEditDescription: subSections[subIdx].description,
    });
  };

  const handleSaveSubEdit = (subIdx: number) => {
    if (!cardState.subEditTitle.trim()) return;
    const updatedSubs = subSections.map((sub, i) =>
      i === subIdx
        ? {
            ...sub,
            title: cardState.subEditTitle.trim(),
            description: cardState.subEditDescription.trim(),
          }
        : sub,
    );
    onUpdateSection({
      ...section,
      subSections: updatedSubs,
    });
    updateCardState({ editingSubIndex: null });
  };

  return {
    cardState,
    updateCardState,
    sectionNumber,
    subSections,
    hasSubSections,
    isSpecialSection,
    handleSaveSectionEdit,
    handleCancelSectionEdit,
    handleAddSubSection,
    handleDeleteSubSection,
    handleSubDrop,
    handleStartSubEdit,
    handleSaveSubEdit,
  };
}