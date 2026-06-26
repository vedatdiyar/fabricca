"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/db";
import { tasks, thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";

export type TaskInput = {
  title: string;
  description?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  priority?: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId?: number | null;
};

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  thesisBoxId: number | null;
  boxTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Oturumdaki kullanıcıya ait tüm görevleri getirir.
 * thesisBoxes tablosu ile LEFT JOIN yaparak kutu başlığını dinamik çözer.
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
    if (!session) return { success: false, error: "Oturum bulunamadı." };

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
    return { success: false, error: "Görevler yüklenirken hata oluştu." };
  }
}

/**
 * Yeni bir görev oluşturur.
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
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const title = input.title.trim();
    if (!title) return { success: false, error: "Görev adı zorunludur." };

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId: session.userId,
        title,
        description: input.description ?? null,
        status: input.status ?? "TODO",
        priority: input.priority ?? "MEDIUM",
        thesisBoxId: input.thesisBoxId ?? null,
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
    return { success: false, error: "Görev eklenirken hata oluştu." };
  }
}

/**
 * Görevin başlık, öncelik, kutu gibi alanlarını günceller.
 */
export async function updateTaskAction(
  taskId: number,
  input: Partial<TaskInput>,
): Promise<{
  success: boolean;
  data?: TaskRow;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Görev bulunamadı." };
    }

    const updateValues: Record<string, unknown> = {};
    if (input.title !== undefined) updateValues.title = input.title.trim();
    if (input.description !== undefined)
      updateValues.description = input.description;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.priority !== undefined) updateValues.priority = input.priority;
    if (input.thesisBoxId !== undefined)
      updateValues.thesisBoxId = input.thesisBoxId;

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
    return { success: false, error: "Görev güncellenirken hata oluştu." };
  }
}

/**
 * Görevin durumunu (TODO / IN_PROGRESS / DONE) günceller.
 * Sürükle-bırak işlemleri için kullanılır.
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
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Görev bulunamadı." };
    }

    await db
      .update(tasks)
      .set({ status: newStatus })
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
      error: "Görev durumu güncellenirken hata oluştu.",
    };
  }
}

/**
 * Bir görevi siler.
 */
export async function deleteTaskAction(taskId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Görev bulunamadı." };
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
    return { success: false, error: "Görev silinirken hata oluştu." };
  }
}
