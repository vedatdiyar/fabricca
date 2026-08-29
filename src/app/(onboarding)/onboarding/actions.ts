"use server";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  matrices,
  positioning,
  boxes,
  sources,
  outlines,
} from "@/core/db/schema";
import {
  getSession,
  writeSessionCookie,
  SESSION_ERROR_MSG,
} from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { resetUserOnboardingData } from "@/app/(onboarding)/onboarding/_services/reset-onboarding";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
  invalidateOnboardingStepCache,
} from "@/lib/cache-tags";

/**
 * Deletes all onboarding and user data and sets onboardingCompleted to false.
 * Uses redirect pattern (aligned with src/app/(app)/actions.ts) to avoid
 * "The destination stream closed early" caused by returning JSON after
 * revalidatePath/updateTag + immediate window.location.assign on the client.
 */
export async function resetOnboardingAction(): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("reset_onboarding_start");

  try {
    const session = await getSession();
    if (!session) {
      redirect("/login");
      return;
    }

    await resetUserOnboardingData(session.userId, log);

    await writeSessionCookie(session, false);

    revalidateOnboardingPaths();
    invalidateOnboardingCache();

    log.info("reset_onboarding_success");
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    log.error("reset_onboarding_failed", {
      error,
    });
  }

  redirect("/onboarding/proposal");
}

/**
 * Clears all downstream step data from the given step onward.
 *
 * @param fromStep - The step from which downstream data is cleared.
 * @returns A success flag or an error message.
 */
export async function clearDownstreamDbAction(
  fromStep: "proposal" | "matrix" | "positioning" | "boxes" | "outline",
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: SESSION_ERROR_MSG };

  const userId = session.userId;

  try {
    await db.transaction(async (tx) => {
      if (fromStep === "proposal") {
        await tx.delete(positioning).where(eq(positioning.userId, userId));

        const matrixResult = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        const matrix = matrixResult[0];
        if (matrix) {
          await tx.delete(outlines).where(eq(outlines.matrixId, matrix.id));
          await tx.delete(boxes).where(eq(boxes.matrixId, matrix.id));
          await tx
            .update(matrices)
            .set({
              subjectProblem: "",
              theoreticalFramework: "",
              primaryMaterial: null,
              methodology: "",
            })
            .where(eq(matrices.id, matrix.id));
        }
      } else if (fromStep === "matrix") {
        await tx.delete(positioning).where(eq(positioning.userId, userId));

        const matrixResult = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        const matrix = matrixResult[0];
        if (matrix) {
          await tx.delete(outlines).where(eq(outlines.matrixId, matrix.id));
          await tx.delete(boxes).where(eq(boxes.matrixId, matrix.id));
        }
      } else if (fromStep === "positioning") {
        const matrixResult = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        const matrix = matrixResult[0];
        if (matrix) {
          await tx
            .delete(sources)
            .where(
              inArray(
                sources.boxId,
                tx
                  .select({ id: boxes.id })
                  .from(boxes)
                  .where(eq(boxes.matrixId, matrix.id)),
              ),
            );
          await tx.delete(outlines).where(eq(outlines.matrixId, matrix.id));
          await tx.delete(boxes).where(eq(boxes.matrixId, matrix.id));
        }
      } else if (fromStep === "boxes") {
        const [matrix] = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        if (matrix) {
          await tx.delete(outlines).where(eq(outlines.matrixId, matrix.id));
          await tx
            .delete(sources)
            .where(
              inArray(
                sources.boxId,
                tx
                  .select({ id: boxes.id })
                  .from(boxes)
                  .where(eq(boxes.matrixId, matrix.id)),
              ),
            );
        }
      } else if (fromStep === "outline") {
        const [matrix] = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        if (matrix) {
          await tx
            .delete(sources)
            .where(
              inArray(
                sources.boxId,
                tx
                  .select({ id: boxes.id })
                  .from(boxes)
                  .where(eq(boxes.matrixId, matrix.id)),
              ),
            );
        }
      }
    });

    invalidateOnboardingStepCache(fromStep);
    return { success: true };
  } catch {
    return {
      error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu.",
    };
  }
}
