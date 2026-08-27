"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/core/db";
import { tasks, sources } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import {
  AddTaskSchema,
  UpdateTaskSchema,
  TaskStatusSchema,
  type TaskInput,
  type UpdateTaskInput,
  type TaskRow,
} from "./_lib/schemas";
import { syncAcademicTasks } from "./_services/task-sync-service";
import {
  fetchUserTaskRows,
  fetchUserTaskById,
  verifyBoxOwnership,
  getBoxTitleById,
} from "./_lib/task-db-queries";
import {
  syncTasksAction,
  runStrategistAuditAction,
} from "./_lib/task-sync-actions";

export { syncTasksAction, runStrategistAuditAction };

/**
 * Fetches all tasks for the current user, syncing automated tasks in the background.
 *
 * @returns The task list or an error message
 */
export async function getTasksAction(): Promise<{
  success: boolean;
  data?: TaskRow[];
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    let rows = await fetchUserTaskRows(session.userId);

    // If user has no tasks at all, trigger initial sync once
    if (rows.length === 0) {
      await syncAcademicTasks(session.userId);
      rows = await fetchUserTaskRows(session.userId);
    }

    return { success: true, data: rows };
  } catch (err) {
    log.error("tasks_fetch_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Görevler yüklenirken bir hata oluştu." };
  }
}

/**
 * Creates a new task.
 *
 * @param input - The task creation payload
 * @returns The created task row or an error message
 */
export async function addTaskAction(input: TaskInput): Promise<{
  success: boolean;
  data?: TaskRow;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const parsed = AddTaskSchema.safeParse(input);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: firstIssue?.message ?? "Geçersiz giriş.",
      };
    }

    const valid = parsed.data;

    // If a box is linked, verify it belongs to the authenticated user's matrix
    if (valid.thesisBoxId) {
      const ownership = await verifyBoxOwnership(
        session.userId,
        valid.thesisBoxId,
      );
      if (!ownership.success) {
        return { success: false, error: ownership.error };
      }
    }

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title: valid.title.trim(),
        description: valid.description ?? null,
        taskType: valid.taskType ?? "MANUAL",
        status: valid.status ?? "TODO",
        priority: valid.priority ?? "MEDIUM",
        boxId: valid.thesisBoxId ?? null,
        sourceId: valid.sourceId ?? null,
        targetUrl: valid.targetUrl ?? null,
        isAutomated: valid.isAutomated ?? false,
        metadata: valid.metadata ?? null,
      })
      .returning();

    const boxTitle = inserted.boxId
      ? await getBoxTitleById(inserted.boxId)
      : null;

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        ...inserted,
        thesisBoxId: inserted.boxId,
        boxTitle,
      },
    };
  } catch (err) {
    log.error("task_create_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Görev oluşturulurken bir hata oluştu." };
  }
}

/**
 * Updates a task's title, priority, linked box, or task type.
 *
 * @param taskId - The task ID to update
 * @param input - The fields to update
 * @returns The updated task row or an error message
 */
export async function updateTaskAction(
  taskId: number,
  input: UpdateTaskInput,
): Promise<{
  success: boolean;
  data?: TaskRow;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const parsed = UpdateTaskSchema.safeParse(input);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: firstIssue?.message ?? "Geçersiz giriş.",
      };
    }

    const valid = parsed.data;

    const existing = await fetchUserTaskById(taskId, session.userId);
    if (!existing) {
      return { success: false, error: "Görev bulunamadı." };
    }

    // If re-linking to a different box, verify ownership
    if (valid.thesisBoxId) {
      const ownership = await verifyBoxOwnership(
        session.userId,
        valid.thesisBoxId,
      );
      if (!ownership.success) {
        return { success: false, error: ownership.error };
      }
    }

    const updateValues: Record<string, unknown> = {};
    if (valid.title !== undefined) updateValues.title = valid.title.trim();
    if (valid.description !== undefined)
      updateValues.description = valid.description;
    if (valid.taskType !== undefined) updateValues.taskType = valid.taskType;
    if (valid.status !== undefined) updateValues.status = valid.status;
    if (valid.priority !== undefined) updateValues.priority = valid.priority;
    if (valid.thesisBoxId !== undefined) updateValues.boxId = valid.thesisBoxId;
    if (valid.sourceId !== undefined) updateValues.sourceId = valid.sourceId;
    if (valid.targetUrl !== undefined) updateValues.targetUrl = valid.targetUrl;

    const [updated] = await db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, taskId))
      .returning();

    const boxTitle = updated.boxId
      ? await getBoxTitleById(updated.boxId)
      : null;

    revalidatePath("/dashboard");

    return {
      success: true,
      data: { ...updated, thesisBoxId: updated.boxId, boxTitle },
    };
  } catch (err) {
    log.error("task_update_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Görev güncellenirken bir hata oluştu." };
  }
}

/**
 * Updates a task's status (TODO / IN_PROGRESS / DONE) for the Kanban drag-and-drop flow.
 *
 * @param taskId - The task ID to update
 * @param newStatus - The new status value
 * @returns Success or error response
 */
export async function updateTaskStatusAction(
  taskId: number,
  newStatus: "TODO" | "IN_PROGRESS" | "DONE",
): Promise<{
  success: boolean;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const parsed = TaskStatusSchema.safeParse(newStatus);
    if (!parsed.success) {
      return { success: false, error: "Geçersiz görev durumu." };
    }

    const existing = await fetchUserTaskById(taskId, session.userId);
    if (!existing) {
      return { success: false, error: "Görev bulunamadı." };
    }

    await db
      .update(tasks)
      .set({ status: parsed.data, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Sync linked source read status if this is a reading task
    if (existing.taskType === "READING" && existing.sourceId) {
      if (parsed.data === "DONE") {
        await db
          .update(sources)
          .set({ isRead: true, updatedAt: new Date() })
          .where(eq(sources.id, existing.sourceId));
      } else if (existing.status === "DONE") {
        await db
          .update(sources)
          .set({ isRead: false, updatedAt: new Date() })
          .where(eq(sources.id, existing.sourceId));
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/library");

    return { success: true };
  } catch (err) {
    log.error("task_status_update_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Görev durumu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Deletes a task.
 *
 * @param taskId - The task ID to delete
 * @returns Success or error response
 */
export async function deleteTaskAction(taskId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const existing = await fetchUserTaskById(taskId, session.userId);
    if (!existing) {
      return { success: false, error: "Görev bulunamadı." };
    }

    await db.delete(tasks).where(eq(tasks.id, taskId));

    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    log.error("task_delete_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Görev silinirken bir hata oluştu." };
  }
}
