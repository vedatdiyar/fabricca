"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  getLibraryResourcesAction,
  createResourceNoteAction,
  deleteResourceNoteAction,
} from "../actions";
import type { LibraryResourceNote, NoteType } from "../_types/types";

interface UseResourceNotesParams {
  selectedResourceId: number | null;
}

/**
 * Manages notes state and CRUD operations for the currently selected resource.
 *
 * @param params - The currently selected resource ID.
 * @param params.selectedResourceId - The ID of the resource whose notes are managed.
 * @returns Notes list, state setter, and note mutation handlers.
 */
export function useResourceNotes({
  selectedResourceId,
}: UseResourceNotesParams) {
  const [notes, setNotes] = useState<LibraryResourceNote[]>([]);

  useEffect(() => {
    /**
     * Loads notes from the server on initial mount.
     */
    async function loadNotes() {
      try {
        const res = await getLibraryResourcesAction();
        if (res.success && res.data) {
          setNotes(res.data.notes);
        }
      } catch {}
    }

    loadNotes();
  }, []);

  const handleAddNote = useCallback(
    async (input: {
      pageNumber: string;
      noteType: NoteType;
      content: string;
    }) => {
      if (!selectedResourceId) return;

      const res = await createResourceNoteAction({
        resourceId: selectedResourceId,
        ...input,
      });

      if (res.success && res.data) {
        setNotes((prev) => [res.data, ...prev]);
        toast.success("Not ve alıntı fişi kaydedildi.");
      } else {
        toast.error(res.error || "Not kaydedilirken hata oluştu.");
      }
    },
    [selectedResourceId],
  );

  const handleDeleteNote = useCallback(async (noteId: number) => {
    const res = await deleteResourceNoteAction(noteId);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Not silindi.");
    } else {
      toast.error(res.error || "Not silinirken hata oluştu.");
    }
  }, []);

  return {
    notes,
    setNotes,
    handleAddNote,
    handleDeleteNote,
  };
}
