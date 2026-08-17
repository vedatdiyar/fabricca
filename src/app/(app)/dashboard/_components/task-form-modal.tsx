"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Box } from "@/core/db/schema";

interface TaskFormModalProps {
  mode: "add" | "edit";
  open: boolean;
  initialTitle?: string;
  initialPriority?: "HIGH" | "MEDIUM" | "LOW";
  initialBoxId?: number | null;
  onSave: (data: {
    title: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    thesisBoxId?: number | null;
  }) => Promise<boolean>;
  onClose: () => void;
  boxes: Box[];
}

/**
 * Shared form modal for both the add and edit task flows.
 *
 * @param root0 - Component props.
 * @param root0.mode - Whether the modal operates in add or edit mode.
 * @param root0.open - Whether the modal is visible.
 * @param root0.initialTitle - Optional initial value for the task title.
 * @param root0.initialPriority - Optional initial value for the task priority.
 * @param root0.initialBoxId - Optional initial thesis box id for the task.
 * @param root0.onSave - Async callback invoked with the form data on submit.
 * @param root0.onClose - Callback invoked when the modal is closed.
 * @param root0.boxes - Topic boxes available for task assignment.
 * @returns The rendered task form modal.
 */
export function TaskFormModal({
  mode,
  open,
  initialTitle = "",
  initialPriority = "MEDIUM",
  initialBoxId = null,
  onSave,
  onClose,
  boxes,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">(
    initialPriority,
  );
  const [boxId, setBoxId] = useState(
    initialBoxId != null ? String(initialBoxId) : "",
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const resetForm = () => {
    setTitle(initialTitle);
    setPriority(initialPriority);
    setBoxId(initialBoxId != null ? String(initialBoxId) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const success = await onSave({
        title: title.trim(),
        priority,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md rounded-md border border-border bg-card p-6 relative space-y-4 shadow-md">
        <button
          type="button"
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1">
          <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
            {isAdd ? "Yeni Tez Görevi Ekle" : "Görevi Düzenle"}
          </h3>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            {isAdd
              ? "Kanban tahtasına takip edeceğiniz akademik bir araştırma adımı ekleyin."
              : "Seçili görevin başlık, öncelik veya konu kutusu bilgisini güncelleyin."}
          </p>
        </div>

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
              placeholder="Örn: Metodoloji bölümü taslağını oluştur"
              className="h-9 font-sans text-sm rounded-md border-border bg-background"
              aria-label="Görev Başlığı"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors cursor-pointer"
                aria-label="Öncelik Derecesi"
              >
                <option value="HIGH">Yüksek Öncelik</option>
                <option value="MEDIUM">Orta Öncelik</option>
                <option value="LOW">Düşük Öncelik</option>
              </select>
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
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors cursor-pointer"
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
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-md font-sans text-xs px-3.5 h-8.5"
            >
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
      </Card>
    </div>
  );
}
