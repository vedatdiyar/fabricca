"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Box } from "@/db/schema";
import type { KanbanTask } from "../_lib/types";
import { AddTaskModal } from "./add-task-modal";
import { EditTaskModal } from "./edit-task-modal";
import { COLUMNS } from "./kanban-config";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTaskStatusChange: (
    taskId: string,
    newStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => void;
  onAddTask: (task: Omit<KanbanTask, "id">) => void;
  onEditTask: (
    taskId: string,
    input: {
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      thesisBoxId?: number | null;
    },
  ) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<void>;
  boxes: Box[];
}

/**
 * Renders the Kanban board with task columns, drag-and-drop, and add/edit modals.
 *
 * @param props - Component props.
 * @param props.tasks - All tasks to display on the board.
 * @param props.onTaskStatusChange - Callback invoked when a task is moved to a new status.
 * @param props.onAddTask - Callback invoked when a new task is added.
 * @param props.onEditTask - Async callback invoked when a task is edited.
 * @param props.onDeleteTask - Async callback invoked when a task is deleted.
 * @param props.boxes - Topic boxes available for task assignment.
 * @returns The rendered Kanban board.
 */
export function KanbanBoard({
  tasks,
  onTaskStatusChange,
  onAddTask,
  onEditTask,
  onDeleteTask,
  boxes,
}: KanbanBoardProps) {
  const [activeDragCol, setActiveDragCol] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setActiveDragCol(colId);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetStatus: "TODO" | "IN_PROGRESS" | "DONE",
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    onTaskStatusChange(taskId, targetStatus);
    setActiveDragCol(null);
  };

  const openEditModal = (task: KanbanTask) => {
    setEditingTask(task);
  };

  const todoTasks = useMemo(
    () => tasks.filter((t) => t.status === "TODO"),
    [tasks],
  );
  const inProgressTasks = useMemo(
    () => tasks.filter((t) => t.status === "IN_PROGRESS"),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === "DONE"),
    [tasks],
  );

  const getColumnTasks = useMemo(
    () => ({
      TODO: todoTasks,
      IN_PROGRESS: inProgressTasks,
      DONE: doneTasks,
    }),
    [todoTasks, inProgressTasks, doneTasks],
  );

  return (
    <div className="w-full space-y-6">
      {/* Board Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/60">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Akademik Kanban Panosu
          </h2>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Tez adımlarınızı ve makale okuma döngülerinizi buradan takip edin.
            Sürükleyip bırakarak durumları anlık güncelleyebilirsiniz.
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 text-xs sm:text-sm font-sans shrink-0 rounded-md shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Görev Ekle</span>
        </Button>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={getColumnTasks[col.id]}
            isDragActive={activeDragCol === col.id}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={() => setActiveDragCol(null)}
            onEdit={openEditModal}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddTask}
        boxes={boxes}
      />

      <EditTaskModal
        key={editingTask?.id ?? "none"}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onEdit={onEditTask}
        boxes={boxes}
      />
    </div>
  );
}
