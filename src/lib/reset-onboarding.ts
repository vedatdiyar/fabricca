import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  matrices,
  tasks,
  positioning,
  boxes,
  sources,
  sessions,
} from "@/db/schema";
import { deletePdfFromR2 } from "@/services/storage/r2";
import type { Logger } from "@/lib/logger";

/**
 * Deletes all onboarding and user data for the given user: removes the user's
 * R2 PDFs, chat sessions, tasks, positioning, and thesis matrix (cascading into
 * boxes, outlines, sources, expansions, annotations, critiques, and chunks), then
 * resets the user's onboardingCompleted flag to false.
 *
 * Central helper shared by the onboarding and app reset actions so the wipe logic
 * has a single source of truth.
 *
 * @param userId - The id of the user whose data should be wiped.
 * @param log - The structured logger for the current flow.
 */
export async function resetUserOnboardingData(
  userId: number,
  log: Logger,
): Promise<void> {
  // Fetch PDF filenames to clean up from R2 before deleting database records
  try {
    const userSources = await db
      .select({ pdfFileName: sources.pdfFileName })
      .from(sources)
      .innerJoin(boxes, eq(sources.boxId, boxes.id))
      .innerJoin(matrices, eq(boxes.matrixId, matrices.id))
      .where(eq(matrices.userId, userId));

    for (const s of userSources) {
      if (s.pdfFileName) {
        try {
          await deletePdfFromR2(s.pdfFileName);
        } catch (r2Err) {
          log.error("reset_onboarding_r2_delete_failed", {
            service: "db",
            error: r2Err,
            data: { pdfFileName: s.pdfFileName },
          });
        }
      }
    }
  } catch (fetchErr) {
    log.error("reset_onboarding_sources_fetch_failed", {
      service: "db",
      error: fetchErr,
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(tasks).where(eq(tasks.userId, userId));
    await tx.delete(positioning).where(eq(positioning.userId, userId));
    await tx.delete(matrices).where(eq(matrices.userId, userId));
    await tx
      .update(users)
      .set({ onboardingCompleted: false })
      .where(eq(users.id, userId));
  });
}
