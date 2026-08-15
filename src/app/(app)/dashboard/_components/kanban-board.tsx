"use client";

import { useState, useMemo, memo } from "react";
import {
  Activity,
  Clock,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  GripVertical,
  FolderKanban,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Box } from "@/db/schema";
import type { KanbanTask } from "../_lib/types";
import { AddTaskModal } from "./add-task-modal";
import { EditTaskModal } from "./edit-task-modal";

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

const COLUMNS = [
  {
    id: "TODO",
    label: "Yapılacaklar",
    icon: Clock,
    iconColor: "text-info",
    badgeColor: "bg-info/10 text-info border-info/20",
  },
  {
    id: "IN_PROGRESS",
    label: "Yapılıyor",
    icon: Activity,
    iconColor: "text-warning",
    badgeColor: "bg-warning/10 text-warning border-warning/20",
  },
  {
    id: "DONE",
    label: "Bitti",
    icon: CheckCircle2,
    iconColor: "text-success",
    badgeColor: "bg-success/10 text-success border-success/20",
  },
] as const;

const PRIORITY_CONFIG: Record<
  "HIGH" | "MEDIUM" | "LOW",
  { label: string; className: string }
> = {
  HIGH: {
    label: "Yüksek",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  MEDIUM: {
    label: "Orta",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  LOW: {
    label: "Düşük",
    className: "bg-info/10 text-info border-info/20",
  },
};

interface KanbanCardProps {
  task: KanbanTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
}

const KanbanCard = memo(function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: KanbanCardProps) {
  const isReading = task.isReadingTask;
  const priorityInfo = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.MEDIUM;

  return (
    <Card
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className="group relative rounded-md border border-border/60 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xs cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex flex-col gap-2.5">
        {/* Card Header: Type / Priority Badge + Hover Actions + Drag Handle */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {isReading ? (
              <Badge
                variant="outline"
                className="text-[10px] font-medium px-2 py-0.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded"
              >
                Okuma Görevi
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 border rounded",
                  priorityInfo.className,
                )}
              >
                {priorityInfo.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isReading && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                  title="Görevi Düzenle"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `"${task.title}" görevini silmek istediğinize emin misiniz?`,
                      )
                    ) {
                      onDelete(task.id);
                    }
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Görevi Sil"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </div>
        </div>

        {/* Card Body: Icon + Title + Description */}
        <div className="flex items-start gap-2.5">
          {isReading ? (
            <BookOpen className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          )}
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="font-sans text-xs sm:text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {task.title}
            </h4>
            {task.description && (
              <p className="font-sans text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Card Footer: Topic Box Title with full available width without clipping */}
        {task.boxTitle && (
          <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-muted-foreground">
            <FolderKanban className="h-3 w-3 text-primary shrink-0" />
            <span
              className="font-sans text-[11px] font-medium text-primary/90 leading-normal break-words"
              title={task.boxTitle}
            >
              {task.boxTitle}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});

/**
 * Renders the Kanban board with task columns, drag-and-drop, and add/edit modals.
 *
 * @param root0 - Component props.
 * @param root0.tasks - All tasks to display on the board.
 * @param root0.onTaskStatusChange - Callback invoked when a task is moved to a new status.
 * @param root0.onAddTask - Callback invoked when a new task is added.
 * @param root0.onEditTask - Async callback invoked when a task is edited.
 * @param root0.onDeleteTask - Async callback invoked when a task is deleted.
 * @param root0.boxes - Topic boxes available for task assignment.
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
  const [showAllDone, setShowAllDone] = useState(false);
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
        {COLUMNS.map((col) => {
          const colTasks = getColumnTasks[col.id];
          const ColIcon = col.icon;
          const isDragActive = activeDragCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                "flex flex-col gap-4 rounded-md border p-4 min-h-[360px] transition-all duration-200",
                isDragActive
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 scale-[1.01]"
                  : "border-border/60 bg-muted/15",
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md border",
                      col.badgeColor,
                    )}
                  >
                    <ColIcon className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
                    {col.label}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-sans text-xs font-semibold px-2 py-0.5 rounded-md border",
                    col.badgeColor,
                  )}
                >
                  {colTasks.length}
                </Badge>
              </div>

              {/* Task Cards List */}
              <div className="flex flex-col gap-3 p-0.5 overflow-visible flex-1">
                {colTasks.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 px-4 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center">
                    <p className="text-xs text-muted-foreground font-medium">
                      Bu aşamada görev bulunmuyor.
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {col.id === "TODO"
                        ? "Yukarıdaki butondan yeni bir araştırma adımı ekleyebilirsiniz."
                        : "Görevleri buraya sürükleyip bırakabilirsiniz."}
                    </p>
                  </div>
                ) : (
                  <>
                    {(col.id === "DONE" ? colTasks.slice(0, 5) : colTasks).map(
                      (task) => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onDragStart={handleDragStart}
                          onDragEnd={() => setActiveDragCol(null)}
                          onEdit={openEditModal}
                          onDelete={onDeleteTask}
                        />
                      ),
                    )}

                    {col.id === "DONE" && colTasks.length > 5 && (
                      <>
                        <div
                          className={cn(
                            "flex flex-col gap-3 transition-all duration-300 ease-in-out overflow-hidden",
                            showAllDone
                              ? "max-h-max opacity-100 mt-1"
                              : "max-h-0 opacity-0 pointer-events-none",
                          )}
                        >
                          {colTasks.slice(5).map((task) => (
                            <KanbanCard
                              key={task.id}
                              task={task}
                              onDragStart={handleDragStart}
                              onDragEnd={() => setActiveDragCol(null)}
                              onEdit={openEditModal}
                              onDelete={onDeleteTask}
                            />
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setShowAllDone(!showAllDone)}
                          className="w-full mt-2 border-dashed border-border/40 text-muted-foreground hover:text-foreground text-xs font-sans rounded-md py-2 flex items-center justify-center gap-2"
                        >
                          {showAllDone ? (
                            <>
                              <span>Daha Az Göster</span>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              <span>
                                Tüm Tamamlananları Gör (+
                                {colTasks.length - 5})
                              </span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
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
