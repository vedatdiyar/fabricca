import { db } from "@/db";
import { tasks, type Task } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { toNumericId } from "./mutation-types";

/**
 * Captures the current task fields for the undo preview.
 *
 * @param args - The proposed mutation arguments.
 * @returns The existing task field values, or undefined.
 */
async function getTaskPreviousState(
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const taskId = toNumericId(args.taskId);
  if (!taskId) return undefined;
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return undefined;
  return {
    title: task.title,
    status: task.status,
  };
}

/**
 * Creates a new task on the Kanban board.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The creation result.
 */
async function executeCreateTask(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const title = args.title as string;
  const description = (args.description as string | undefined) ?? null;
  const priority = (args.priority as Task["priority"]) ?? "MEDIUM";
  const boxId = (args.boxId as number | undefined) ?? null;

  const [newTask] = await db
    .insert(tasks)
    .values({
      userId,
      boxId,
      title,
      description,
      priority,
      status: "TODO",
    })
    .returning();

  return {
    success: true,
    message: `"${title}" görevi Kanban panosuna eklendi.`,
    data: newTask,
  };
}

/**
 * Updates the status of a task owned by the user.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The update result with the captured previous state.
 */
async function executeUpdateTaskStatus(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const taskId = args.taskId as number;
  const existingTask = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });
  if (!existingTask) {
    return { success: false, message: "Görev bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    status: existingTask.status,
  };

  const status = args.status as Task["status"];

  await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  return {
    success: true,
    message: "Görev durumu güncellendi.",
    previousState,
  };
}

/** Mutation handlers for the task tools. */
export const taskMutations: Record<string, MutationToolHandler> = {
  createTask: {
    execute: executeCreateTask,
    getPreviousState: async () => undefined,
  },
  updateTaskStatus: {
    execute: executeUpdateTaskStatus,
    getPreviousState: getTaskPreviousState,
  },
};
