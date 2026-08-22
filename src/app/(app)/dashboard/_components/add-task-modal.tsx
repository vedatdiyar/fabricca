"use client";

import type { Box } from "@/core/db/schema";
import type { TaskInput } from "../_lib/schemas";
import { TaskFormModal } from "./task-form-modal";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: TaskInput) => Promise<boolean> | void;
  boxes: Box[];
}

/**
 * Wrapper around TaskFormModal for the "add task" flow.
 *
 * @param props - Component props.
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
        const res = await onAdd({
          title: data.title,
          description: matchedBox
            ? `"${matchedBox.title}" alanı kapsamında tanımlanmış akademik çalışma adımı.`
            : "Genel tez çalışma adımı.",
          taskType: data.taskType ?? "MANUAL",
          status: "TODO",
          priority: data.priority,
          thesisBoxId: data.thesisBoxId ?? null,
        });
        return res !== false;
      }}
      onClose={onClose}
      boxes={boxes}
    />
  );
}
