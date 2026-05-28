"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, BookOpen, Plus, Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getReferencesAction,
  getNotesAction,
  getThesisBoxesAction,
} from "./actions";
import { NoteDialog } from "./_components/note-dialog";
import { NotesList } from "./_components/notes-list";
import { ReferencesSidebar } from "./_components/references-sidebar";

interface Reference {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  pdfUrl: string;
  abstract: string | null;
  status: string | null;
  createdAt: Date | null;
  downloadUrl: string;
}

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

interface LibraryState {
  references: Reference[];
  selectedRefId: number | null;
  mobileTab: string;
  isSavingNote: boolean;
  savedNotes: Note[];
  noteError: string | null;
  noteSuccess: string | null;
  editingNoteId: number | null;
  isDialogOpen: boolean;
  boxes: Array<{ id: number; name: string; description: string | null }>;
  selectedBoxId: number | null;
  filterByBox: boolean;
}

function HeaderSection() {
  return (
    <header className="border-b border-border pb-6 mb-8 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Kütüphane & Not Laboratuvarı
        </h1>
        <p className="text-sm text-muted-foreground">
          PDF yükleyin, R2 deposunda arşivleyin ve okuma notları alın
        </p>
      </div>
      <span className="text-xs font-mono text-primary bg-card border border-border px-3 py-1 rounded">
        Phase 2 - Active
      </span>
    </header>
  );
}

interface MobileTabsProps {
  value: string;
  onValueChange: (val: string) => void;
}

