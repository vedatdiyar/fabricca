import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { tasks, boxes, matrices } from "@/core/db/schema";
import type { TaskRow } from "./schemas";

/**
 * Fetches all tasks belonging to a user with left-joined thesis box titles.
 *
 * @param userId - ID of the authenticated user.
 * @returns Array of task rows.
 */
export async function fetchUserTaskRows(userId: number): Promise<TaskRow[]> {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      taskType: tasks.taskType,
      status: tasks.status,
      priority: tasks.priority,
      thesisBoxId: tasks.boxId,
      sourceId: tasks.sourceId,
      targetUrl: tasks.targetUrl,
      isAutomated: tasks.isAutomated,
      metadata: tasks.metadata,
      boxTitle: boxes.title,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(boxes, eq(tasks.boxId, boxes.id))
    .where(eq(tasks.userId, userId))
    .orderBy(tasks.createdAt);
}

/**
 * Verifies that a thesis box exists and belongs to a matrix owned by the user.
 *
 * @param userId - ID of the authenticated user.
 * @param boxId - Target thesis box ID.
 * @returns Verification result with error message if unauthorized or not found.
 */
export async function verifyBoxOwnership(
  userId: number,
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  const linkedBox = await db.query.boxes.findFirst({
    where: eq(boxes.id, boxId),
  });

  if (!linkedBox) {
    return { success: false, error: "Bağlanacak kutu bulunamadı." };
  }

  const [matrix] = await db
    .select({ userId: matrices.userId })
    .from(matrices)
    .where(eq(matrices.id, linkedBox.matrixId));

  if (!matrix || matrix.userId !== userId) {
    return {
      success: false,
      error: "Bu kutuya görev bağlama yetkiniz yok.",
    };
  }

  return { success: true };
}

/**
 * Retrieves the title of a thesis box by ID.
 *
 * @param boxId - Target thesis box ID.
 * @returns Title string or null.
 */
export async function getBoxTitleById(boxId: number): Promise<string | null> {
  const [box] = await db
    .select({ title: boxes.title })
    .from(boxes)
    .where(eq(boxes.id, boxId));
  return box?.title ?? null;
}

/**
 * Fetches an existing task row by ID if owned by the user.
 *
 * @param taskId - Target task ID.
 * @param userId - Authenticated user ID.
 * @returns Task record or null if not found or unauthorized.
 */
export async function fetchUserTaskById(taskId: number, userId: number) {
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));

  if (!existing || existing.userId !== userId) {
    return null;
  }
  return existing;
}
