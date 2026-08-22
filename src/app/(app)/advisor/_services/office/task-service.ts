"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { sessions, tasks } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { handleActionError } from "@/lib/errors/handle-error";

/**
 * Creates a revision task in the Kanban board.
 *
 * @param input - title, description and outlineId.
 * @returns Success with taskId or an error.
 */
export async function createRevisionTaskAction(input: {
  title: string;
  description?: string;
  outlineId?: number;
}): Promise<{ success: boolean; taskId?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const { title, description } = input;
    if (!title || !title.trim()) {
      return { success: false, error: "Görev başlığı boş olamaz." };
    }

    const [insertedTask] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        status: "TODO",
        priority: "HIGH",
      })
      .returning({ id: tasks.id });

    return { success: true, taskId: insertedTask.id };
  } catch (err) {
    new Logger(createFlowId()).error("createRevisionTaskAction error:", {
      service: "advisor",
      error: err,
    });
    return {
      success: false,
      error: "Revizyon görevi eklenirken bir hata oluştu.",
    };
  }
}

/**
 * Deletes an office review session.
 *
 * @param sessionId - ID of session to delete.
 * @returns Success or an error.
 */
export async function deleteOfficeSessionAction(
  sessionId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    await db
      .delete(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );

    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}
