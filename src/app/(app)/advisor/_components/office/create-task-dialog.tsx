"use client";

import { CheckSquare, Loader2 } from "lucide-react";
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

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onChangeTaskTitle: (title: string) => void;
  taskDescription: string;
  onChangeTaskDescription: (desc: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

/**
 * Dialog for creating a revision task in Kanban.
 *
 * @param props - Component props.
 * @returns Rendered dialog markup.
 */
export function CreateTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  onChangeTaskTitle,
  taskDescription,
  onChangeTaskDescription,
  onSave,
  isSaving,
}: CreateTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label
              htmlFor="task-title"
              className="text-xs font-medium text-foreground"
            >
              Görev Başlığı
            </Label>
            <Input
              id="task-title"
              value={taskTitle}
              onChange={(e) => onChangeTaskTitle(e.target.value)}
              className="text-xs h-9 bg-background border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="task-desc"
              className="text-xs font-medium text-foreground"
            >
              Görev Açıklaması / Düzeltme Notu
            </Label>
            <Textarea
              id="task-desc"
              value={taskDescription}
              onChange={(e) => onChangeTaskDescription(e.target.value)}
              className="min-h-[100px] text-xs p-2.5 bg-background border-border leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !taskTitle.trim()}
            className="bg-primary text-primary-foreground text-xs h-9 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckSquare className="h-3.5 w-3.5" />
            )}
            <span>Görevi Ekle</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
