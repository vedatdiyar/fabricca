"use server";

import { revalidatePath } from "next/cache";
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
 *
 * @returns A success flag or an error message.
 */
export async function resetOnboardingAction(): Promise<
  { success: boolean } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("reset_onboarding_start");

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    await resetUserOnboardingData(session.userId, log);

    await writeSessionCookie(session, false);

    revalidateOnboardingPaths();
    revalidatePath("/onboarding/proposal");
    revalidatePath("/onboarding/matrix");
    invalidateOnboardingCache();

    log.info("reset_onboarding_success");
    return { success: true };
  } catch (error) {
    log.error("reset_onboarding_failed", {
      error,
    });
    return { error: "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu." };
  }
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
