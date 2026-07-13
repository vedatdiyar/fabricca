"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThesisBox } from "@/db/schema";

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
  boxes: ThesisBox[];
}

/**
 * Shared form modal for both add and edit task flows.
 * Eliminates ~80% HTML/CSS duplication between AddTaskModal and EditTaskModal.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-card-foreground relative space-y-4">
        <button
          type="button"
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
            {isAdd ? "Yeni Tez Görevi Ekle" : "Görevi Düzenle"}
          </h3>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            {isAdd
              ? "Kanban tahtasına manuel akademik bir çalışma adımı kaydedin."
              : "Seçili görevin başlık, öncelik veya kutu bilgisini güncelleyin."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="taskFormTitle"
              className="font-sans text-xs text-muted-foreground"
            >
              Görev Adı *
            </label>
            <input
              id="taskFormTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Metodoloji taslağı oluşturma"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              aria-label="Görev Adı"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="taskFormPriority"
                className="font-sans text-xs text-muted-foreground"
              >
                Öncelik Derecesi
              </label>
              <select
                id="taskFormPriority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                aria-label="Öncelik Derecesi"
              >
                <option value="HIGH">Yüksek</option>
                <option value="MEDIUM">Orta</option>
                <option value="LOW">Düşük</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="taskFormBoxSelect"
                className="font-sans text-xs text-muted-foreground"
              >
                İlişkili Konu Kutusu
              </label>
              <select
                id="taskFormBoxSelect"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                aria-label="İlişkili Konu Kutusu"
              >
                <option value="">Genel / Yok</option>
                {boxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={saving}
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              {isAdd ? "Kaydet" : "Güncelle"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
