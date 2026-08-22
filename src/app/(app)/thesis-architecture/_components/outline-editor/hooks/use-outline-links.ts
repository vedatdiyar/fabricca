"use client";

import { Outline } from "@/core/db/schema";
import {
  linkAnnotationToOutlineAction,
  unlinkAnnotationFromOutlineAction,
  linkSourceToOutlineAction,
  unlinkSourceFromOutlineAction,
} from "../../../actions";
import { useOptimisticToggle } from "./use-optimistic-toggle";

interface UseOutlineLinksOptions {
  selectedOutline: Outline | null;
  localPinnedAnnotationsMap: Record<number, number[]>;
  applyAnnotationLinkOverride: (
    outlineId: number,
    annotationIds: number[],
  ) => void;
  localLinkedSourcesMap: Record<number, number[]>;
  applySourceLinkOverride: (outlineId: number, sourceIds: number[]) => void;
}

interface UseOutlineLinksResult {
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
 * Manages citation-card and source linking to the selected outline section
 * via a shared optimistic toggle implementation.
 *
 * @param root0 - Hook options.
 * @param root0.selectedOutline - The currently selected outline section or null.
 * @param root0.localPinnedAnnotationsMap - Effective annotation to outline link map (with optimistic overrides).
 * @param root0.applyAnnotationLinkOverride - Applies/rolls back an optimistic annotation-link change.
 * @param root0.localLinkedSourcesMap - Effective source to outline link map (with optimistic overrides).
 * @param root0.applySourceLinkOverride - Applies/rolls back an optimistic source-link change.
 * @returns Link modal states and toggle handlers.
 */
export function useOutlineLinks({
  selectedOutline,
  localPinnedAnnotationsMap,
  applyAnnotationLinkOverride,
  localLinkedSourcesMap,
  applySourceLinkOverride,
}: UseOutlineLinksOptions): UseOutlineLinksResult {
  const annotationToggle = useOptimisticToggle({
    outlineId: selectedOutline?.id ?? null,
    getLinkedIds: (outlineId) => localPinnedAnnotationsMap[outlineId] ?? [],
    applyOverride: applyAnnotationLinkOverride,
    linkAction: linkAnnotationToOutlineAction,
    unlinkAction: unlinkAnnotationFromOutlineAction,
    linkedToastMessage: "Alıntı kartı bölüme başarıyla bağlandı.",
    unlinkedToastMessage: "Alıntı kartının bölüm bağı kaldırıldı.",
  });

  const sourceToggle = useOptimisticToggle({
    outlineId: selectedOutline?.id ?? null,
    getLinkedIds: (outlineId) => localLinkedSourcesMap[outlineId] ?? [],
    applyOverride: applySourceLinkOverride,
    linkAction: linkSourceToOutlineAction,
    unlinkAction: unlinkSourceFromOutlineAction,
    linkedToastMessage: "Kaynak bölüme başarıyla bağlandı.",
    unlinkedToastMessage: "Kaynağın bölüm bağı kaldırıldı.",
  });

  return {
    isAnnotationLinkModalOpen: annotationToggle.isOpen,
    openAnnotationLinkModal: annotationToggle.openModal,
    closeAnnotationLinkModal: annotationToggle.closeModal,
    toggleAnnotationLink: annotationToggle.toggle,
    isSourceLinkModalOpen: sourceToggle.isOpen,
    openSourceLinkModal: sourceToggle.openModal,
    closeSourceLinkModal: sourceToggle.closeModal,
    toggleSourceLink: sourceToggle.toggle,
  };
}
