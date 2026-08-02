"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { tasks, boxes, sources } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { deleteLibraryResourceAction as deleteLibraryResource } from "@/app/(app)/library/actions";
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
    return { success: false, error: "Failed to update task." };
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

    return { success: true };
  } catch (err) {
    log.error("task_delete_failed", {
      service: "dashboard",
      error: err,
    });
    return { success: false, error: "Failed to delete task." };
  }
}

/**
 * Permanently deletes a library resource (article) from the dashboard topic boxes,
 * delegating to the library server action and revalidating both routes on success.
 *
 * @param resourceId - The resource ID to delete
 * @returns Success or error result
 */
export async function deleteLibraryResourceAction(resourceId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const res = await deleteLibraryResource(resourceId);
  if (res.success) {
    revalidatePath("/dashboard");
    revalidatePath("/library");
  }
  return res;
}

/**
 * Toggles the isRead flag on a single library resource for the Dashboard reading tasks.
 *
 * @param resourceId - The resource ID to update
 * @param isRead - New boolean read state
 * @returns Success or error result
 */
export async function toggleResourceReadStatusAction(
  resourceId: number,
  isRead: boolean,
): Promise<{ success: boolean; error?: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    await db.update(sources).set({ isRead }).where(eq(sources.id, resourceId));

    return { success: true };
  } catch (err) {
    log.error("toggle_read_status_failed", {
      service: "dashboard",
      error: err,
    });
    return {
      success: false,
      error: "Failed to update read status.",
    };
  }
}
