"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { KanbanTask } from "../_lib/types";
import type { TaskRow, TaskInput } from "../_lib/schemas";
import {
  addTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  updateTaskAction,
  syncTasksAction,
  getTasksAction,
} from "@/app/(app)/dashboard/task-actions";

/**
 * Maps a database task row into a Kanban task model.
 *
 * @param task - The database task row to convert.
 * @returns The corresponding Kanban task.
 */
export function mapTaskRow(task: TaskRow): KanbanTask {
  return {
    id: String(task.id),
    title: task.title,
    description: task.description ?? undefined,
    taskType: task.taskType,
    status: task.status,
    priority: task.priority,
    thesisBoxId: task.thesisBoxId,
    boxTitle: task.boxTitle ?? undefined,
    sourceId: task.sourceId,
    targetUrl: task.targetUrl,
    isAutomated: task.isAutomated,
    metadata: task.metadata,
  };
}

/**
 * Manages user & automated Kanban tasks with ADHD pacing, cross-pillar balancing, and live synchronization.
 *
 * @param initialTasks - Tasks loaded from the server.
 * @returns Tasks and handlers for task mutations, live sync, and strategist audits.
 */
export function useDashboardTasks(initialTasks: TaskRow[]) {
  const [tasks, setTasks] = useState<KanbanTask[]>(() =>
    initialTasks.map(mapTaskRow),
  );

  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  if (prevInitialTasks !== initialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks.map(mapTaskRow));
  }

  const refreshTasksFromServer = useCallback(async () => {
    const res = await getTasksAction();
    if (res.success && res.data) {
      setTasks(res.data.map(mapTaskRow));
    }
  }, []);

  const handleAddTask = useCallback(async (taskInput: TaskInput) => {
    const res = await addTaskAction(taskInput);

    if (!res.success || !res.data) {
      toast.error(res.error ?? "Görev eklenirken bir hata oluştu.");
      return false;
    }

    const newTask = mapTaskRow(res.data);
    setTasks((prev) => [...prev, newTask]);
    toast.success("Yeni akademik görev panoya eklendi.");
    return true;
  }, []);

  const handleEditTask = useCallback(
    async (
      taskId: string,
      input: {
        title: string;
        priority: "HIGH" | "MEDIUM" | "LOW";
        taskType?: KanbanTask["taskType"];
        thesisBoxId?: number | null;
      },
    ) => {
      const res = await updateTaskAction(Number(taskId), input);
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Görev güncellenirken bir hata oluştu.");
        return false;
      }

      const updatedData = res.data;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? mapTaskRow(updatedData) : t)),
      );

      toast.success("Görev başarıyla güncellendi.");
      return true;
    },
    [],
  );

  const handleTaskStatusChange = useCallback(
    async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
      let previousTask: KanbanTask | undefined;

      setTasks((prev) => {
        previousTask = prev.find((t) => t.id === taskId);
        if (!previousTask) return prev;
        return prev.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task,
        );
      });

      if (!previousTask) return;

      try {
        const res = await updateTaskStatusAction(Number(taskId), newStatus);
        if (!res.success) {
          throw new Error(res.error);
        }

        // When a task is marked DONE, sync in the background to replenish candidate tasks if needed
        if (newStatus === "DONE") {
          syncTasksAction().then(() => refreshTasksFromServer());
        }
      } catch (err) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId && previousTask ? previousTask : task,
          ),
        );
        toast.error(
          `Görev durumu güncellenemedi: ${
            err instanceof Error ? err.message : "Bağlantı hatası."
          }`,
        );
      }
    },
    [refreshTasksFromServer],
  );

  const handleDeleteTask = useCallback(async (taskId: string) => {
    let deletedTask: KanbanTask | null = null;

    setTasks((prev) => {
      const found = prev.find((t) => t.id === taskId);
      if (!found) return prev;
      deletedTask = found;
      return prev.filter((t) => t.id !== taskId);
    });

    if (!deletedTask) return;

    const taskToRestore: KanbanTask = deletedTask;

    try {
      const res = await deleteTaskAction(Number(taskId));
      if (!res.success) {
        throw new Error(res.error);
      }
      toast.success("Görev panodan silindi.");
    } catch (err) {
      setTasks((prev) =>
        prev.some((t) => t.id === taskId)
          ? prev
          : [...prev, taskToRestore].sort(
              (a, b) => Number(a.id) - Number(b.id),
            ),
      );
      toast.error(
        `Görev silinemedi: ${
          err instanceof Error ? err.message : "Bağlantı hatası."
        }`,
      );
    }
  }, []);

  const handleSyncTasks = useCallback(async () => {
    try {
      const res = await syncTasksAction();
      if (!res.success) {
        throw new Error(res.error);
      }
      await refreshTasksFromServer();
    } catch (err) {
      toast.error(
        `Senkronizasyon hatası: ${
          err instanceof Error ? err.message : "Bilinmeyen hata."
        }`,
      );
    }
  }, [refreshTasksFromServer]);

  return {
    tasks,
    handleAddTask,
    handleEditTask,
    handleTaskStatusChange,
    handleDeleteTask,
    handleSyncTasks,
  };
}
