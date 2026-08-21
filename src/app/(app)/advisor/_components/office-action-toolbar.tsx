"use client";

import { useState } from "react";
import {
  CheckSquare,
  Copy,
  PlusCircle,
  Check,
  BookmarkPlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  saveDefenseNoteAction,
  createRevisionTaskAction,
} from "../office-actions";
import type { OfficeReviewReport } from "../_services/pipeline/types";
import type { DefenseMessage } from "./office-defense-chat";

interface OfficeActionToolbarProps {
  outlineId: number;
  outlineTitle: string;
  report: OfficeReviewReport;
  defenseMessages: DefenseMessage[];
  onResetToNewSubmission: () => void;
}

/**
 * Footer Action Toolbar for the Advisor's Office workspace.
 * Provides quick persistent actions:
 * - Save Defense Note to Outline (as PERSONAL_NOTE annotation)
 * - Create Revision Task in Kanban
 * - Copy to Word (Clipboard)
 * - Start New Draft Submission
 */
export function OfficeActionToolbar({
  outlineId,
  outlineTitle,
  report,
  defenseMessages,
  onResetToNewSubmission,
}: OfficeActionToolbarProps) {
  // Dialog States
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);

  const [hasCopiedWord, setHasCopiedWord] = useState(false);

  // 1. Open Note Dialog with auto-populated summary from defense or jury critiques
  const handleOpenNoteDialog = () => {
    const lastAdvisorMsg = [...defenseMessages]
      .reverse()
      .find((m) => m.role === "assistant");

    const defaultContent = lastAdvisorMsg
      ? `Danışman Müzakere Kararı (${outlineTitle}):\n${lastAdvisorMsg.content}`
      : `Taslak İnceleme Notu (${outlineTitle}):\n${report.diff.polished}\n\nÖnemli Şerh:\n${
          report.juryCritiques[0]?.critique || ""
        }`;

    setNoteContent(defaultContent);
    setIsNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await saveDefenseNoteAction({
        outlineId,
        noteContent: noteContent.trim(),
      });
      if (res.success) {
        toast.success("Savunma notu Alıntı Fişleri ve Bölüme başarıyla kaydedildi.");
        setIsNoteDialogOpen(false);
      } else {
        toast.error(res.error || "Not kaydedilemedi.");
      }
    } catch {
      toast.error("Not kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // 2. Open Task Dialog
  const handleOpenTaskDialog = () => {
    setTaskTitle(`Revizyon: ${outlineTitle.slice(0, 40)}`);
    const primaryCritique = report.juryCritiques[0];
    setTaskDescription(
      primaryCritique
        ? `Jüri Şerhi: ${primaryCritique.title}\n${primaryCritique.critique}\n\nÖnerilen Çözüm: ${primaryCritique.suggestedDefensePoint}`
        : "Taslak metindeki editoryal ve sayfa düzeltmelerini Word'e uygula.",
    );
    setIsTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskTitle.trim()) return;
    setIsSavingTask(true);
    try {
      const res = await createRevisionTaskAction({
        outlineId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
      });
      if (res.success) {
        toast.success("Revizyon görevi Kanban panosuna eklendi.");
        setIsTaskDialogOpen(false);
      } else {
        toast.error(res.error || "Görev oluşturulamadı.");
      }
    } catch {
      toast.error("Görev oluşturulurken bir hata oluştu.");
    } finally {
      setIsSavingTask(false);
    }
  };

  // 3. Copy Complete Office Summary for Word
  const handleCopyForWord = async () => {
    const formattedForWord = [
      `=== TEZ TASLAĞI & DANIŞMAN KENAR NOTLARI ===`,
      `Bölüm: ${outlineTitle}`,
      `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
      ``,
      `--- ÖNERİLEN RÖTUŞLU METİN (WORD İÇİN) ---`,
      report.diff.polished,
      ``,
      `--- YAPILAN EDİTORYAL DEĞİŞİKLİKLER ---`,
      ...(report.diff.changes || []).map((c) => `- ${c}`),
      ``,
      `--- SAYFA & KAYNAK DENETİMİ BULGULARI ---`,
      ...(report.audit.findings || []).map(
        (f) => `[${f.severity}] ${f.citedPages || ""} ${f.sourceTitle || ""}: ${f.message}`,
      ),
      ``,
      `--- JÜRİ ŞERHLERİ & SAVUNMA ÇIKIŞLARI ---`,
      ...(report.juryCritiques || []).map(
        (j) => `* [${j.category}] ${j.title}: ${j.critique} (Çıkış: ${j.suggestedDefensePoint})`,
      ),
    ].join("\n");

    await navigator.clipboard.writeText(formattedForWord);
    setHasCopiedWord(true);
    toast.success("Tüm inceleme ve rötuşlu metin Word için panoya kopyalandı.");
    setTimeout(() => setHasCopiedWord(false), 2500);
  };

  return (
    <>
      <div className="p-3 border-t border-border bg-card/95 backdrop-blur-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Action 1: Save Note */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenNoteDialog}
            className="text-xs h-8 gap-1.5 border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            <BookmarkPlus className="h-3.5 w-3.5 text-primary" />
            <span>Savunma Notunu Bölüme Kaydet</span>
          </Button>

          {/* Action 2: Create Task */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenTaskDialog}
            className="text-xs h-8 gap-1.5 border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            <CheckSquare className="h-3.5 w-3.5 text-amber-500" />
            <span>Revizyon Görevi Oluştur</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Action 3: Copy to Word */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyForWord}
            className="text-xs h-8 gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
          >
            {hasCopiedWord ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Word&apos;e Dön (Kopyala)</span>
              </>
            )}
          </Button>

          {/* Action 4: Reset Submission */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onResetToNewSubmission}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Yeni Taslak Masası</span>
          </Button>
        </div>
      </div>

      {/* Save Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-medium text-foreground">
              Savunma Notunu Bölüme Kaydet
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Bu not, Alıntı Fişleri (Citation Cards) modülüne ve <strong>{outlineTitle}</strong> bölümüne iliştirilecektir.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label htmlFor="note-content" className="text-xs font-medium text-foreground">
              Kaydedilecek Not İçeriği
            </Label>
            <Textarea
              id="note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[140px] text-xs p-3 bg-background border-border leading-relaxed"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNoteDialogOpen(false)}
              className="text-xs h-9"
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNote}
              disabled={isSavingNote || !noteContent.trim()}
              className="bg-primary text-primary-foreground text-xs h-9 gap-1.5"
            >
              {isSavingNote ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
              <span>Fiş Olarak Kaydet</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-medium text-foreground">
              Revizyon Görevi Oluştur
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Kanban panonuza yeni bir yüksek öncelikli revizyon görevi ekler.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-xs font-medium text-foreground">
                Görev Başlığı
              </Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="text-xs h-9 bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-desc" className="text-xs font-medium text-foreground">
                Görev Açıklaması / Düzeltme Notu
              </Label>
              <Textarea
                id="task-desc"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="min-h-[100px] text-xs p-2.5 bg-background border-border leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTaskDialogOpen(false)}
              className="text-xs h-9"
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveTask}
              disabled={isSavingTask || !taskTitle.trim()}
              className="bg-primary text-primary-foreground text-xs h-9 gap-1.5"
            >
              {isSavingTask ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckSquare className="h-3.5 w-3.5" />
              )}
              <span>Görevi Ekle</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
