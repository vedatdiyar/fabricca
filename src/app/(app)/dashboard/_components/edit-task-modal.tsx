"use client";

import type { Box, TaskType } from "@/core/db/schema";
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
      taskType?: TaskType;
      thesisBoxId?: number | null;
    },
  ) => Promise<boolean>;
  boxes: Box[];
}

/**
 * Wrapper around TaskFormModal for the "edit task" flow.
 *
 * @param props - Component props.
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
      initialTaskType={task?.taskType}
      initialBoxId={task?.thesisBoxId}
      onSave={async (data) => onEdit(task!.id, data)}
      onClose={onClose}
      boxes={boxes}
    />
  );
}
