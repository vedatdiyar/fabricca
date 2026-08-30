"use server";

import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";

/**
 * Saves user clarification answers to the background matrix and prepares for advancing to Boxes step.
 *
 * @param answers - Array of question/answer pairs from the positioning report.
 * @returns Success flag or error.
 */
export async function completePositioningClarificationsAction(
  answers: Array<{ question: string; answer: string }>,
): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const validAnswers = answers.filter((a) => a.answer.trim().length > 0);

    if (validAnswers.length > 0) {
      const clarificationsText = validAnswers
        .map((a) => `[Odak Netleştirmesi]: ${a.question} -> ${a.answer}`)
        .join("\n");

      await db
        .update(matrices)
        .set({
          subjectProblem: `${matrix.subjectProblem}\n\n${clarificationsText}`,
          updatedAt: sql`now()`,
        })
        .where(eq(matrices.id, matrix.id));
    }

    invalidateOnboardingStepCache("positioning");
    invalidateOnboardingStepCache("boxes");

    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Netleştirme yanıtları kaydedilemedi.",
    };
  }
}
