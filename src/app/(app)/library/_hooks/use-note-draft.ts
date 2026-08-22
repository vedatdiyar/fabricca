"use client";

import { useSyncExternalStore, useCallback } from "react";
import type { NoteType } from "../_lib/types";

export interface NoteDraftData {
  content: string;
  comment: string;
  pageNumber: string;
  noteType: NoteType;
}

const STORAGE_PREFIX = "fabricca_library_note_draft_";

const DEFAULT_DRAFT: NoteDraftData = {
  content: "",
  comment: "",
  pageNumber: "",
  noteType: "DIRECT_QUOTE",
};

const memoryCache = new Map<number, NoteDraftData>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function getDraftSnapshot(resourceId: number): NoteDraftData {
  if (typeof window === "undefined") {
    return DEFAULT_DRAFT;
  }

  if (memoryCache.has(resourceId)) {
    return memoryCache.get(resourceId)!;
  }

  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${resourceId}`);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<NoteDraftData>;
      const draft: NoteDraftData = {
        content: parsed.content ?? "",
        comment: parsed.comment ?? "",
        pageNumber: parsed.pageNumber ?? "",
        noteType: parsed.noteType ?? "DIRECT_QUOTE",
      };
      memoryCache.set(resourceId, draft);
      return draft;
    }
  } catch {
    // Ignore storage parse errors
  }

  memoryCache.set(resourceId, DEFAULT_DRAFT);
  return DEFAULT_DRAFT;
}

function persistDraft(resourceId: number, draft: NoteDraftData) {
  memoryCache.set(resourceId, draft);

  if (typeof window !== "undefined") {
    const storageKey = `${STORAGE_PREFIX}${resourceId}`;
    const hasAnyContent = Boolean(
      draft.content.trim() || draft.comment.trim() || draft.pageNumber.trim(),
    );

    try {
      if (hasAnyContent) {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage access fallback
    }
  }

  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Manages client-side auto-saving, restoring, and clearing of note and quote drafts.
 *
 * @param resourceId - Target library resource ID.
 * @returns Note draft state, field setters, auto-save status, and reset handler.
 */
export function useNoteDraft(resourceId: number) {
  const draft = useSyncExternalStore(
    subscribe,
    () => getDraftSnapshot(resourceId),
    () => DEFAULT_DRAFT,
  );

  const setContent = useCallback(
    (newContent: string) => {
      persistDraft(resourceId, { ...draft, content: newContent });
    },
    [resourceId, draft],
  );

  const setComment = useCallback(
    (newComment: string) => {
      persistDraft(resourceId, { ...draft, comment: newComment });
    },
    [resourceId, draft],
  );

  const setPageNumber = useCallback(
    (newPageNumber: string) => {
      persistDraft(resourceId, { ...draft, pageNumber: newPageNumber });
    },
    [resourceId, draft],
  );

  const setNoteType = useCallback(
    (newType: NoteType) => {
      persistDraft(resourceId, { ...draft, noteType: newType });
    },
    [resourceId, draft],
  );

  const clearDraft = useCallback(() => {
    persistDraft(resourceId, DEFAULT_DRAFT);
  }, [resourceId]);

  const hasDraft = Boolean(
    draft.content.trim() || draft.comment.trim() || draft.pageNumber.trim(),
  );

  return {
    content: draft.content,
    setContent,
    comment: draft.comment,
    setComment,
    pageNumber: draft.pageNumber,
    setPageNumber,
    noteType: draft.noteType,
    setNoteType,
    hasDraft,
    clearDraft,
  };
}
