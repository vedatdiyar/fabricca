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
import { Logger, createFlowId } from "@/lib/logger";
import { PipelineRun } from "@/lib/pipeline-logger";
import { MATRIX_SUBMIT_PIPELINE } from "@/lib/pipeline-definitions";
import {
  invalidateOnboardingCache,
  invalidateOnboardingStepCache,
} from "@/lib/cache-tags";
import type { ThesisMatrix } from "@/lib/types";
import {
  synthesizeFinalMatrix,
  type UserClarificationAnswer,
} from "./_services/proposal-synthesis-service";

const MIN_LENGTH = 3;
const MAX_LENGTH = 10000;

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
 * Synthesizes the final 4-quadrant Thesis Matrix from the user's original proposal,
 * the search evidence summary, and the user's answers to the clarification questions.
 *
 * @param payload - The synthesis inputs.
 * @returns The synthesized matrix or an error message.
 */
export async function synthesizeMatrixAction(payload: {
  originalProposal: string;
  evidenceSummary: string;
  userAnswers: UserClarificationAnswer[];
}): Promise<{ success: true; matrix: ThesisMatrix } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    if (
      !payload.originalProposal ||
      payload.originalProposal.trim().length < 50
    ) {
      return { error: "Geçerli bir tez önerisi bulunamadı." };
    }

    const matrix = await synthesizeFinalMatrix(
      payload.originalProposal,
      payload.evidenceSummary,
      payload.userAnswers,
    );

    return { success: true, matrix };
  } catch (err) {
    new Logger(createFlowId()).error("synthesize_matrix_failed", {
      service: "matrix",
      error: err,
    });
    const message =
      err instanceof Error
        ? err.message
        : "Tez matrisi sentezlenirken beklenmeyen bir hata oluştu.";
    return { error: message };
  }
}

/**
 * Synthesizes the 4-quadrant Thesis Matrix from proposal, evidence, and answers,
 * persists the matrix and audit metadata in DB, clears any downstream data,
 * and invalidates cache tags.
 *
 * @param payload - The synthesis inputs and audit results.
 * @returns Success flag with synthesized matrix, or error.
 */
export async function synthesizeAndSaveMatrixAction(payload: {
  originalProposal: string;
  evidenceSummary: string;
  userAnswers: UserClarificationAnswer[];
  auditResult?: unknown;
}): Promise<{ success: true; matrix: ThesisMatrix } | { error: string }> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    if (
      !payload.originalProposal ||
      payload.originalProposal.trim().length < 50
    ) {
      return { error: "Geçerli bir tez önerisi bulunamadı." };
    }

    const matrix = await synthesizeFinalMatrix(
      payload.originalProposal,
      payload.evidenceSummary,
      payload.userAnswers,
    );

    await db.transaction(async (tx) => {
      // Clear downstream positioning, outlines, boxes, sources
      const [existingMatrix] = await tx
        .select({ id: matrices.id })
        .from(matrices)
        .where(eq(matrices.userId, session.userId));

      if (existingMatrix) {
        await tx
          .delete(positioning)
          .where(eq(positioning.matrixId, existingMatrix.id));
        await tx
          .delete(sources)
          .where(
            inArray(
              sources.boxId,
              tx
                .select({ id: boxes.id })
                .from(boxes)
                .where(eq(boxes.matrixId, existingMatrix.id)),
            ),
          );
        await tx
          .delete(outlines)
          .where(eq(outlines.matrixId, existingMatrix.id));
        await tx.delete(boxes).where(eq(boxes.matrixId, existingMatrix.id));
      }

      await tx
        .insert(matrices)
        .values({
          userId: session.userId,
          rawProposal: payload.originalProposal,
          evidenceSummary: payload.evidenceSummary,
          auditResult: payload.auditResult as
            Record<string, unknown> | undefined,
          subjectProblem: matrix.subjectProblem,
          theoreticalFramework: matrix.theoreticalFramework,
          primaryMaterial: matrix.primaryMaterial,
          methodology: matrix.methodology,
          updatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: matrices.userId,
          set: {
            rawProposal: payload.originalProposal,
            evidenceSummary: payload.evidenceSummary,
            auditResult: payload.auditResult as
              Record<string, unknown> | undefined,
            subjectProblem: matrix.subjectProblem,
            theoreticalFramework: matrix.theoreticalFramework,
            primaryMaterial: matrix.primaryMaterial,
            methodology: matrix.methodology,
            updatedAt: sql`now()`,
          },
        });
    });

    invalidateOnboardingStepCache("proposal");
    return { success: true, matrix };
  } catch (err) {
    new Logger(createFlowId()).error("synthesize_and_save_matrix_failed", {
      service: "matrix",
      error: err,
    });
    const message =
      err instanceof Error
        ? err.message
        : "Tez matrisi sentezlenirken beklenmeyen bir hata oluştu.";
    return { error: message };
  }
}
