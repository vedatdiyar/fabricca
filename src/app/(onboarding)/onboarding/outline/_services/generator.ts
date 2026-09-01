"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices, outlines } from "@/core/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { Logger } from "@/lib/logger";
import { PipelineRun } from "@/lib/pipeline-logger";
import { OUTLINE_GENERATION_PIPELINE } from "@/lib/pipeline-definitions";
import {
  outlineGenerationSchema,
  outlineGenerationJsonSchema,
  type OutlineGenerationResponse,
} from "./schema";

import { buildOutlineGenerationPromptPayload } from "../_prompts/outline-generation.prompt";

/**
 * Generates the thesis outline via Gemini without persisting it.
 *
 * @param flowId - Optional shared flow identifier of the outline generation pipeline run.
 * @returns The generated outline or an error message.
 */
export async function generateOutlineAction(
  flowId?: string,
): Promise<
  { success: true; outline: OutlineGenerationResponse } | { error: string }
> {
  const run = flowId
    ? PipelineRun.resume(OUTLINE_GENERATION_PIPELINE, flowId)
    : PipelineRun.create(OUTLINE_GENERATION_PIPELINE);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    const outline = await run.execute("generate", async () => {
      const payload = buildOutlineGenerationPromptPayload({
        subjectProblem: matrix.subjectProblem,
        theoreticalFramework: matrix.theoreticalFramework,
        primaryMaterial: matrix.primaryMaterial,
        methodology: matrix.methodology,
      });

      return generateGeminiStructuredContent<OutlineGenerationResponse>(
        FLASH_LITE_35,
        payload.systemInstruction,
        payload.userPrompt,
        outlineGenerationJsonSchema,
        run.logger,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: outlineGenerationSchema,
          seed: GEMINI_SEED,
          thesisMatrix: matrix,
          payloadStage: "outline_generation",
          quiet: true,
        },
      );
    });

    return { success: true, outline };
  } catch {
    return {
      error: "Tez planı oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Persists a generated thesis outline to the database and closes the pipeline run.
 *
 * @param outline - The generated outline data from Gemini.
 * @param flowId - Optional shared flow identifier of the outline generation pipeline run.
 * @returns A success flag or an error message.
 */
export async function persistOutlineAction(
  outline: OutlineGenerationResponse,
  flowId?: string,
): Promise<{ success: true } | { error: string }> {
  const run = flowId
    ? PipelineRun.resume(OUTLINE_GENERATION_PIPELINE, flowId)
    : PipelineRun.create(OUTLINE_GENERATION_PIPELINE);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    await run.execute("persist", async () => {
      await persistOutlines(session.userId, matrix.id, outline, run.logger);

      invalidateOnboardingStepCache("outline");
    });

    run.finish();

    return { success: true };
  } catch {
    run.finish();
    return {
      error:
        "Tez planı veritabanına kaydedilirken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Persists the outline hierarchy to the database in a single transaction.
 *
 * @param userId - The current user id.
 * @param matrixId - The thesis matrix id.
 * @param outline - The generated outline data from Gemini.
 * @param log - The parent pipeline logger instance.
 */
async function persistOutlines(
  userId: number,
  matrixId: number,
  outline: OutlineGenerationResponse,
  log: Logger,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing outlines for this matrix (cascade deletes outline_annotations / outline_sources)
    await tx.delete(outlines).where(eq(outlines.matrixId, matrixId));

    const parentValues: (typeof outlines.$inferInsert)[] = [];
    for (const section of outline.sections) {
      parentValues.push({
        matrixId,
        parentId: null,
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        academicField: outline.academicField,
      });
    }

    if (parentValues.length === 0) return;

    const insertedParents = await tx
      .insert(outlines)
      .values(parentValues)
      .returning({ id: outlines.id });

    const dbParentIdMap = new Map<number, number>();
    for (let i = 0; i < outline.sections.length; i++) {
      const dbId = insertedParents[i]?.id;
      if (dbId !== undefined) {
        dbParentIdMap.set(i, dbId);
      }
    }

    // Prepare child subsections
    const childValues: (typeof outlines.$inferInsert)[] = [];
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      if (!section.subSections || section.subSections.length === 0) continue;

      const mappedParentId = dbParentIdMap.get(i) ?? null;
      if (mappedParentId === null) continue;

      for (let j = 0; j < section.subSections.length; j++) {
        const sub = section.subSections[j];
        childValues.push({
          matrixId,
          parentId: mappedParentId,
          title: sub.title,
          description: sub.description,
          sortOrder: sub.sortOrder,
          academicField: null,
        });
      }
    }

    if (childValues.length > 0) {
      await tx.insert(outlines).values(childValues);
    }
  });

  log.info("outline_persist_transaction_complete", {
    service: "outline",
  });
}
