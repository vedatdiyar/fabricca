"use client";

import { useState } from "react";
import { toast } from "sonner";

interface LinkActionResponse {
  success: boolean;
  error?: string;
}

export interface OptimisticToggleOptions {
  /** The currently selected outline id, or null when no section is active. */
  outlineId: number | null;
  /** Returns the currently linked item IDs for an outline (with overrides). */
  getLinkedIds: (outlineId: number) => number[];
  /** Applies/rolls back an optimistic override of linked item IDs. */
  applyOverride: (outlineId: number, ids: number[]) => void;
  /** Server action linking an item to an outline. */
  linkAction: (
    outlineId: number,
    itemId: number,
  ) => Promise<LinkActionResponse>;
  /** Server action unlinking an item from an outline. */
  unlinkAction: (
    outlineId: number,
    itemId: number,
  ) => Promise<LinkActionResponse>;
  /** Toast shown when the item gets linked successfully. */
  linkedToastMessage: string;
  /** Toast shown when the item gets unlinked successfully. */
  unlinkedToastMessage: string;
}

/**
 * Generic optimistic link/unlink toggle for outline sections: manages the
 * manager-modal visibility, applies the optimistic override immediately and
 * rolls it back when the server action fails.
 *
 * @param options - Outline binding, server actions and toast copy
 * @returns Modal state, open/close handlers and the toggle action
 */
export function useOptimisticToggle(options: OptimisticToggleOptions) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);

  const closeModal = () => setIsOpen(false);

  const toggle = async (itemId: number) => {
    const outlineId = options.outlineId;
    if (!outlineId) return;

    const currentIds = options.getLinkedIds(outlineId);
    const isLinked = currentIds.includes(itemId);

    // Optimistic update
    const updated = isLinked
      ? currentIds.filter((id) => id !== itemId)
      : [...currentIds, itemId];

    options.applyOverride(outlineId, updated);

    const res = isLinked
      ? await options.unlinkAction(outlineId, itemId)
      : await options.linkAction(outlineId, itemId);

    if (res.success) {
      toast.success(
        isLinked ? options.unlinkedToastMessage : options.linkedToastMessage,
      );
    } else {
      toast.error(res.error ?? "İşlem gerçekleştirilemedi.");
      // Rollback
      options.applyOverride(outlineId, currentIds);
    }
  };

  return { isOpen, openModal, closeModal, toggle };
}
