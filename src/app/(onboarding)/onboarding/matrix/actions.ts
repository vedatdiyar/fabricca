"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/core/db";
import {
  matrices,
  positioning,
  boxes,
  sources,
  outlines,
} from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import {
  invalidateOnboardingCache,
  invalidateOnboardingStepCache,
} from "@/lib/cache-tags";
import type { ThesisMatrix } from "@/lib/types";


const MIN_LENGTH = 3;
const MAX_LENGTH = 4000;

const thesisMatrixSchema = z.object({
  subjectProblem: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  theoreticalFramework: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
  primaryMaterial: z.string().trim().max(MAX_LENGTH).optional().default(""),
  methodology: z.string().trim().min(MIN_LENGTH).max(MAX_LENGTH),
});

/**
 * Persists the thesis matrix to the database and clears any downstream analysis
 * data (positioning report, thesis outline, and thesis boxes) that may now be stale.
 *
 * @param data - The thesis matrix data from the onboarding form
 * @param flowId - Optional shared flow identifier of the matrix-submit pipeline run.
 * @returns Success confirmation or an error message
 */
export async function saveThesisMatrixAction(
  data: unknown,
  flowId?: string,
): Promise<{ success: true } | { error: string }> {
  const run = flowId
    ? PipelineRun.resume(MATRIX_SUBMIT_PIPELINE, flowId)
    : PipelineRun.create(MATRIX_SUBMIT_PIPELINE);

  const parsed = thesisMatrixSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Doğrulama başarısız.";
    return { error: msg };
  }

  const validated = parsed.data;

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    await run.execute("save", async () => {
      await db.transaction(async (tx) => {
        const [matrixRow] = await tx
          .insert(matrices)
          .values({
            userId: session.userId,
            subjectProblem: validated.subjectProblem,
            theoreticalFramework: validated.theoreticalFramework,
            primaryMaterial: validated.primaryMaterial,
            methodology: validated.methodology,
            updatedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: matrices.userId,
            set: {
              subjectProblem: validated.subjectProblem,
              theoreticalFramework: validated.theoreticalFramework,
              primaryMaterial: validated.primaryMaterial,
              methodology: validated.methodology,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: matrices.id });

        if (matrixRow) {
          await tx
            .delete(positioning)
            .where(eq(positioning.matrixId, matrixRow.id));

          await tx
            .delete(sources)
            .where(
              inArray(
                sources.boxId,
                tx
                  .select({ id: boxes.id })
                  .from(boxes)
                  .where(eq(boxes.matrixId, matrixRow.id)),
              ),
            );

          await tx.delete(outlines).where(eq(outlines.matrixId, matrixRow.id));

          await tx.delete(boxes).where(eq(boxes.matrixId, matrixRow.id));
        }
      });
    });

    invalidateOnboardingCache();
    invalidateOnboardingStepCache("matrix");

    return { success: true };
  } catch {
    return { error: "Tez matrisi veritabanına kaydedilemedi." };
  }
}

/**
 * Executes a Socratic Advisor turn, returning the advisor's message and any crystallized field updates.
 * If a field update is detected, it is immediately persisted via Progressive Save.
 */
export async function sendAdvisorMessageAction(
  history: Array<{ role: "user" | "model"; content: string }>,
  currentMatrix: Partial<ThesisMatrix>,
): Promise<
  | {
      success: true;
      replyText: string;
      matrixUpdate?: { field: string; value: string; explanation?: string };
      updatedMatrix: Partial<ThesisMatrix>;
    }
  | { error: string }
> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    const { runAdvisorTurn } = await import("./_services/advisor-engine");
    const result = await runAdvisorTurn(history, currentMatrix);

    const updatedMatrix = { ...currentMatrix };

    const modelMessage = {
      id: `model-${Date.now()}`,
      role: "model" as const,
      content: result.replyText,
    };
    const updatedMessages = [
      ...history.map((h, idx) => ({ id: `msg-${idx}`, role: h.role, content: h.content })),
      modelMessage,
    ];

    if (result.matrixUpdate) {
      const { field, value } = result.matrixUpdate;
      updatedMatrix[field] = value;
    }

    // Progressive Save immediately to database
    await db
      .insert(matrices)
      .values({
        userId: session.userId,
        subjectProblem: updatedMatrix.subjectProblem ?? "",
        theoreticalFramework: updatedMatrix.theoreticalFramework ?? "",
        primaryMaterial: updatedMatrix.primaryMaterial ?? "",
        methodology: updatedMatrix.methodology ?? "",
        advisorMessages: updatedMessages,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: matrices.userId,
        set: {
          subjectProblem: updatedMatrix.subjectProblem ?? "",
          theoreticalFramework: updatedMatrix.theoreticalFramework ?? "",
          primaryMaterial: updatedMatrix.primaryMaterial ?? "",
          methodology: updatedMatrix.methodology ?? "",
          advisorMessages: updatedMessages,
          updatedAt: sql`now()`,
        },
      });

    invalidateOnboardingStepCache("matrix");

    return {
      success: true,
      replyText: result.replyText,
      matrixUpdate: result.matrixUpdate,
      updatedMatrix,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Danışman yanıt verirken bir hata oluştu.",
    };
  }
}

/**
 * Directly updates a single field in the user's thesis matrix draft.
 */
export async function updateMatrixFieldDirectAction(
  field: "subjectProblem" | "theoreticalFramework" | "primaryMaterial" | "methodology",
  value: string,
  currentMatrix: Partial<ThesisMatrix>,
): Promise<{ success: true } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    const nextMatrix = { ...currentMatrix, [field]: value };

    await db
      .insert(matrices)
      .values({
        userId: session.userId,
        subjectProblem: nextMatrix.subjectProblem ?? "",
        theoreticalFramework: nextMatrix.theoreticalFramework ?? "",
        primaryMaterial: nextMatrix.primaryMaterial ?? "",
        methodology: nextMatrix.methodology ?? "",
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: matrices.userId,
        set: {
          [field]: value,
          updatedAt: sql`now()`,
        },
      });

    invalidateOnboardingStepCache("matrix");
    return { success: true };
  } catch {
    return { error: "Alan güncellenemedi." };
  }
}
