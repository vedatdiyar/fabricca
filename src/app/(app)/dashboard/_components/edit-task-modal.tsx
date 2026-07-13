"use client";

import type { ThesisBox } from "@/db/schema";
import type { KanbanTask } from "../_types";
import { TaskFormModal } from "./task-form-modal";

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

/**
 * Thin wrapper around TaskFormModal for the "edit task" flow.
 * The key={editingTask?.id ?? "none"} on the parent ensures remount.
 */
export function EditTaskModal({
  task,
  onClose,
  onEdit,
  boxes,
}: EditTaskModalProps) {
  return (
    <TaskFormModal
      mode="edit"
      open={task !== null}
      initialTitle={task?.title}
      initialPriority={task?.priority}
      initialBoxId={task?.thesisBoxId}
      onSave={async (data) => onEdit(task!.id, data)}
      onClose={onClose}
      boxes={boxes}
    />
  );
}
