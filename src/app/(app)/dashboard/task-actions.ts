"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/core/db";
import { tasks, boxes } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import {
  AddTaskSchema,
  UpdateTaskSchema,
  TaskStatusSchema,
  type TaskInput,
  type UpdateTaskInput,
  type TaskRow,
} from "./_lib/schemas";

/**
 * Fetches all tasks for the current user, resolving box titles via LEFT JOIN.
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

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        thesisBoxId: tasks.boxId,
        boxTitle: boxes.title,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .leftJoin(boxes, eq(tasks.boxId, boxes.id))
      .where(eq(tasks.userId, session.userId))
      .orderBy(tasks.createdAt);

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
      const linkedBox = await db.query.boxes.findFirst({
        where: eq(boxes.id, valid.thesisBoxId),
      });
      if (!linkedBox) {
        return { success: false, error: "Bağlanacak kutu bulunamadı." };
      }
      const { matrices: matrixTable } = await import("@/core/db/schema");
      const [matrix] = await db
        .select({ userId: matrixTable.userId })
        .from(matrixTable)
        .where(eq(matrixTable.id, linkedBox.matrixId));
      if (!matrix || matrix.userId !== session.userId) {
        return { success: false, error: "Bu kutuya görev bağlama yetkiniz yok." };
      }
    }

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title: valid.title.trim(),
        description: valid.description ?? null,
        status: valid.status ?? "TODO",
        priority: valid.priority ?? "MEDIUM",
        boxId: valid.thesisBoxId ?? null,
      })
      .returning();

    let boxTitle: string | null = null;
    if (inserted.boxId) {
      const [box] = await db
        .select({ title: boxes.title })
        .from(boxes)
        .where(eq(boxes.id, inserted.boxId));
      boxTitle = box?.title ?? null;
    }

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
 * Updates a task's title, priority, or linked box.
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

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Görev bulunamadı." };
    }

    // If re-linking to a different box, verify ownership
    if (valid.thesisBoxId) {
      const linkedBox = await db.query.boxes.findFirst({
        where: eq(boxes.id, valid.thesisBoxId),
      });
      if (!linkedBox) {
        return { success: false, error: "Bağlanacak kutu bulunamadı." };
      }
      const { matrices: matrixTable } = await import("@/core/db/schema");
      const [matrix] = await db
        .select({ userId: matrixTable.userId })
        .from(matrixTable)
        .where(eq(matrixTable.id, linkedBox.matrixId));
      if (!matrix || matrix.userId !== session.userId) {
        return { success: false, error: "Bu kutuya görev bağlama yetkiniz yok." };
      }
    }

    const updateValues: Record<string, unknown> = {};
    if (valid.title !== undefined) updateValues.title = valid.title.trim();
    if (valid.description !== undefined)
      updateValues.description = valid.description;
    if (valid.status !== undefined) updateValues.status = valid.status;
    if (valid.priority !== undefined) updateValues.priority = valid.priority;
    if (valid.thesisBoxId !== undefined) updateValues.boxId = valid.thesisBoxId;

    const [updated] = await db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, taskId))
      .returning();

    let boxTitle: string | null = null;
    if (updated.boxId) {
      const [box] = await db
        .select({ title: boxes.title })
        .from(boxes)
        .where(eq(boxes.id, updated.boxId));
      boxTitle = box?.title ?? null;
    }

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

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Görev bulunamadı." };
    }

    await db
      .update(tasks)
      .set({ status: parsed.data })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard");

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

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
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
