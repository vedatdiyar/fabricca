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

interface TasksPageState {
  tasks: TaskItem[];
  loading: boolean;
  submitting: boolean;
  description: string;
  dueDate: string;
  errorMessage: string;
}

export default function TasksPage() {
  const [state, setState] = useState<TasksPageState>({
    tasks: [],
    loading: true,
    submitting: false,
    description: "",
    dueDate: "",
    errorMessage: "",
  });

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const loadTasks = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const res = await getTasksAction();
      if (res.success && res.tasks) {
        setState((prev) => ({ ...prev, tasks: res.tasks || [] }));
      } else {
        setState((prev) => ({
          ...prev,
          errorMessage: res.error || "Görevler yüklenemedi.",
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        errorMessage: "Bağlantı hatası oluştu.",
      }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
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
    if (!state.description.trim()) return;

    try {
      setState((prev) => ({ ...prev, submitting: true, errorMessage: "" }));
      const res = await createTaskAction(state.description, state.dueDate);
      if (res.success) {
        setState((prev) => ({ ...prev, description: "", dueDate: "" }));
        await loadTasks();
      } else {
        setState((prev) => ({
          ...prev,
          errorMessage: res.error || "Görev eklenirken bir hata oluştu.",
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        errorMessage: "Beklenmeyen bir hata oluştu.",
      }));
    } finally {
      setState((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleUpdateStatus = async (
    taskId: number,
    newStatus: "todo" | "doing" | "done",
  ) => {
    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success) {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t,
          ),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          errorMessage: res.error || "Görev durumu güncellenemedi.",
        }));
      }
    } catch {
      setState((prev) => ({ ...prev, errorMessage: "Bağlantı hatası." }));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await deleteTaskAction(taskId);
      if (res.success) {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          errorMessage: res.error || "Görev silinemedi.",
        }));
      }
    } catch {
      setState((prev) => ({ ...prev, errorMessage: "Bağlantı hatası." }));
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId as "todo" | "doing" | "done";

    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t,
      ),
    }));

    const res = await updateTaskStatusAction(taskId, newStatus);
    if (!res.success) {
      await loadTasks();
    }
  };

  const todoTasks = state.tasks.filter((t) => t.status === "todo");
  const doingTasks = state.tasks.filter((t) => t.status === "doing");
  const doneTasks = state.tasks.filter((t) => t.status === "done");

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
        description={state.description}
        setDescription={(desc) =>
          setState((prev) => ({ ...prev, description: desc }))
        }
        dueDate={state.dueDate}
        setDueDate={(date) => setState((prev) => ({ ...prev, dueDate: date }))}
        submitting={state.submitting}
        errorMessage={state.errorMessage}
        onSubmit={handleCreateTask}
      />

      {state.loading ? (
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
