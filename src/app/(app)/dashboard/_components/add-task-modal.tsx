"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThesisBox } from "@/db/schema";
import type { KanbanTask } from "../types";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: Omit<KanbanTask, "id">) => void;
  boxes: ThesisBox[];
}

export function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  boxes,
}: AddTaskModalProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [selectedBoxId, setSelectedBoxId] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const matchedBox = boxes.find((b) => String(b.id) === selectedBoxId);

    onAdd({
      title: taskTitle.trim(),
      description: matchedBox
        ? `"${matchedBox.title}" alanı kapsamında tanımlanmış çalışma görevi.`
        : "Genel tez çalışma adımı.",
      status: "TODO",
      priority,
      thesisBoxId: selectedBoxId ? Number(selectedBoxId) : null,
      boxTitle: matchedBox ? matchedBox.title : "Genel",
    });

    setTaskTitle("");
    setPriority("MEDIUM");
    setSelectedBoxId("");
    onClose();
  };

  const handleClose = () => {
    setTaskTitle("");
    setPriority("MEDIUM");
    setSelectedBoxId("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-card-foreground relative space-y-4">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
            Yeni Tez Görevi Ekle
          </h3>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Kanban tahtasına manuel akademik bir çalışma adımı kaydedin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="taskTitle"
              className="font-sans text-xs text-muted-foreground"
            >
              Görev Adı *
            </label>
            <input
              id="taskTitle"
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Örn: Metodoloji taslağı oluşturma"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              aria-label="Görev Adı"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="addPriority"
                className="font-sans text-xs text-muted-foreground"
              >
                Öncelik Derecesi
              </label>
              <select
                id="addPriority"
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
                htmlFor="addBoxSelect"
                className="font-sans text-xs text-muted-foreground"
              >
                İlişkili Konu Kutusu
              </label>
              <select
                id="addBoxSelect"
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
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
              onClick={handleClose}
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="default"
              className="rounded-md font-sans text-xs px-4 py-2"
            >
              Kaydet
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
