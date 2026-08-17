"use client";

import type { Box } from "@/core/db/schema";
import type { KanbanTask } from "../_lib/types";
import { TaskFormModal } from "./task-form-modal";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: Omit<KanbanTask, "id">) => void;
  boxes: Box[];
}

/**
 * Thin wrapper around TaskFormModal for the "add task" flow.
 *
 * @param root0 - Component props.
 * @param root0.isOpen - Whether the modal is visible.
 * @param root0.onClose - Callback invoked when the modal is closed.
 * @param root0.onAdd - Callback invoked with the created task.
 * @param root0.boxes - Topic boxes available for task assignment.
 * @returns The rendered add-task modal.
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
