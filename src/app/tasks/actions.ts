"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface TaskItem {
  id: number;
  taskDescription: string;
  status: string | null;
  dueDate: string | null;
  createdAt: Date | null;
}

export interface TasksResult {
  success: boolean;
  tasks?: TaskItem[];
  error?: string;
}

/**
 * Server Action to fetch all tasks ordered by creation date descending
 */
export async function getTasksAction(): Promise<TasksResult> {
  try {
    const allTasks = await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt));

    return {
      success: true,
      tasks: allTasks,
    };
  } catch (error) {
    console.error("getTasksAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Görevler listesi alınırken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to create a new task
 */
export async function createTaskAction(
  description: string,
  dueDateStr?: string,
): Promise<{ success: boolean; taskId?: number; error?: string }> {
  try {
    if (!description || !description.trim()) {
      return { success: false, error: "Görev açıklaması boş olamaz." };
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        taskDescription: description.trim(),
        status: "todo",
        dueDate: dueDateStr && dueDateStr.trim() ? dueDateStr.trim() : null,
      })
      .returning();

    return {
      success: true,
      taskId: newTask.id,
    };
  } catch (error) {
    console.error("createTaskAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Görev oluşturulurken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to update the status of an existing task
 */
export async function updateTaskStatusAction(
  taskId: number,
  status: "todo" | "doing" | "done",
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("updateTaskStatusAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Görev durumu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to delete a task
 */
export async function deleteTaskAction(
  taskId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(tasks).where(eq(tasks.id, taskId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("deleteTaskAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Görev silinirken bir hata oluştu.",
    };
  }
}
