"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { KanbanTask } from "../_types";
import type { TaskRow } from "../_lib/schemas";
import {
  addTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/(app)/dashboard/actions";

function mapTaskRow(task: TaskRow): KanbanTask {
  return {
    id: String(task.id),
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    thesisBoxId: task.thesisBoxId,
    boxTitle: task.boxTitle ?? undefined,
  };
}

/**
 * Manages user-created Kanban task CRUD operations (add, edit, delete, status change).
 * Optimistic updates use a functional updater with closure-captured previous value
 * for race-safe rollback on error.
 */
export function useDashboardTasks(initialTasks: TaskRow[]) {
  const [userTasks, setUserTasks] = useState<KanbanTask[]>(() =>
    initialTasks.map(mapTaskRow),
  );

  const handleAddTask = useCallback(
    async (taskInput: Omit<KanbanTask, "id">) => {
      const res = await addTaskAction({
        title: taskInput.title,
        description: taskInput.description,
        status: taskInput.status,
        priority: taskInput.priority,
        thesisBoxId: taskInput.thesisBoxId ?? null,
      });

      if (!res.success || !res.data) {
        toast.error(res.error ?? "Failed to add task.");
        return;
      }

      const newTask: KanbanTask = {
        id: String(res.data.id),
        title: res.data.title,
        description: res.data.description ?? undefined,
        status: res.data.status,
        priority: res.data.priority,
        thesisBoxId: res.data.thesisBoxId,
        boxTitle: res.data.boxTitle ?? undefined,
      };

      setUserTasks((prev) => [...prev, newTask]);
      toast.success("New thesis task added and saved.");
    },
    [],
  );

  const handleEditTask = useCallback(
    async (
      taskId: string,
      input: {
        title: string;
        priority: "HIGH" | "MEDIUM" | "LOW";
        thesisBoxId?: number | null;
      },
    ) => {
      const res = await updateTaskAction(Number(taskId), input);
      if (!res.success || !res.data) {
        toast.error(res.error ?? "Failed to update task.");
        return false;
      }

      const updatedData = res.data;
      setUserTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                title: updatedData.title,
                priority: updatedData.priority,
                thesisBoxId: updatedData.thesisBoxId,
                boxTitle: updatedData.boxTitle ?? undefined,
              }
            : t,
        ),
      );

      toast.success("Task updated successfully.");
      return true;
    },
    [],
  );

  const handleUserTaskStatusChange = useCallback(
    async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
      let previousTask: KanbanTask | undefined;

      setUserTasks((prev) => {
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
      } catch (err) {
        // Race-safe rollback: restore the specific task using the closure-captured
        // previousTask value, preserving any concurrent updates to other tasks.
        setUserTasks((prev) =>
          prev.map((task) =>
            task.id === taskId && previousTask ? previousTask : task,
          ),
        );
        toast.error(
          `Failed to update task status: ${
            err instanceof Error ? err.message : "Connection error."
          }`,
        );
      }
    },
    [],
  );

  const handleDeleteTask = useCallback(async (taskId: string) => {
    let deletedTask: KanbanTask | null = null;

    setUserTasks((prev) => {
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
      toast.success("Task deleted successfully.");
    } catch (err) {
      // Restore the deleted task only if it is still absent (concurrent safety).
      setUserTasks((prev) =>
        prev.some((t) => t.id === taskId)
          ? prev
          : [...prev, taskToRestore].sort(
              (a, b) => Number(a.id) - Number(b.id),
            ),
      );
      toast.error(
        `Failed to delete task: ${
          err instanceof Error ? err.message : "Connection error."
        }`,
      );
    }
  }, []);

  return {
    userTasks,
    handleAddTask,
    handleEditTask,
    handleUserTaskStatusChange,
    handleDeleteTask,
  };
}
