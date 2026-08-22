"use client";

import { toast } from "sonner";
import {
  createCitationCardAction,
  updateCitationCardAction,
  deleteCitationCardAction,
  moveCitationCardBoxAction,
  updateCardOutlineLinkAction,
} from "../actions";
import type { CitationCardItem } from "../_lib/types";

interface UseCardMutationsOptions {
  refreshData: () => Promise<void>;
  removeCardLocally: (id: number) => void;
}

/**
 * Orchestrates card mutations (save, delete, box move) including the
 * outline-link follow-up sequencing and user-facing feedback.
 *
 * @param options - Data refresh and local removal callbacks
 * @returns Card mutation handlers
 */
export function useCardMutations({
  refreshData,
  removeCardLocally,
}: UseCardMutationsOptions) {
  const handleSaveCard = async (
    cardData: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => {
    const targetOutlineId =
      cardData.outlineIds && cardData.outlineIds.length > 0
        ? cardData.outlineIds[0]
        : null;

    if (cardData.id) {
      // Update existing card
      const res = await updateCitationCardAction({
        id: cardData.id,
        sourceId: cardData.sourceId,
        boxId: cardData.boxId,
        noteType: cardData.noteType,
        pageNumber: cardData.pageNumber,
        content: cardData.content,
        comment: cardData.comment,
      });

      if (res.success) {
        await updateCardOutlineLinkAction({
          annotationId: cardData.id,
          outlineId: targetOutlineId,
        });
        toast.success("Alıntı fişi başarıyla güncellendi.");
        await refreshData();
      } else {
        toast.error(res.error);
      }
    } else {
      // Add new card
      const res = await createCitationCardAction({
        sourceId: cardData.sourceId,
        boxId: cardData.boxId,
        noteType: cardData.noteType,
        pageNumber: cardData.pageNumber,
        content: cardData.content,
        comment: cardData.comment,
      });

      if (res.success) {
        if (targetOutlineId !== null) {
          await updateCardOutlineLinkAction({
            annotationId: res.data.id,
            outlineId: targetOutlineId,
          });
        }
        toast.success("Yeni alıntı fişi başarıyla eklendi.");
        await refreshData();
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleDeleteCard = async (id: number) => {
    const res = await deleteCitationCardAction(id);
    if (res.success) {
      removeCardLocally(id);
      toast.success("Alıntı fişi silindi.");
    } else {
      toast.error(res.error);
    }
  };

  const handleMoveBox = async (cardId: number, targetBoxId: number) => {
    const res = await moveCitationCardBoxAction({ cardId, targetBoxId });
    if (res.success) {
      toast.success("Fiş yeni konu kutusuna taşındı.");
      await refreshData();
    } else {
      toast.error(res.error);
    }
  };

  return { handleSaveCard, handleDeleteCard, handleMoveBox };
}
