"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  users,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import {
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ERROR_MSG,
} from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
  invalidateOnboardingStepCache,
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

  log.info("reset_onboarding_start", { service: "flow" });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;

    // All three destructive operations run inside a single transaction so that
    // a failure in any step rolls the entire reset back. This prevents leaving
    // the user in an inconsistent state (e.g. matrix deleted but
    // onboardingCompleted still flagged as true).
    // Queries are run sequentially to prevent socket contention/queuing issues.
    await db.transaction(async (tx) => {
      await tx.delete(thesisMatrices).where(eq(thesisMatrices.userId, userId));
      await tx
        .delete(originalityReports)
        .where(eq(originalityReports.userId, userId));
      await tx
        .update(users)
        .set({ onboardingCompleted: false })
        .where(eq(users.id, userId));
    });

    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      JSON.stringify({
        userId: session.userId,
        name: session.name,
        onboardingCompleted: false,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    );

    revalidateOnboardingPaths();
    revalidatePath("/onboarding/matrix");
    invalidateOnboardingCache();

    log.info("reset_onboarding_success", { service: "flow" });
    return { success: true };
  } catch (error) {
    log.error("reset_onboarding_failed", {
      service: "flow",
      error,
      data: {
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
        // Clear originality reports and fetch matrix sequentially to avoid connection contention
        await tx
          .delete(originalityReports)
          .where(eq(originalityReports.userId, userId));
        const matrixResult = await tx
          .select({ id: thesisMatrices.id })
          .from(thesisMatrices)
          .where(eq(thesisMatrices.userId, userId));

        const matrix = matrixResult[0];
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
          // Single delete statement using subquery for better database performance
          await tx
            .delete(libraryResources)
            .where(
              inArray(
                libraryResources.thesisBoxId,
                tx
                  .select({ id: thesisBoxes.id })
                  .from(thesisBoxes)
                  .where(eq(thesisBoxes.thesisMatrixId, matrix.id)),
              ),
            );
        }
      }
    });

    invalidateOnboardingStepCache(fromStep);
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
