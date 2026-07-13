"use client";

import type { ThesisBox } from "@/db/schema";
import type { KanbanTask } from "../_types";
import { TaskFormModal } from "./task-form-modal";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: Omit<KanbanTask, "id">) => void;
  boxes: ThesisBox[];
}

/**
 * Thin wrapper around TaskFormModal for the "add task" flow.
 */
export function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  boxes,
}: AddTaskModalProps) {
  return (
    <TaskFormModal
      mode="add"
      open={isOpen}
      onSave={async (data) => {
        const matchedBox = boxes.find(
          (b) => String(b.id) === String(data.thesisBoxId),
        );
        onAdd({
          title: data.title,
          description: matchedBox
            ? `"${matchedBox.title}" alanı kapsamında tanımlanmış çalışma görevi.`
            : "Genel tez çalışma adımı.",
          status: "TODO",
          priority: data.priority,
          thesisBoxId: data.thesisBoxId ?? null,
          boxTitle: matchedBox ? matchedBox.title : "Genel",
        });
        return true;
      }}
      onClose={onClose}
      boxes={boxes}
    />
  );
}
