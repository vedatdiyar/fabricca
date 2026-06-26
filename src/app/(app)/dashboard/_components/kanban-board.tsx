"use client";

import { useState } from "react";
import {
  ChevronRight,
  Activity,
  Clock,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Plus,
  X,
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
import type { KanbanTask } from "../types";

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

function KanbanCard({
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
}

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

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [selectedBoxId, setSelectedBoxId] = useState("");

  // Edit Modal State
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<"HIGH" | "MEDIUM" | "LOW">(
    "MEDIUM",
  );
  const [editBoxId, setEditBoxId] = useState("");

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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const matchedBox = boxes.find((b) => String(b.id) === selectedBoxId);

    onAddTask({
      title: taskTitle.trim(),
      description: matchedBox
        ? `"${matchedBox.title}" alanı kapsamında tanımlanmış çalışma görevi.`
        : "Genel tez çalışma adımı.",
      status: "TODO",
      priority,
      thesisBoxId: selectedBoxId ? Number(selectedBoxId) : null,
      boxTitle: matchedBox ? matchedBox.title : "Genel",
    });

    setTaskTitle("");
    setPriority("MEDIUM");
    setSelectedBoxId("");
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const success = await onEditTask(editingTask.id, {
      title: editTitle.trim(),
      priority: editPriority,
      thesisBoxId: editBoxId ? Number(editBoxId) : null,
    });

    if (success) {
      setEditingTask(null);
      setEditTitle("");
      setEditPriority("MEDIUM");
      setEditBoxId("");
    }
  };

  const openEditModal = (task: KanbanTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditBoxId(task.thesisBoxId ? String(task.thesisBoxId) : "");
  };

  const closeEditModal = () => {
    setEditingTask(null);
    setEditTitle("");
    setEditPriority("MEDIUM");
    setEditBoxId("");
  };

  const isEditModalOpen = editingTask !== null;

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
          const colTasks = tasks.filter((t) => t.status === col.id);
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
                                Tüm Tamamlananları Gör (+{colTasks.length - 5})
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

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-card-foreground relative space-y-4">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                Yeni Tez Görevi Ekle
              </h3>
              <p className="font-sans text-xs text-muted-foreground mt-1">
                Kanban tahtasına manuel akademik bir çalışma adımı kaydedin.
              </p>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="taskTitle"
                  className="font-sans text-xs text-muted-foreground"
                >
                  Görev Adı *
                </label>
                <input
                  id="taskTitle"
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Örn: Metodoloji taslağı oluşturma"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="priority"
                    className="font-sans text-xs text-muted-foreground"
                  >
                    Öncelik Derecesi
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="HIGH">Yüksek</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="LOW">Düşük</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="boxSelect"
                    className="font-sans text-xs text-muted-foreground"
                  >
                    İlişkili Konu Kutusu
                  </label>
                  <select
                    id="boxSelect"
                    value={selectedBoxId}
                    onChange={(e) => setSelectedBoxId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Genel / Yok</option>
                    {boxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-md font-sans text-xs px-4 py-2"
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="rounded-md font-sans text-xs px-4 py-2"
                >
                  Kaydet
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6 text-card-foreground relative space-y-4">
            <button
              onClick={closeEditModal}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h3 className="font-serif text-lg font-medium tracking-tight text-foreground">
                Görevi Düzenle
              </h3>
              <p className="font-sans text-xs text-muted-foreground mt-1">
                Seçili görevin başlık, öncelik veya kutu bilgisini güncelleyin.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="editTitle"
                  className="font-sans text-xs text-muted-foreground"
                >
                  Görev Adı *
                </label>
                <input
                  id="editTitle"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Örn: Metodoloji taslağı oluşturma"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="editPriority"
                    className="font-sans text-xs text-muted-foreground"
                  >
                    Öncelik Derecesi
                  </label>
                  <select
                    id="editPriority"
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(
                        e.target.value as "HIGH" | "MEDIUM" | "LOW",
                      )
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="HIGH">Yüksek</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="LOW">Düşük</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="editBoxSelect"
                    className="font-sans text-xs text-muted-foreground"
                  >
                    İlişkili Konu Kutusu
                  </label>
                  <select
                    id="editBoxSelect"
                    value={editBoxId}
                    onChange={(e) => setEditBoxId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Genel / Yok</option>
                    {boxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeEditModal}
                  className="rounded-md font-sans text-xs px-4 py-2"
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="rounded-md font-sans text-xs px-4 py-2"
                >
                  Güncelle
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
