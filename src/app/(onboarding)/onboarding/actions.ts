"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { matrices, positioning, users, boxes, sources } from "@/db/schema";
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
 * Deletes all onboarding data and sets onboardingCompleted to false.
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

    const userId = session.userId;

    await db.transaction(async (tx) => {
      await tx.delete(matrices).where(eq(matrices.userId, userId));
      await tx.delete(positioning).where(eq(positioning.userId, userId));
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
  fromStep: "matrix" | "positioning" | "boxes",
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: SESSION_ERROR_MSG };

  const userId = session.userId;

  try {
    await db.transaction(async (tx) => {
      if (fromStep === "matrix") {
        await tx.delete(positioning).where(eq(positioning.userId, userId));

        const matrixResult = await tx
          .select({ id: matrices.id })
          .from(matrices)
          .where(eq(matrices.userId, userId));

        const matrix = matrixResult[0];
        if (matrix) {
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
          await tx.delete(boxes).where(eq(boxes.matrixId, matrix.id));
        }
      } else if (fromStep === "boxes") {
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
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Sıfırlama işlemi gerçekleştirilirken bir hata oluştu.",
    };
  }
}
