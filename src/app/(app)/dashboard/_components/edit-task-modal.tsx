"use client";

import type { Box } from "@/db/schema";
import type { KanbanTask } from "../_lib/types";
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
  boxes: Box[];
}

/**
 * Thin wrapper around TaskFormModal for the "edit task" flow.
 *
 * @param root0 - Component props.
 * @param root0.task - The task being edited, or null when no task is selected.
 * @param root0.onClose - Callback invoked when the modal is closed.
 * @param root0.onEdit - Async callback invoked with the updated task data.
 * @param root0.boxes - Topic boxes available for task assignment.
 * @returns The rendered edit-task modal.
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
