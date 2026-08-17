"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CitationPopoverContent } from "./citation-popover-content";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";

interface AdvisorCitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: RagSearchResultItem | null;
}

/**
 * Dialog showing the active RAG citation source details for the advisor chat.
 *
 * @param root0 - Component props.
 * @param root0.isOpen - Whether the dialog is visible.
 * @param root0.onClose - Callback invoked when the dialog is dismissed.
 * @param root0.source - The source to display, or null when nothing is selected.
 * @returns The citation dialog markup.
 */
export function AdvisorCitationDialog({
  isOpen,
  onClose,
  source,
}: AdvisorCitationDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {source && <CitationPopoverContent source={source} />}
      </DialogContent>
    </Dialog>
  );
}
