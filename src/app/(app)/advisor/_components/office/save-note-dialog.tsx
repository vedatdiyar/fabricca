"use client";

import { BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SaveNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlineTitle: string;
  noteContent: string;
  onChangeNoteContent: (content: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

/**
 * Dialog for saving a defense note to the outline section.
 *
 * @param props - Component props.
 * @returns Rendered dialog markup.
 */
export function SaveNoteDialog({
  open,
  onOpenChange,
  outlineTitle,
  noteContent,
  onChangeNoteContent,
  onSave,
  isSaving,
}: SaveNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border rounded-lg p-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
            Savunma Notunu Bölüme Kaydet
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            Bu not, Alıntı Fişleri modülüne ve{" "}
            <strong className="text-foreground">{outlineTitle}</strong> bölümüne
            iliştirilecektir.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label
            htmlFor="note-content"
            className="text-xs font-medium text-foreground"
          >
            Kaydedilecek Not İçeriği
          </Label>
          <Textarea
            id="note-content"
            value={noteContent}
            onChange={(e) => onChangeNoteContent(e.target.value)}
            placeholder="Savunma notunuzu yazın..."
            className="min-h-[140px] text-xs p-2.5 bg-background border border-border resize-none leading-relaxed rounded-md text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-3 rounded-md border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !noteContent.trim()}
            className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="size-3.5" />
            )}
            <span>Fiş Olarak Kaydet</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
