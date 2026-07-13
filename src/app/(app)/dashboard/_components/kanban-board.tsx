"use client";

import { useState, useMemo, memo } from "react";
import {
  ChevronRight,
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThesisBox } from "@/db/schema";
import type { KanbanTask } from "../_types";
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
  boxes: ThesisBox[];
}

const COLUMNS = [
  { id: "TODO", label: "Yapılacaklar", icon: Clock, iconColor: "text-info" },
  {
    id: "IN_PROGRESS",
    label: "Yapılıyor",
    icon: Activity,
    iconColor: "text-warning",
  },
  { id: "DONE", label: "Bitti", icon: CheckCircle2, iconColor: "text-success" },
] as const;

const priorityStyles: Record<string, { badge: string; text: string }> = {
  HIGH: {
    badge: "bg-destructive/15 border-destructive/20 text-destructive",
    text: "Yüksek",
  },
  MEDIUM: {
    badge: "bg-warning/15 border-warning/20 text-warning",
    text: "Orta",
  },
  LOW: {
    badge: "bg-success/15 border-success/20 text-success",
    text: "Düşük",
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
  const priority = priorityStyles[task.priority] || {
    badge: "bg-secondary text-secondary-foreground",
    text: task.priority,
  };
  const isReading = task.isReadingTask;

  return (
    <Card
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className="group rounded-md border border-border bg-card text-card-foreground p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:relative hover:z-50 cursor-grab active:cursor-grabbing"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
              priority.badge,
            )}
          >
            {priority.text}
          </span>
          {!isReading && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Düzenle"
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
                title="Sil"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2.5">
          {isReading ? (
            <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
          )}
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="font-sans text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {task.title}
            </h4>
            {task.description && (
              <p className="font-sans text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
            {task.boxTitle && (
              <div className="pt-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium px-2 py-0 border-primary/20 bg-primary/5 text-primary rounded-md"
                >
                  {task.boxTitle}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1 border-t border-border/40">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Card>
  );
});

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
      <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
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
          className="flex items-center gap-2 text-sm font-sans shrink-0 rounded-md"
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
                "flex flex-col gap-4 rounded-md border p-4 min-h-[500px] transition-all duration-200",
                isDragActive
                  ? "border-primary/60 bg-secondary/35 scale-[1.01]"
                  : "border-border/40 bg-background/40",
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <ColIcon className={`h-4 w-4 shrink-0 ${col.iconColor}`} />
                  <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                    {col.label}
                  </h3>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-secondary text-secondary-foreground font-sans text-xs px-2 py-0.5 rounded-md"
                >
                  {colTasks.length}
                </Badge>
              </div>

              {/* Task Cards List */}
              <div className="flex flex-col gap-3 p-1 -m-1 overflow-visible">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 rounded-md border border-dashed border-border/40 bg-secondary/10 text-center">
                    <p className="text-xs text-muted-foreground">
                      Bu sütunda görev bulunmuyor.
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
                              ? "max-h-[2000px] opacity-100 mt-1"
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
                          className="w-full mt-2 border-dashed border-border/40 text-muted-foreground hover:text-foreground text-xs font-sans rounded-md py-2 flex items-center justify-center gap-1.5"
                        >
                          {showAllDone ? (
                            <>
                              <span>Daha Az Göster</span>
                              <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              <span>
                                Tüm Tamamlananları Gör (+
                                {colTasks.length - 5})
                              </span>
                              <ChevronDown className="h-3 w-3" />
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
