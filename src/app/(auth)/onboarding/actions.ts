"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  users,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import { getSession } from "@/session";
import { createFlowId, Logger } from "@/lib/logger";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";

/**
 * Resets the onboarding process for the currently authenticated user.
 * Deletes all onboarding data (thesis_matrices cascades to thesis_boxes
 * and library_resources) and sets onboardingCompleted to false.
 *
 * @returns Success status or a user-safe error message
 */
export async function resetOnboardingAction(): Promise<
  { success: boolean } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "reset_onboarding", status: "START", service: "flow" });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;

    // All three destructive operations run inside a single transaction so that
    // a failure in any step rolls the entire reset back. This prevents leaving
    // the user in an inconsistent state (e.g. matrix deleted but
    // onboardingCompleted still flagged as true).
    await db.transaction(async (tx) => {
      // Delete thesis matrix (cascades to thesis_boxes → library_resources)
      await tx.delete(thesisMatrices).where(eq(thesisMatrices.userId, userId));
      // Delete originality report
      await tx
        .delete(originalityReports)
        .where(eq(originalityReports.userId, userId));
      // Reset onboarding flag
      await tx
        .update(users)
        .set({ onboardingCompleted: false })
        .where(eq(users.id, userId));
    });

    revalidateOnboardingPaths();
    invalidateOnboardingCache();

    log.info({ step: "reset_onboarding", status: "SUCCESS", service: "flow" });
    return { success: true };
  } catch (error) {
    log.error({
      step: "reset_onboarding",
      status: "FAILED",
      service: "flow",
      diagnostics: {
        errorCode: "SYSTEM_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return { error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu." };
  }
}

/**
 * Dynamically clears all downstream step data in the database.
 *
 * @param fromStep - The step from which to clear downstream data
 * @returns Success status or a user-safe error message
 */
export async function clearDownstreamDbAction(
  fromStep: "matrix" | "risk" | "boxes",
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: SESSION_ERROR_MSG };

  const userId = session.userId;

  try {
    await db.transaction(async (tx) => {
      if (fromStep === "matrix") {
        // Clear originality reports
        await tx
          .delete(originalityReports)
          .where(eq(originalityReports.userId, userId));

        // Get matrix ID
        const [matrix] = await tx
          .select({ id: thesisMatrices.id })
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId));

        if (matrix) {
          // Clear thesis boxes (cascades to libraryResources)
          await tx
            .delete(thesisBoxes)
            .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
        }
      } else if (fromStep === "risk") {
        // Get matrix ID
        const [matrix] = await tx
          .select({ id: thesisMatrices.id })
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId));

        if (matrix) {
          // Clear thesis boxes (cascades to libraryResources)
          await tx
            .delete(thesisBoxes)
            .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
        }
      } else if (fromStep === "boxes") {
        // Clear all library resources (including YÖK theses) so the
        // server-side stepsData check returns hasLiterature:false,
        // keeping the literature-review stepper locked.
        const [matrix] = await tx
          .select({ id: thesisMatrices.id })
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId));

        if (matrix) {
          const boxIds = await tx
            .select({ id: thesisBoxes.id })
            .from(thesisBoxes)
            .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
            .then((rows) => rows.map((r) => r.id));

          if (boxIds.length > 0) {
            await tx
              .delete(libraryResources)
              .where(inArray(libraryResources.thesisBoxId, boxIds));
          }
        }
      }
    });

    invalidateOnboardingCache();
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu.",
    };
  }
}
