"use client";

import { CheckSquare, Loader2, ListTodo } from "lucide-react";
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
      <DialogContent className="sm:max-w-xl bg-card border border-border rounded-lg p-6 shadow-xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-primary mb-0.5">
            <div className="size-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ListTodo className="size-4" />
            </div>
            <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
              Revizyon Görevi Oluştur
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            Danışmanın bu tespiti için Kanban panonuza yüksek öncelikli bir
            düzeltme görevi ekleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4">
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
              placeholder="Örn: 2. Bölüm Kavramsal Revizyonu"
              className="h-9 text-sm px-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground"
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
              placeholder="Görev detaylarını ve danışman şerhini yazın..."
              className="min-h-[160px] max-h-[300px] text-sm p-3 bg-background border border-border resize-y leading-relaxed rounded-md text-foreground placeholder:text-muted-foreground font-sans"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs px-3.5 rounded-md border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !taskTitle.trim()}
            className="h-8 text-xs px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckSquare className="size-3.5" />
            )}
            <span>Görevi Ekle</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

