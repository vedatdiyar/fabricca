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
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
            Savunma Notunu Bölüme Kaydet
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Bu not, Alıntı Fişleri (Citation Cards) modülüne ve{" "}
            <strong>{outlineTitle}</strong> bölümüne iliştirilecektir.
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
            className="min-h-[140px] text-xs p-3 bg-background border-border leading-relaxed"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !noteContent.trim()}
            className="bg-primary text-primary-foreground text-xs gap-1.5"
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
