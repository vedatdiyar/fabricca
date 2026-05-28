"use client";

import React, { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { saveNoteAction, updateNoteAction } from "../actions";
import { NoteFormFields } from "./note-form-fields";

interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  isUserNote: boolean | null;
  boxId: number | null;
  mainArgument?: string | null;
  quotes?: string | null;
  concepts?: string | null;
  criticalNotes?: string | null;
  connections?: string | null;
  researchNotes?: string | null;
  memoryAnchors?: string | null;
  createdAt: Date | null;
}

interface Box {
  id: number;
  name: string;
  description: string | null;
}

interface NoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRefId: number | null;
  editingNoteId: number | null;
  savedNotes: Note[];
  boxes: Box[];
  onNoteSaved: () => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  setNoteError: (err: string | null) => void;
  setNoteSuccess: (success: string | null) => void;
}

export function NoteDialog({
  isOpen,
  onOpenChange,
  selectedRefId,
  editingNoteId,
  savedNotes,
  boxes,
  onNoteSaved,
  onSavingChange,
  setNoteError,
  setNoteSuccess,
}: NoteDialogProps) {
  const [formData, setFormData] = useState({
    mainArgument: "",
    quotes: "",
    concepts: "",
    criticalNotes: "",
    connections: "",
    researchNotes: "",
    memoryAnchors: "",
    selectedBoxId: null as number | null,
    isSavingNote: false,
    prevEditingNoteId: null as number | null,
    prevIsOpen: false,
  });

  const clearNoteForm = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      mainArgument: "",
      quotes: "",
      concepts: "",
      criticalNotes: "",
      connections: "",
      researchNotes: "",
      memoryAnchors: "",
      selectedBoxId: null,
    }));
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFieldChange = useCallback(
    <K extends keyof typeof formData>(
      field: K,
      value: (typeof formData)[K],
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Render-Phase State Synchronization
  if (
    isOpen !== formData.prevIsOpen ||
    editingNoteId !== formData.prevEditingNoteId
  ) {
    const nextFormData = {
      ...formData,
      prevIsOpen: isOpen,
      prevEditingNoteId: editingNoteId,
    };

    if (isOpen) {
      if (editingNoteId !== null) {
        const note = savedNotes.find((n) => n.id === editingNoteId);
        if (note) {
          nextFormData.selectedBoxId = note.boxId;
          nextFormData.mainArgument = note.mainArgument || "";
          nextFormData.quotes = note.quotes || "";
          nextFormData.concepts = note.concepts || "";
          nextFormData.criticalNotes = note.criticalNotes || "";
          nextFormData.connections = note.connections || "";
          nextFormData.researchNotes = note.researchNotes || "";
          nextFormData.memoryAnchors = note.memoryAnchors || "";
        }
      } else {
        nextFormData.selectedBoxId = null;
        nextFormData.mainArgument = "";
        nextFormData.quotes = "";
        nextFormData.concepts = "";
        nextFormData.criticalNotes = "";
        nextFormData.connections = "";
        nextFormData.researchNotes = "";
        nextFormData.memoryAnchors = "";
      }
    }
    setFormData(nextFormData);
  }

  const handleSaveNote = async () => {
    if (selectedRefId === null) return;

    const {
      mainArgument,
      quotes,
      concepts,
      criticalNotes,
      connections,
      researchNotes,
      memoryAnchors,
      selectedBoxId,
    } = formData;

    if (
      !mainArgument.trim() &&
      !quotes.trim() &&
      !concepts.trim() &&
      !criticalNotes.trim() &&
      !connections.trim() &&
      !researchNotes.trim() &&
      !memoryAnchors.trim()
    ) {
      setNoteError("Lütfen en az bir akademik alanı doldurun.");
      setNoteSuccess(null);
      return;
    }

    setFormData((prev) => ({ ...prev, isSavingNote: true }));
    onSavingChange(true);
    setNoteError(null);
    setNoteSuccess(null);

    try {
      if (editingNoteId !== null) {
        const res = await updateNoteAction({
          noteId: editingNoteId,
          boxId: selectedBoxId,
          mainArgument: mainArgument.trim(),
          quotes: quotes.trim(),
          concepts: concepts.trim(),
          criticalNotes: criticalNotes.trim(),
          connections: connections.trim(),
          researchNotes: researchNotes.trim(),
          memoryAnchors: memoryAnchors.trim(),
        });

        if (res.success) {
          setNoteSuccess("Okuma notunuz başarıyla güncellendi.");
          clearNoteForm();
          await onNoteSaved();
        } else {
          setNoteError(res.error || "Not güncellenirken bir hata oluştu.");
        }
      } else {
        const res = await saveNoteAction(
          selectedRefId,
          {
            mainArgument: mainArgument.trim(),
            quotes: quotes.trim(),
            concepts: concepts.trim(),
            criticalNotes: criticalNotes.trim(),
            connections: connections.trim(),
            researchNotes: researchNotes.trim(),
            memoryAnchors: memoryAnchors.trim(),
          },
          selectedBoxId,
        );

        if (res.success) {
          setNoteSuccess("Okuma notunuz veritabanına başarıyla kaydedildi.");
          clearNoteForm();
          await onNoteSaved();
        } else {
          setNoteError(res.error || "Not kaydedilirken bir hata oluştu.");
        }
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "İşlem sırasında beklenmeyen bir sunucu hatası oluştu.";
      setNoteError(errMsg);
    } finally {
      setFormData((prev) => ({ ...prev, isSavingNote: false }));
      onSavingChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-[700px] overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4.5 text-primary" />
            <span>
              {editingNoteId !== null ? "Kartoteks Düzenle" : "Kartoteks Formu"}
            </span>
          </DialogTitle>
          <DialogDescription>
            Makaleden çıkardığınız akademik notları kategorize edilmiş şekilde
            girin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
          <NoteFormFields
            formData={formData}
            boxes={boxes}
            handleFieldChange={handleFieldChange}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={clearNoteForm}
            className="px-4 py-2.5 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-card transition duration-150 cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={formData.isSavingNote}
            className="px-4 py-2.5 bg-primary text-background rounded-lg text-xs font-semibold hover:bg-primary/90 transition duration-150 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {formData.isSavingNote && (
              <Loader2 className="size-3 animate-spin text-background" />
            )}
            <span>Değişiklikleri Kaydet</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
