"use server";

import { eq, count, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createFlowId, Logger } from "@/lib/logger";
import { db } from "@/core/db";
import { matrices, boxes, sources } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import {
  calculateTimelineMetrics,
  type TimelineMetrics,
  type ThesisDegree,
} from "@/core/services/timeline/timeline-engine";
import { syncAcademicTasks } from "./_services/task-sync-service";

const updateTimelineSchema = z.object({
  thesisDegree: z.enum(["MASTER", "DOCTORATE"]),
  targetCompletionDate: z.string().nullable(),
  weeklyTargetHours: z.number().int().min(1).max(80),
});

export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>;

/**
 * Loads current user's academic calendar timeline metrics.
 *
 * @returns Timeline metrics or error.
 */
export async function getTimelineMetricsAction(): Promise<{
  success: boolean;
  data?: TimelineMetrics;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const matrixRows = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));
    const userMatrix = matrixRows[0];

    if (!userMatrix) {
      return { success: false, error: "Tez matrisi bulunamadı." };
    }

    const totalSourcesRows = await db
      .select({ count: count() })
      .from(sources)
      .innerJoin(boxes, eq(sources.boxId, boxes.id))
      .where(eq(boxes.matrixId, userMatrix.id));
    const totalSourcesCount = Number(totalSourcesRows[0]?.count ?? 0);

    const readSourcesRows = await db
      .select({ count: count() })
      .from(sources)
      .innerJoin(boxes, eq(sources.boxId, boxes.id))
      .where(and(eq(boxes.matrixId, userMatrix.id), eq(sources.isRead, true)));
    const readSourcesCount = Number(readSourcesRows[0]?.count ?? 0);

    const metrics = calculateTimelineMetrics({
      startDate: userMatrix.createdAt,
      targetDate: userMatrix.targetCompletionDate,
      degree: userMatrix.thesisDegree as ThesisDegree,
      weeklyHours: userMatrix.weeklyTargetHours,
      currentSources: totalSourcesCount,
      readSources: readSourcesCount,
    });

    return { success: true, data: metrics };
  } catch (err) {
    log.error("get_timeline_metrics_failed", {
      service: "timeline",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Takvim verisi yüklenemedi.",
    };
  }
}

/**
 * Updates user's thesis degree, target completion date, and weekly hours.
 * Automatically triggers task synchronization under new timeline constraints.
 *
 * @param input - Validated form input.
 * @returns Success status or error.
 */
export async function updateTimelineSettingsAction(
  input: UpdateTimelineInput,
): Promise<{
  success: boolean;
  data?: TimelineMetrics;
  error?: string;
}> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { success: false, error: SESSION_ERROR_MSG };

    const parsed = updateTimelineSchema.parse(input);

    const targetDate = parsed.targetCompletionDate
      ? new Date(parsed.targetCompletionDate)
      : null;

    await db
      .update(matrices)
      .set({
        thesisDegree: parsed.thesisDegree,
        targetCompletionDate: targetDate,
        weeklyTargetHours: parsed.weeklyTargetHours,
        updatedAt: new Date(),
      })
      .where(eq(matrices.userId, session.userId));

    // Re-sync tasks under new timeline constraints
    await syncAcademicTasks(session.userId);

    revalidatePath("/dashboard");
    revalidatePath("/library");

    // Fetch and return freshly calculated metrics
    const metricsResult = await getTimelineMetricsAction();
    return metricsResult;
  } catch (err) {
    log.error("update_timeline_settings_failed", {
      service: "timeline",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Takvim ayarları güncellenemedi.",
    };
  }
}
