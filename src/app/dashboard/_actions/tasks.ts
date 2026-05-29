"use server";

import { db } from "@/db";
import { tasks, references } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
 * Helper to synchronize the academic reference status based on task status transition.
 */
export async function syncAcademicStatus(
  taskId: number,
  newStatus: "todo" | "doing" | "done",
): Promise<void> {
  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return;

    let refId = task.referenceId;

    // Fallback: match by description if referenceId is missing
    if (!refId && task.taskDescription.startsWith("Makale Okuma: ")) {
      const titleCandidate = task.taskDescription
        .replace("Makale Okuma: ", "")
        .trim();
      const [matchedRef] = await db
        .select()
        .from(references)
        .where(eq(references.title, titleCandidate))
        .limit(1);

      if (matchedRef) {
        refId = matchedRef.id;
        // Backfill relationship
        await db
          .update(tasks)
          .set({ referenceId: matchedRef.id })
          .where(eq(tasks.id, taskId));
      }
    }

    if (refId) {
      const refStatus =
        newStatus === "done"
          ? "tamamlandı"
          : newStatus === "doing"
            ? "okunuyor"
            : "okunacak";

      await db
        .update(references)
        .set({ status: refStatus })
        .where(eq(references.id, refId));

      console.log(
        `[Academic Sync Trigger] Reference ID ${refId} status updated to "${refStatus}" via Task ID ${taskId}.`,
      );
    }
  } catch (err) {
    console.error("Error in syncAcademicStatus:", err);
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

    // Execute the academic synchronization trigger
    await syncAcademicStatus(taskId, status);

    // Instantly revalidate page cache to reflect UI changes across all views
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/library");

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

    // Instantly revalidate page cache to reflect UI changes
    revalidatePath("/");
    revalidatePath("/dashboard");

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
