"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Box, TaskType } from "@/core/db/schema";

interface TaskFormModalProps {
  mode: "add" | "edit";
  open: boolean;
  initialTitle?: string;
  initialPriority?: "HIGH" | "MEDIUM" | "LOW";
  initialTaskType?: TaskType;
  initialBoxId?: number | null;
  onSave: (data: {
    title: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    taskType?: TaskType;
    thesisBoxId?: number | null;
  }) => Promise<boolean>;
  onClose: () => void;
  boxes: Box[];
}

/**
 * Shared form modal for both the add and edit task flows with academic task types.
 *
 * @param props - Component props.
 * @returns The rendered task form modal.
 */
export function TaskFormModal({
  mode,
  open,
  initialTitle = "",
  initialPriority = "MEDIUM",
  initialTaskType = "MANUAL",
  initialBoxId = null,
  onSave,
  onClose,
  boxes,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">(
    initialPriority,
  );
  const [taskType, setTaskType] = useState<TaskType>(initialTaskType);
  const [boxId, setBoxId] = useState(
    initialBoxId != null ? String(initialBoxId) : "",
  );
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle(initialTitle);
    setPriority(initialPriority);
    setTaskType(initialTaskType);
    setBoxId(initialBoxId != null ? String(initialBoxId) : "");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const success = await onSave({
        title: title.trim(),
        priority,
        taskType,
        thesisBoxId: boxId ? Number(boxId) : null,
      });
      if (success) {
        resetForm();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const isAdd = mode === "add";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="max-w-md rounded-lg border-border bg-card gap-4"
        onEscapeKeyDown={(e) => saving && e.preventDefault()}
        onInteractOutside={(e) => saving && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
            {isAdd ? "Yeni Akademik Görev Ekle" : "Görevi Düzenle"}
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground leading-relaxed">
            {isAdd
              ? "Danışmanınızla görüşmenizden çıkan bir talebi veya kişisel tez hedefinizi ekleyin."
              : "Seçili görevin başlık, tür veya konu kutusu bilgisini güncelleyin."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label
              htmlFor="taskFormTitle"
              className="font-sans text-xs font-medium text-muted-foreground"
            >
              Görev Başlığı *
            </Label>
            <Input
              id="taskFormTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Danışmanın istediği metodoloji revizyonunu yap"
              aria-label="Görev Başlığı"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="taskFormType"
                className="font-sans text-xs font-medium text-muted-foreground"
              >
                Görev Türü
              </Label>
              <select
                id="taskFormType"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors cursor-pointer"
                aria-label="Görev Türü"
              >
                <option value="ADVISOR_REQUEST">Danışman Talebi</option>
                <option value="MANUAL">Kişisel Hedef</option>
                <option value="READING">Kaynak Okuma</option>
                <option value="NOTE_TAKING">Not & Alıntı</option>
                <option value="CARD_SORTING">Fiş Tasnifi</option>
                <option value="BOX_GAP">Literatür Tarama</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="taskFormPriority"
                className="font-sans text-xs font-medium text-muted-foreground"
              >
                Öncelik Derecesi
              </Label>
              <select
                id="taskFormPriority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")
                }
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors cursor-pointer"
                aria-label="Öncelik Derecesi"
              >
                <option value="HIGH">Yüksek Öncelik</option>
                <option value="MEDIUM">Orta Öncelik</option>
                <option value="LOW">Düşük Öncelik</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="taskFormBoxSelect"
              className="font-sans text-xs font-medium text-muted-foreground"
            >
              İlişkili Konu Kutusu
            </Label>
            <select
              id="taskFormBoxSelect"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors cursor-pointer"
              aria-label="İlişkili Konu Kutusu"
            >
              <option value="">Genel / Bağlantısız</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={handleClose}>
              İptal
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={saving || !title.trim()}
              className="rounded-md font-sans text-xs px-4 h-8.5 shadow-xs"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              {isAdd ? "Görevi Ekle" : "Değişiklikleri Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
