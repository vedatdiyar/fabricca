"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThesisBox } from "@/db/schema";
import type { KanbanTask } from "../types";

interface EditTaskModalProps {
  task: KanbanTask | null;
  onClose: () => void;
  onEdit: (
    taskId: string,
    input: {
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      thesisBoxId?: number | null;
    },
  ) => Promise<boolean>;
  boxes: ThesisBox[];
}

export function EditTaskModal({
  task,
  onClose,
  onEdit,
  boxes,
}: EditTaskModalProps) {
  const [editTitle, setEditTitle] = useState(task?.title ?? "");
  const [editPriority, setEditPriority] = useState<"HIGH" | "MEDIUM" | "LOW">(
    task?.priority ?? "MEDIUM",
  );
  const [editBoxId, setEditBoxId] = useState(
    task?.thesisBoxId ? String(task.thesisBoxId) : "",
  );

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    const success = await onEdit(task.id, {
      title: editTitle.trim(),
      priority: editPriority,
      thesisBoxId: editBoxId ? Number(editBoxId) : null,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-card-foreground relative space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
            Görevi Düzenle
          </h3>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Seçili görevin başlık, öncelik veya kutu bilgisini güncelleyin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="editTitle"
              className="font-sans text-xs text-muted-foreground"
            >
              Görev Adı *
            </label>
            <input
              id="editTitle"
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Örn: Metodoloji taslağı oluşturma"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              aria-label="Görev Adı"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="editPriority"
                className="font-sans text-xs text-muted-foreground"
              >
                Öncelik Derecesi
              </label>
              <select
                id="editPriority"
                value={editPriority}
                onChange={(e) =>
                  setEditPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")
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
                htmlFor="editBoxSelect"
                className="font-sans text-xs text-muted-foreground"
              >
                İlişkili Konu Kutusu
              </label>
              <select
                id="editBoxSelect"
                value={editBoxId}
                onChange={(e) => setEditBoxId(e.target.value)}
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
              onClick={onClose}
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="default"
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              Güncelle
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
