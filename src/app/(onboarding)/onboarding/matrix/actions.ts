"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisPositioning,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import {
  invalidateOnboardingCache,
  invalidateOnboardingStepCache,
} from "@/lib/cache-tags";

const MIN_LENGTH = 3;
const MAX_LENGTH = 4000;

const thesisMatrixSchema = z.object({
  researchCore: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  targetActors: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  context: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  framework: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  mainClaim: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
});

/**
 * Persists the thesis matrix to the database and clears any downstream analysis
 * data (originality reports and thesis boxes) that may now be stale.
 *
 * @param data - The thesis matrix data from the onboarding form
 * @returns Success confirmation or an error message
 */
export async function saveThesisMatrixAction(
  data: unknown,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  const parsed = thesisMatrixSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Validation failed.";
    return { error: msg };
  }

  const validated = parsed.data;

  log.info("matrix_save_start");

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    await db.transaction(async (tx) => {
      const [matrixRow] = await tx
        .insert(thesisMatrices)
        .values({
          userId: session.userId,
          researchCore: validated.researchCore,
          targetActors: validated.targetActors,
          context: validated.context,
          framework: validated.framework,
          mainClaim: validated.mainClaim,
          updatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: thesisMatrices.userId,
          set: {
            researchCore: validated.researchCore,
            targetActors: validated.targetActors,
            context: validated.context,
            framework: validated.framework,
            mainClaim: validated.mainClaim,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: thesisMatrices.id });

      if (matrixRow) {
        await tx
          .delete(thesisPositioning)
          .where(eq(thesisPositioning.userId, session.userId));

        await tx
          .delete(libraryResources)
          .where(
            inArray(
              libraryResources.thesisBoxId,
              tx
                .select({ id: thesisBoxes.id })
                .from(thesisBoxes)
                .where(eq(thesisBoxes.thesisMatrixId, matrixRow.id)),
            ),
          );

        await tx
          .delete(thesisBoxes)
          .where(eq(thesisBoxes.thesisMatrixId, matrixRow.id));
      }
    });

    invalidateOnboardingCache();
    invalidateOnboardingStepCache("matrix");

    log.info("matrix_save_success", {
      durationMs: performance.now() - startTime,
    });

    return { success: true };
  } catch (error) {
    log.error("matrix_save_failed", {
      error,
    });
    return { error: "Failed to save thesis matrix to the database." };
  }
}
