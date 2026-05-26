"use client";

import React, {
  useEffect,
  useState,
  useSyncExternalStore,
  useCallback,
} from "react";
import { type DropResult } from "@hello-pangea/dnd";
import {
  getTasksAction,
  createTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  TaskItem,
} from "./actions";
import { ListTodo, Loader2 } from "lucide-react";
import { TaskForm } from "./_components/task-form";
import { TaskMobileTabs } from "./_components/task-mobile-tabs";
import { TaskKanban } from "./_components/task-kanban";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTasksAction();
      if (res.success && res.tasks) {
        setTasks(res.tasks);
      } else {
        setErrorMessage(res.error || "Görevler yüklenemedi.");
      }
    } catch {
      setErrorMessage("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadTasks();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadTasks]);

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
    } catch {
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
    } catch {
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
    } catch {
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

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 pb-24 md:pb-10 overflow-y-auto">
      <header className="border-b border-border pb-6 mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <ListTodo className="size-6 text-primary" />
            <span>Görevlerim</span>
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

      <TaskForm
        description={description}
        setDescription={setDescription}
        dueDate={dueDate}
        setDueDate={setDueDate}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleCreateTask}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <TaskMobileTabs
            todoTasks={todoTasks}
            doingTasks={doingTasks}
            doneTasks={doneTasks}
            onDelete={handleDeleteTask}
            onUpdateStatus={handleUpdateStatus}
          />
          <TaskKanban
            mounted={mounted}
            todoTasks={todoTasks}
            doingTasks={doingTasks}
            doneTasks={doneTasks}
            onDragEnd={handleDragEnd}
            onDelete={handleDeleteTask}
          />
        </>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20">
      <Loader2 className="size-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground mt-4 font-sans">
        Görev panosu güncelleniyor...
      </p>
    </div>
  );
}