function MobileTabs({ value, onValueChange }: MobileTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className="lg:hidden mb-6"
    >
      <TabsList className="w-full bg-card border border-border p-1 rounded">
        <TabsTrigger value="references" className="flex-1">
          1. Dosya Yükleme & Kaynaklar
        </TabsTrigger>
        <TabsTrigger value="notes" className="flex-1">
          2. Okuma Notları & Atıflar
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

interface RightColumnProps {
  state: LibraryState;
  updateState: (updates: Partial<LibraryState>) => void;
  loadNotes: (refId: number) => Promise<void>;
  clearNoteForm: () => void;
  startEditingNote: (note: Note) => void;
}

function RightColumn({
  state,
  updateState,
  loadNotes,
  clearNoteForm,
  startEditingNote,
}: RightColumnProps) {
  const selectedRef = state.references.find(
    (ref) => ref.id === state.selectedRefId,
  );
  const displayedNotes =
    state.filterByBox && state.selectedBoxId !== null
      ? state.savedNotes.filter((note) => note.boxId === state.selectedBoxId)
      : state.savedNotes;

  return (
    <div
      className={`border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 ${
        state.mobileTab === "notes" ? "flex" : "hidden lg:flex"
      }`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
        2. Okuma Notları & Atıflar
      </h2>

      {selectedRef ? (
        <div className="flex flex-col space-y-6 flex-1">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono text-primary bg-background border border-border px-2 py-1 rounded">
              Aktif Çalışma Odası
            </span>
            <h3 className="text-lg font-bold text-foreground mt-2 truncate">
              {selectedRef.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Yazar: {selectedRef.authors || "Belirtilmemiş"} | Yıl:{" "}
              {selectedRef.year || "Belirtilmemiş"}
              {selectedRef.doi && ` | DOI: ${selectedRef.doi}`}
            </p>
          </div>

          {/* Dynamic Abstract Box */}
          {selectedRef.abstract && (
            <div className="bg-background border border-border p-4 rounded-lg transition-all duration-200">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Özet / Abstract
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedRef.abstract}
              </p>
            </div>
          )}

          {/* Kartoteks Fişi Ekleme Butonu */}
          <button
            onClick={() => {
              clearNoteForm();
              updateState({ isDialogOpen: true });
            }}
            className="w-full bg-primary text-background font-semibold text-sm py-3 rounded-lg transition duration-200 flex items-center justify-center space-x-2 hover:bg-primary/95 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-background" />
            <span>Makale Notu Ekle</span>
          </button>

          {/* Dialog (Modal) for Structured Note Form */}
          <NoteDialog
            isOpen={state.isDialogOpen}
            onOpenChange={(open) => {
              updateState({ isDialogOpen: open });
              if (!open) {
                updateState({ editingNoteId: null });
              }
            }}
            selectedRefId={state.selectedRefId}
            editingNoteId={state.editingNoteId}
            savedNotes={state.savedNotes}
            boxes={state.boxes}
            onNoteSaved={async () => {
              if (state.selectedRefId !== null) {
                await loadNotes(state.selectedRefId);
              }
            }}
            onSavingChange={(saving) => updateState({ isSavingNote: saving })}
            setNoteError={(err) => updateState({ noteError: err })}
            setNoteSuccess={(succ) => updateState({ noteSuccess: succ })}
          />

          {/* Feedback Alerts for Note */}
          {state.noteError && (
            <Alert
              variant="destructive"
              className="border-destructive bg-destructive/10 text-destructive-foreground"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
              <AlertDescription className="text-xs font-semibold leading-none">
                {state.noteError}
              </AlertDescription>
            </Alert>
          )}

          {state.noteSuccess && (
            <Alert className="border-primary bg-primary/10 text-primary">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <AlertDescription className="text-xs font-semibold leading-none">
                {state.noteSuccess}
              </AlertDescription>
            </Alert>
          )}

          <NotesList
            displayedNotes={displayedNotes}
            isSavingNote={state.isSavingNote}
            filterByBox={state.filterByBox}
            setFilterByBox={(val) => updateState({ filterByBox: val })}
            selectedBoxId={state.selectedBoxId}
            boxes={state.boxes}
            startEditingNote={startEditingNote}
          />
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center text-center space-y-4 py-12 bg-background rounded border border-border flex-1">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">
            Seçili Makale Bulunmuyor
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Okuma notları almak, APA atıflarını düzenlemek ve dijital danışman
            hocanızla tartışmak için sol sütundan bir makale seçin veya yeni bir
            PDF yükleyin.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [state, setState] = useState<LibraryState>({
    references: [],
    selectedRefId: null,
    mobileTab: "references",
    isSavingNote: false,
    savedNotes: [],
    noteError: null,
    noteSuccess: null,
    editingNoteId: null,
    isDialogOpen: false,
    boxes: [],
    selectedBoxId: null,
    filterByBox: false,
  });

  const updateState = useCallback((updates: Partial<LibraryState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearNoteForm = useCallback(() => {
    updateState({ editingNoteId: null, isDialogOpen: false });
  }, [updateState]);

  const loadReferences = useCallback(async () => {
    try {
      const res = await getReferencesAction();
      if (res.success && res.references) {
        let initialRefId: number | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const refIdParam = params.get("refId");
          const refTitleParam = params.get("refTitle");

          if (refIdParam) {
            const id = parseInt(refIdParam, 10);
            if (!isNaN(id)) {
              initialRefId = id;
            }
          } else if (refTitleParam) {
            const decodedTitle = decodeURIComponent(refTitleParam)
              .toLowerCase()
              .trim();
            const matchedRef = res.references.find(
              (ref) =>
                ref.title.toLowerCase().trim() === decodedTitle ||
                ref.title.toLowerCase().includes(decodedTitle) ||
                decodedTitle.includes(ref.title.toLowerCase()),
            );
            if (matchedRef) {
              initialRefId = matchedRef.id;
            }
          }
        }

        setState((prev) => {
          let selectedId = prev.selectedRefId;
          if (initialRefId !== null) {
            selectedId = initialRefId;
          } else if (res.references && res.references.length > 0) {
            selectedId =
              prev.selectedRefId === null
                ? res.references[0].id
                : prev.selectedRefId;
          }
          return {
            ...prev,
            references: res.references || [],
            selectedRefId: selectedId,
          };
        });
      }
    } catch (err) {
      console.error("Failed to load references:", err);
    }
  }, []);

  const loadNotes = useCallback(
    async (refId: number) => {
      try {
        const res = await getNotesAction(refId);
        if (res.success && res.notes) {
          updateState({ savedNotes: res.notes as Note[] });
        }
      } catch (err) {
        console.error("Failed to load notes:", err);
      }
    },
    [updateState],
  );

  // Load references and thesis boxes on mount
  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(async () => {
      if (!active) return;
      loadReferences();

      try {
        const res = await getThesisBoxesAction();
        if (res.success && res.boxes) {
          const params = new URLSearchParams(window.location.search);
          const boxIdParam = params.get("boxId");
          let initialSelectedBoxId: number | null = null;
          let initialFilterByBox = false;
          if (boxIdParam) {
            const bId = parseInt(boxIdParam, 10);
            if (!isNaN(bId)) {
              initialSelectedBoxId = bId;
              initialFilterByBox = true;
            }
          }
          updateState({
            boxes: res.boxes,
            selectedBoxId: initialSelectedBoxId,
            filterByBox: initialFilterByBox,
          });
        }
      } catch (err) {
        console.error("Failed to load thesis boxes in library page:", err);
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadReferences, updateState]);

  // Load notes whenever selectedRefId changes
  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (!active) return;
      if (state.selectedRefId !== null) {
        loadNotes(state.selectedRefId);
        // Reset note input states on reference switch
        updateState({
          editingNoteId: null,
          isDialogOpen: false,
          noteError: null,
          noteSuccess: null,
        });
      } else {
        updateState({ savedNotes: [] });
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [state.selectedRefId, loadNotes, updateState]);

  const startEditingNote = useCallback(
    (note: Note) => {
      updateState({ editingNoteId: note.id, isDialogOpen: true });
    },
    [updateState],
  );

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 font-sans">
      <HeaderSection />
      <MobileTabs
        value={state.mobileTab}
        onValueChange={(val) => updateState({ mobileTab: val })}
      />

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 flex-1">
        <ReferencesSidebar
          references={state.references}
          selectedRefId={state.selectedRefId}
          setSelectedRefId={(id) => {
            if (typeof id === "function") {
              setState((prev) => ({
                ...prev,
                selectedRefId: id(prev.selectedRefId),
              }));
            } else {
              updateState({ selectedRefId: id });
            }
          }}
          mobileTab={state.mobileTab}
          setMobileTab={(tab) => updateState({ mobileTab: tab })}
          loadReferences={loadReferences}
        />

        <RightColumn
          state={state}
          updateState={updateState}
          loadNotes={loadNotes}
          clearNoteForm={clearNoteForm}
          startEditingNote={startEditingNote}
        />
      </div>
    </div>
  );
}
