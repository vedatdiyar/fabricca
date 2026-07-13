"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { tasks, thesisBoxes } from "@/db/schema";
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
        thesisBoxId: tasks.thesisBoxId,
        boxTitle: thesisBoxes.title,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .leftJoin(thesisBoxes, eq(tasks.thesisBoxId, thesisBoxes.id))
      .where(eq(tasks.userId, session.userId))
      .orderBy(tasks.createdAt);

    log.info("tasks_fetched", {
      service: "dashboard",
      data: { count: rows.length },
    });

    return { success: true, data: rows };
  } catch (err) {
    log.error("tasks_fetch_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Failed to load tasks." };
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
        error: firstIssue?.message ?? "Invalid input.",
      };
    }

    const valid = parsed.data;

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title: valid.title.trim(),
        description: valid.description ?? null,
        status: valid.status ?? "TODO",
        priority: valid.priority ?? "MEDIUM",
        thesisBoxId: valid.thesisBoxId ?? null,
      })
      .returning();

    let boxTitle: string | null = null;
    if (inserted.thesisBoxId) {
      const [box] = await db
        .select({ title: thesisBoxes.title })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.id, inserted.thesisBoxId));
      boxTitle = box?.title ?? null;
    }

    revalidatePath("/dashboard");

    log.info("task_created", {
      service: "dashboard",
      data: { taskId: inserted.id },
    });

    return {
      success: true,
      data: {
        ...inserted,
        boxTitle,
      },
    };
  } catch (err) {
    log.error("task_create_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Failed to create task." };
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
        error: firstIssue?.message ?? "Invalid input.",
      };
    }

    const valid = parsed.data;

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Task not found." };
    }

    const updateValues: Record<string, unknown> = {};
    if (valid.title !== undefined) updateValues.title = valid.title.trim();
    if (valid.description !== undefined)
      updateValues.description = valid.description;
    if (valid.status !== undefined) updateValues.status = valid.status;
    if (valid.priority !== undefined) updateValues.priority = valid.priority;
    if (valid.thesisBoxId !== undefined)
      updateValues.thesisBoxId = valid.thesisBoxId;

    const [updated] = await db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, taskId))
      .returning();

    let boxTitle: string | null = null;
    if (updated.thesisBoxId) {
      const [box] = await db
        .select({ title: thesisBoxes.title })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.id, updated.thesisBoxId));
      boxTitle = box?.title ?? null;
    }

    revalidatePath("/dashboard");

    log.info("task_updated", {
      service: "dashboard",
      data: { taskId: updated.id },
    });

    return { success: true, data: { ...updated, boxTitle } };
  } catch (err) {
    log.error("task_update_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Failed to update task." };
  }
}

/**
 * Updates a task's status (TODO / IN_PROGRESS / DONE).
 * Used by the Kanban drag-and-drop flow.
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
      return { success: false, error: "Invalid task status." };
    }

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Task not found." };
    }

    await db
      .update(tasks)
      .set({ status: parsed.data })
      .where(eq(tasks.id, taskId));

    revalidatePath("/dashboard");

    log.info("task_status_updated", {
      service: "dashboard",
      data: { taskId, newStatus },
    });

    return { success: true };
  } catch (err) {
    log.error("task_status_update_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Failed to update task status.",
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
      return { success: false, error: "Task not found." };
    }

    await db.delete(tasks).where(eq(tasks.id, taskId));

    revalidatePath("/dashboard");

    log.info("task_deleted", {
      service: "dashboard",
      data: { taskId },
    });

    return { success: true };
  } catch (err) {
    log.error("task_delete_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Failed to delete task." };
  }
}
