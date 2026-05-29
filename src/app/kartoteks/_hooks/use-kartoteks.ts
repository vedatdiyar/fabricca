"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageState, Note, ThesisBox, InsightsState } from "../types";
import {
  getThesisBoxesAction,
  getAllNotesWithReferencesAction,
  updateNoteBoxAction,
} from "../../library/actions";
import {
  getInsightsAction,
  createInsightAction,
  deleteInsightAction,
  sharpenInsightAction,
} from "../actions";

const INITIAL_STATE: PageState = {
  boxes: [],
  notes: [],
  isLoading: true,
  transferringNoteId: null,
  draggedNoteId: null,
  isLeftPoolOver: false,
  overBoxId: null,
  error: null,
};

export function useKartoteks() {
  const [pageState, setPageState] = useState<PageState>(INITIAL_STATE);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);

  // Insights State
  const [insightsState, setInsightsState] = useState<InsightsState>({
    insights: [],
    isLoading: true,
    isSubmitting: false,
    ideaText: "",
    sharpeningIds: {},
    errorMessage: "",
  });

  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const loadInsights = useCallback(async () => {
    try {
      setInsightsState((prev) => ({ ...prev, isLoading: true }));
      const res = await getInsightsAction();
      if (res.success && res.insights) {
        setInsightsState((prev) => ({
          ...prev,
          insights: res.insights!,
          errorMessage: "",
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir sepeti yüklenemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası oluştu.",
      }));
    } finally {
      setInsightsState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handleCreateInsight = async (e: React.FormEvent) => {
    e.preventDefault();
    const ideaTextTrimmed = insightsState.ideaText.trim();
    if (!ideaTextTrimmed) return;

    try {
      setInsightsState((prev) => ({
        ...prev,
        isSubmitting: true,
        errorMessage: "",
      }));
      const res = await createInsightAction(ideaTextTrimmed);
      if (res.success) {
        setInsightsState((prev) => ({ ...prev, ideaText: "" }));
        await loadInsights();
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir kaydedilirken bir hata oluştu.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Beklenmeyen bir hata oluştu.",
      }));
    } finally {
      setInsightsState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleDeleteInsight = async (insightId: number) => {
    try {
      const res = await deleteInsightAction(insightId);
      if (res.success) {
        setInsightsState((prev) => ({
          ...prev,
          insights: prev.insights.filter((item) => item.id !== insightId),
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir silinemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası.",
      }));
    }
  };

  const handleSharpenInsight = async (insightId: number) => {
    try {
      setInsightsState((prev) => ({
        ...prev,
        sharpeningIds: { ...prev.sharpeningIds, [insightId]: true },
        errorMessage: "",
      }));
      const res = await sharpenInsightAction(insightId);
      if (res.success && res.suggestions) {
        setInsightsState((prev) => ({
          ...prev,
          insights: prev.insights.map((item) =>
            item.id === insightId
              ? { ...item, aiContextSuggestions: res.suggestions! }
              : item,
          ),
        }));
      } else {
        setInsightsState((prev) => ({
          ...prev,
          errorMessage: res.error || "Fikir keskinleştirilemedi.",
        }));
      }
    } catch {
      setInsightsState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası.",
      }));
    } finally {
      setInsightsState((prev) => ({
        ...prev,
        sharpeningIds: { ...prev.sharpeningIds, [insightId]: false },
      }));
    }
  };

  const loadData = useCallback(async () => {
    setPageState((prev) => ({ ...prev, error: null }));
    try {
      const [boxesRes, notesRes] = await Promise.all([
        getThesisBoxesAction(),
        getAllNotesWithReferencesAction(),
      ]);

      let nextBoxes = INITIAL_STATE.boxes;
      let nextNotes = INITIAL_STATE.notes;

      if (boxesRes.success && boxesRes.boxes) {
        nextBoxes = boxesRes.boxes as ThesisBox[];
      } else {
        throw new Error(boxesRes.error || "Tematik kutular yüklenemedi.");
      }

      if (notesRes.success && notesRes.notes) {
        nextNotes = notesRes.notes as Note[];
      } else {
        throw new Error(notesRes.error || "Okuma notları yüklenemedi.");
      }

      setPageState((prev) => ({
        ...prev,
        boxes: nextBoxes,
        notes: nextNotes,
        error: null,
      }));
    } catch (err) {
      console.error("Bilgi Fişi load error:", err);
      setPageState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Veriler yüklenirken bir hata oluştu.",
      }));
    } finally {
      setPageState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadData();
        loadInsights();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadData, loadInsights]);

  const handleTransferNote = async (noteId: number, boxId: number | null) => {
    if (pageState.transferringNoteId !== null) return;
    try {
      setPageState((prev) => ({ ...prev, transferringNoteId: noteId }));
      const res = await updateNoteBoxAction(noteId, boxId || 0);
      if (res.success) {
        await loadData();
      } else {
        setPageState((prev) => ({
          ...prev,
          error: res.error || "Not transfer edilirken bir hata oluştu.",
        }));
      }
    } catch (err) {
      console.error("Transfer error:", err);
      setPageState((prev) => ({
        ...prev,
        error: "Not transfer edilirken beklenmeyen bir hata oluştu.",
      }));
    } finally {
      setPageState((prev) => ({ ...prev, transferringNoteId: null }));
    }
  };

  const handleDragEnterLeftPool = (e: React.DragEvent) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, isLeftPoolOver: true }));
  };

  const handleDragLeaveLeftPool = () => {
    setPageState((prev) => ({ ...prev, isLeftPoolOver: false }));
  };

  const handleDropLeftPool = async (e: React.DragEvent) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, isLeftPoolOver: false }));
    const noteIdStr = e.dataTransfer.getData("noteId");
    if (!noteIdStr) return;
    const noteId = Number(noteIdStr);
    const note = pageState.notes.find((n) => n.id === noteId);
    if (note && note.boxId !== null) {
      await handleTransferNote(noteId, null);
    }
  };

  const handleDragStartNote = (e: React.DragEvent, noteId: number) => {
    e.dataTransfer.setData("noteId", noteId.toString());
    setPageState((prev) => ({ ...prev, draggedNoteId: noteId }));
  };

  const handleDragEndNote = () => {
    setPageState((prev) => ({ ...prev, draggedNoteId: null }));
  };

  const handleDragEnterBox = (e: React.DragEvent, boxId: number) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, overBoxId: boxId }));
  };

  const handleDragLeaveBox = () => {
    setPageState((prev) => ({ ...prev, overBoxId: null }));
  };

  const handleDropBox = async (e: React.DragEvent, boxId: number) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, overBoxId: null }));
    const noteIdStr = e.dataTransfer.getData("noteId");
    if (!noteIdStr) return;
    const noteId = Number(noteIdStr);
    const note = pageState.notes.find((n) => n.id === noteId);
    if (note && note.boxId !== boxId) {
      await handleTransferNote(noteId, boxId);
    }
  };

  return {
    pageState,
    setPageState,
    previewNote,
    setPreviewNote,
    insightsState,
    setInsightsState,
    isInsightsOpen,
    setIsInsightsOpen,
    loadData,
    loadInsights,
    handleCreateInsight,
    handleDeleteInsight,
    handleSharpenInsight,
    handleTransferNote,
    handleDragEnterLeftPool,
    handleDragLeaveLeftPool,
    handleDropLeftPool,
    handleDragStartNote,
    handleDragEndNote,
    handleDragEnterBox,
    handleDragLeaveBox,
    handleDropBox,
  };
}
