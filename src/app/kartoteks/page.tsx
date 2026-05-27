"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  FolderMinus,
  Sparkles,
  Loader2,
  FolderClosed,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  getThesisBoxesAction,
  getAllNotesWithReferencesAction,
  updateNoteBoxAction,
} from "../library/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ThesisBox {
  id: number;
  thesisCoreId: number;
  name: string;
  description: string | null;
  order: number;
  createdAt: Date | null;
}

interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  boxId: number | null;
  createdAt: Date | null;
  referenceTitle: string | null;
  referenceAuthors: string | null;
  referenceYear: number | null;
}

export default function KartoteksPage() {
  const [boxes, setBoxes] = useState<ThesisBox[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transferringNoteId, setTransferringNoteId] = useState<number | null>(
    null,
  );
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [isLeftPoolOver, setIsLeftPoolOver] = useState(false);
  const [overBoxId, setOverBoxId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [boxesRes, notesRes] = await Promise.all([
        getThesisBoxesAction(),
        getAllNotesWithReferencesAction(),
      ]);

      if (boxesRes.success && boxesRes.boxes) {
        setBoxes(boxesRes.boxes);
      } else {
        throw new Error(boxesRes.error || "Tematik kutular yüklenemedi.");
      }

      if (notesRes.success && notesRes.notes) {
        setNotes(notesRes.notes as Note[]);
      } else {
        throw new Error(notesRes.error || "Okuma notları yüklenemedi.");
      }
    } catch (err) {
      console.error("Bilgi Fişi load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Veriler yüklenirken bir hata oluştu.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadData();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadData]);

  const handleTransferNote = async (noteId: number, boxId: number | null) => {
    if (transferringNoteId !== null) return;
    try {
      setTransferringNoteId(noteId);
      // Passing 0 if boxId is null, though toggle logic in backend resets it on existing match
      const res = await updateNoteBoxAction(noteId, boxId || 0);
      if (res.success) {
        await loadData();
      } else {
        setError(res.error || "Not transfer edilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Transfer error:", err);
      setError("Not transfer edilirken beklenmeyen bir hata oluştu.");
    } finally {
      setTransferringNoteId(null);
    }
  };

  // Filter notes into Classified and Unclassified pools
  const unclassifiedNotes = notes.filter((note) => note.boxId === null);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground animate-pulse">
          Bilgi Fişi Laboratuvarı yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 font-sans">
      {/* Header */}
      <header className="border-b border-border pb-6 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <span>Bilgi Fişi Laboratuvarı</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Okuma notlarınızı ve atıf fişlerinizi esnek tematik çalışma
            kutularına tasnif edin
          </p>
        </div>
        <span className="text-xs font-mono text-primary bg-card border border-border px-3 py-1 rounded">
          Active Laboratory
        </span>
      </header>

      {/* Info Warning */}
      {error && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive/10 text-destructive-foreground mb-6"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-none">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT COLUMN: Unclassified Notes Pool (33% width) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsLeftPoolOver(true);
          }}
          onDragLeave={() => setIsLeftPoolOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsLeftPoolOver(false);
            const noteIdStr = e.dataTransfer.getData("noteId");
            if (!noteIdStr) return;
            const noteId = Number(noteIdStr);
            const note = notes.find((n) => n.id === noteId);
            if (note && note.boxId !== null) {
              await handleTransferNote(noteId, note.boxId);
            }
          }}
          className={`lg:col-span-1 border p-6 rounded-lg shadow-xl flex flex-col space-y-6 min-h-[400px] transition-all duration-200 ${
            isLeftPoolOver
              ? "border-primary bg-secondary"
              : "border-border bg-card"
          }`}
        >
          <div className="border-b border-border pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" />
              <span>Tasnifsiz Fiş Havuzu</span>
            </h2>
            <span className="text-[10px] font-mono font-bold bg-secondary border border-border text-primary px-2 py-0.5 rounded">
              {unclassifiedNotes.length} Kart
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-normal font-sans">
            Kütüphanede okuma yaparken aldığınız ve henüz hiçbir tematik kutuya
            bağlamadığınız ham fişler. Aşağıdaki kutulardan birine tıkla ve fişi
            hemen yerleştir.
          </p>

          {unclassifiedNotes.length === 0 ? (
            <div className="flex-1 border border-dashed border-border rounded-lg flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground bg-background/40 italic">
              Tasnif edilmemiş kart bulunmuyor. Kütüphaneden yeni notlar
              alabilir ya da kutulardaki kartları buraya geri çekebilirsiniz.
            </div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {unclassifiedNotes.map((note) => (
                <div
                  key={note.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("noteId", note.id.toString());
                    setDraggedNoteId(note.id);
                  }}
                  onDragEnd={() => setDraggedNoteId(null)}
                  className={`border p-4 rounded-lg space-y-3 relative overflow-hidden group hover:border-primary/40 transition duration-150 shadow-sm cursor-grab active:cursor-grabbing ${
                    draggedNoteId === note.id
                      ? "border-primary opacity-50"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span
                      title={note.referenceTitle || ""}
                      className="text-[9px] font-mono text-primary bg-secondary border border-border px-2 py-0.5 rounded font-semibold truncate max-w-[170px]"
                    >
                      {note.referenceAuthors || "Bilinmeyen Yazar"} •{" "}
                      {note.referenceYear || "Yıl Yok"}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      Fiş #{note.id}
                    </span>
                  </div>

                  <p className="text-xs text-foreground leading-relaxed font-sans line-clamp-4 group-hover:line-clamp-none transition-all duration-300 whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {/* Transfer Actions */}
                  {boxes.length > 0 && (
                    <div className="pt-3 border-t border-border mt-2 space-y-1.5">
                      <span className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground block">
                        Kutuya Fişle:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {boxes.map((box) => (
                          <button
                            key={box.id}
                            type="button"
                            onClick={() => handleTransferNote(note.id, box.id)}
                            disabled={transferringNoteId === note.id}
                            className="text-[9px] px-2 py-1 rounded transition duration-150 cursor-pointer bg-card border border-border text-muted-foreground hover:border-primary hover:text-primary font-semibold font-sans disabled:opacity-50"
                            title={`${box.name}: ${box.description || "Açıklama yok"}`}
                          >
                            {box.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Thematic Boxes Grid (67% width) */}
        <div className="lg:col-span-2 border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 min-h-[400px]">
          <div className="border-b border-border pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span>Tematik Bilgi Kutuları</span>
            </h2>
            <span className="text-[10px] font-mono font-bold bg-secondary border border-border text-primary px-2 py-0.5 rounded">
              {boxes.length} Kutu
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-normal font-sans">
            Onboarding mülakatında belirlediğiniz tezin temel kavramsal
            direkleri. Kutulardaki kartları inceleyebilir, silebilir veya havuz
            simgesine tıklayarak tekrar tasnifsiz havuzuna aktarabilirsiniz.
          </p>

          {boxes.length === 0 ? (
            <div className="flex-1 border border-dashed border-border rounded-lg flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground bg-background/40 italic">
              Henüz tanımlanmış bir tematik çalışma kutusu bulunamadı. Lütfen
              onboarding mülakatını tamamlayın.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {boxes.map((box) => {
                const boxNotes = notes.filter((note) => note.boxId === box.id);
                return (
                  <div
                    key={box.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setOverBoxId(box.id);
                    }}
                    onDragLeave={() => setOverBoxId(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setOverBoxId(null);
                      const noteIdStr = e.dataTransfer.getData("noteId");
                      if (!noteIdStr) return;
                      const noteId = Number(noteIdStr);
                      const note = notes.find((n) => n.id === noteId);
                      if (note && note.boxId !== box.id) {
                        await handleTransferNote(noteId, box.id);
                      }
                    }}
                    className={`border p-5 rounded-lg flex flex-col justify-between space-y-4 shadow-sm transition duration-200 ${
                      overBoxId === box.id
                        ? "border-primary bg-secondary"
                        : "border-border bg-background"
                    }`}
                  >
                    {/* Box Header Info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 truncate pr-2">
                          <FolderClosed className="size-4 text-primary shrink-0" />
                          <span className="truncate">{box.name}</span>
                        </h3>
                        <span className="text-[9px] font-mono font-bold bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded shrink-0">
                          {boxNotes.length} Kart
                        </span>
                      </div>
                      {box.description && (
                        <p className="text-xs text-muted-foreground leading-normal font-sans">
                          {box.description}
                        </p>
                      )}
                    </div>

                    {/* Classified Notes inside Box */}
                    <div className="flex-1 flex flex-col pt-3 border-t border-border space-y-3 min-h-[150px]">
                      {boxNotes.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground/60 border border-dashed border-border/80 rounded bg-card/20 p-4 text-center font-sans">
                          Kutu boş. Sol sütundan fiş yerleştirin.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {boxNotes.map((note) => (
                            <div
                              key={note.id}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "noteId",
                                  note.id.toString(),
                                );
                                setDraggedNoteId(note.id);
                              }}
                              onDragEnd={() => setDraggedNoteId(null)}
                              className={`border bg-card/40 p-3 rounded-lg space-y-2 relative group hover:border-primary/30 transition duration-150 cursor-grab active:cursor-grabbing ${
                                draggedNoteId === note.id
                                  ? "border-primary opacity-50"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex justify-between items-center border-b border-border/50 pb-1">
                                <span
                                  title={note.referenceTitle || ""}
                                  className="text-[9px] font-mono text-muted-foreground font-semibold bg-secondary px-1.5 py-0.5 rounded truncate max-w-[120px]"
                                >
                                  {note.referenceAuthors || "Yazar Yok"} (
                                  {note.referenceYear || "Yıl Yok"})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTransferNote(note.id, box.id)
                                  }
                                  disabled={transferringNoteId === note.id}
                                  className="text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                                  title="Tasnifsiz Havuzuna Çıkar"
                                >
                                  <FolderMinus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <p className="text-[11px] text-foreground leading-relaxed font-sans line-clamp-3 hover:line-clamp-none transition-all duration-150">
                                {note.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
