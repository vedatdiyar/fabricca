"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  getTasksAction,
  createTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  TaskItem,
} from "./actions";
import {
  ListTodo,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Loader2,
  CheckCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { tr } from "date-fns/locale";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [activeTab, setActiveTab] = useState<"todo" | "doing" | "done">("todo");
  const [errorMessage, setErrorMessage] = useState("");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await getTasksAction();
      if (res.success && res.tasks) {
        setTasks(res.tasks);
      } else {
        setErrorMessage(res.error || "Görevler yüklenemedi.");
      }
    } catch (err: any) {
      setErrorMessage("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage("");
      const res = await createTaskAction(description, dueDate);
      if (res.success) {
        setDescription("");
        setDueDate("");
        await loadTasks();
      } else {
        setErrorMessage(res.error || "Görev eklenirken bir hata oluştu.");
      }
    } catch (err) {
      setErrorMessage("Beklenmeyen bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    taskId: number,
    newStatus: "todo" | "doing" | "done",
  ) => {
    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        );
      } else {
        setErrorMessage(res.error || "Görev durumu güncellenemedi.");
      }
    } catch (err) {
      setErrorMessage("Bağlantı hatası.");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await deleteTaskAction(taskId);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        setErrorMessage(res.error || "Görev silinemedi.");
      }
    } catch (err) {
      setErrorMessage("Bağlantı hatası.");
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId as "todo" | "doing" | "done";

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    const res = await updateTaskStatusAction(taskId, newStatus);
    if (!res.success) {
      await loadTasks();
    }
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doingTasks = tasks.filter((t) => t.status === "doing");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const renderMobileCard = (task: TaskItem) => {
    return (
      <div
        key={task.id}
        className="bg-card border border-border p-4 rounded shadow-sm hover:border-primary transition duration-150 flex flex-col justify-between space-y-3"
      >
        <div className="space-y-2">
          <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
            {task.taskDescription}
          </p>
          {task.dueDate && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded w-fit border border-border">
              <Calendar className="size-3 text-primary" />
              <span>
                {format(
                  parse(task.dueDate, "yyyy-MM-dd", new Date()),
                  "dd/MM/yyyy",
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          <button
            onClick={() => handleDeleteTask(task.id)}
            className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150"
            title="Görevi Sil"
          >
            <Trash2 className="size-4" />
          </button>

          <div className="flex items-center gap-1">
            {task.status === "todo" && (
              <button
                onClick={() => handleUpdateStatus(task.id, "doing")}
                className="flex items-center gap-1 text-[10px] font-sans font-medium text-primary hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background"
              >
                <span>Başla</span>
                <ArrowRight className="size-3" />
              </button>
            )}

            {task.status === "doing" && (
              <>
                <button
                  onClick={() => handleUpdateStatus(task.id, "todo")}
                  className="text-muted-foreground hover:text-foreground p-1 rounded transition duration-150 border border-border bg-background"
                  title="Geri Al"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => handleUpdateStatus(task.id, "done")}
                  className="flex items-center gap-1 text-[10px] font-sans font-medium text-primary hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background"
                >
                  <span>Tamamla</span>
                  <CheckCircle className="size-3" />
                </button>
              </>
            )}

            {task.status === "done" && (
              <button
                onClick={() => handleUpdateStatus(task.id, "doing")}
                className="flex items-center gap-1 text-[10px] font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 rounded transition duration-150 border border-border bg-background"
              >
                <ArrowLeft className="size-3" />
                <span>Geri Al</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDraggableCard = (task: TaskItem) => {
    return (
      <div className="bg-card p-4 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
            {task.taskDescription}
          </p>
          {task.dueDate && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded w-fit border border-border">
              <Calendar className="size-3 text-primary" />
              <span>
                {format(
                  parse(task.dueDate, "yyyy-MM-dd", new Date()),
                  "dd/MM/yyyy",
                )}
              </span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border mt-2 flex justify-end">
          <button
            onClick={() => handleDeleteTask(task.id)}
            className="text-muted-foreground hover:text-destructive p-1 rounded transition duration-150"
            title="Görevi Sil"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderColumn = (
    droppableId: "todo" | "doing" | "done",
    title: string,
    columnTasks: TaskItem[],
    indicatorClass: string,
    pulse?: boolean,
  ) => {
    const emptyLabels: Record<string, string> = {
      todo: "Görev bulunmuyor",
      doing: "Çalışılan görev yok",
      done: "Tamamlanan görev yok",
    };

    return (
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px] transition duration-150 ${
              snapshot.isDraggingOver ? "bg-accent" : ""
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${indicatorClass} ${pulse ? "animate-pulse" : ""}`}
                />
                <span>{title}</span>
              </h3>
              <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {columnTasks.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                  {emptyLabels[droppableId]}
                </div>
              ) : (
                columnTasks.map((task, index) => (
                  <Draggable
                    key={task.id}
                    draggableId={String(task.id)}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`rounded transition duration-150 border cursor-grab ${
                          snapshot.isDragging
                            ? "border-primary shadow-xl cursor-grabbing"
                            : "border-border"
                        }`}
                      >
                        {renderDraggableCard(task)}
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-20 md:pb-10 overflow-y-auto">
      <header className="border-b border-border pb-6 mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <ListTodo className="size-6 text-primary" />
            <span>Görevlerim (Kanban)</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Haftalık araştırma hedeflerinizi organize edin ve durumlarını takip
            edin
          </p>
        </div>
        <span className="text-xs font-sans text-muted-foreground bg-card border border-border px-3 py-1 rounded w-fit">
          Siber-Akademik Planlayıcı
        </span>
      </header>

      <form
        onSubmit={handleCreateTask}
        className="bg-card border border-border p-6 rounded-lg mb-8 space-y-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Plus className="size-4" />
          <span>Yeni Görev Tanımla</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Örn: Kürt Solu literatürünü tamamla ve özet çıkar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans h-10"
            />
          </div>
          <div className="md:col-span-1">
            <Popover>
              <PopoverTrigger className="w-full bg-background border border-border px-3 py-2 rounded text-sm text-foreground h-10 flex items-center gap-2 cursor-pointer focus:outline-none focus:border-primary data-[open]:border-primary">
                <Calendar className="size-4 text-primary" />
                <span>
                  {dueDate
                    ? format(
                        parse(dueDate, "yyyy-MM-dd", new Date()),
                        "dd/MM/yyyy",
                      )
                    : "gg/aa/yyyy"}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={
                    dueDate
                      ? parse(dueDate, "yyyy-MM-dd", new Date())
                      : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      setDueDate(format(date, "yyyy-MM-dd"));
                    }
                  }}
                  locale={tr}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground text-sm font-semibold rounded h-10 hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Görev Ekle</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs text-destructive bg-card border border-destructive p-3 rounded mt-2">
            {errorMessage}
          </p>
        )}
      </form>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground mt-4 font-sans">
            Görev panosu güncelleniyor...
          </p>
        </div>
      ) : (
        <>
          <div className="flex md:hidden border border-border bg-card p-1 rounded mb-6">
            <button
              onClick={() => setActiveTab("todo")}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded transition duration-150 ${
                activeTab === "todo"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Yapılacak ({todoTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("doing")}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded transition duration-150 ${
                activeTab === "doing"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Çalışılıyor ({doingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("done")}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded transition duration-150 ${
                activeTab === "done"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Tamamlandı ({doneTasks.length})
            </button>
          </div>

          <div className="block md:hidden">
            {activeTab === "todo" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span>Yapılacak Hedefler ({todoTasks.length})</span>
                </h3>
                {todoTasks.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
                    Bu sütunda henüz görev bulunmamaktadır.
                  </div>
                ) : (
                  todoTasks.map(renderMobileCard)
                )}
              </div>
            )}

            {activeTab === "doing" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <span>Üzerinde Çalışılanlar ({doingTasks.length})</span>
                </h3>
                {doingTasks.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
                    Aktif olarak üzerinde çalışılan bir hedef bulunmuyor.
                  </div>
                ) : (
                  doingTasks.map(renderMobileCard)
                )}
              </div>
            )}

            {activeTab === "done" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-chart-5" />
                  <span>Tamamlanan Görevler ({doneTasks.length})</span>
                </h3>
                {doneTasks.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg p-8 text-center text-xs text-muted-foreground bg-card">
                    Tamamlanmış bir görev henüz yok.
                  </div>
                ) : (
                  doneTasks.map(renderMobileCard)
                )}
              </div>
            )}
          </div>

          {mounted ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="hidden md:grid grid-cols-3 gap-6 flex-1">
                {renderColumn(
                  "todo",
                  "Yapılacaklar",
                  todoTasks,
                  "bg-destructive",
                )}
                {renderColumn(
                  "doing",
                  "Çalışılanlar",
                  doingTasks,
                  "bg-primary",
                  true,
                )}
                {renderColumn("done", "Tamamlananlar", doneTasks, "bg-chart-5")}
              </div>
            </DragDropContext>
          ) : (
            <div className="hidden md:grid grid-cols-3 gap-6 flex-1">
              <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-destructive" />
                    <span>Yapılacaklar</span>
                  </h3>
                  <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                    {todoTasks.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {todoTasks.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                      Görev bulunmuyor
                    </div>
                  ) : (
                    todoTasks.map((task) => (
                      <div
                        key={task.id}
                        className="border border-border rounded"
                      >
                        {renderDraggableCard(task)}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    <span>Çalışılanlar</span>
                  </h3>
                  <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                    {doingTasks.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {doingTasks.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                      Çalışılan görev yok
                    </div>
                  ) : (
                    doingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="border border-border rounded"
                      >
                        {renderDraggableCard(task)}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-border bg-card rounded-lg p-4 flex flex-col space-y-4 h-full min-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-chart-5" />
                    <span>Tamamlananlar</span>
                  </h3>
                  <span className="text-[10px] font-sans text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                    {doneTasks.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {doneTasks.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg py-12 text-center text-xs text-muted-foreground">
                      Tamamlanan görev yok
                    </div>
                  ) : (
                    doneTasks.map((task) => (
                      <div
                        key={task.id}
                        className="border border-border rounded"
                      >
                        {renderDraggableCard(task)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
