import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Box, TaskType } from "@/core/db/schema";
import type { KanbanTask } from "../_lib/types";
import type { TaskInput } from "../_lib/schemas";
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
  onAddTask: (task: TaskInput) => Promise<boolean> | void;
  onEditTask: (
    taskId: string,
    input: {
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      taskType?: TaskType;
      thesisBoxId?: number | null;
    },
  ) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<void>;
  boxes: Box[];
}

/**
 * Renders the Academic Kanban board with automatic event-driven sync
 * and drag-and-drop mechanics.
 *
 * @param props - Component props.
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
    <div className="w-full space-y-5">
      {/* Board Header */}
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
              Akademik Kanban Panosu
            </h2>
          </div>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Okuma, not çıkarma, fiş tasnifi ve danışman taleplerinizi dengeli
            şekilde yürütün.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Yeni Görev</span>
          </Button>
        </div>
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
            onEdit={(task) => setEditingTask(task)}
            onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Modals */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAddTask}
        boxes={boxes}
      />

      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onEdit={onEditTask}
        boxes={boxes}
      />
    </div>
  );
}
