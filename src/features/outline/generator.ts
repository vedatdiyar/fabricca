"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matrices, outlines, boxes, outlineBoxes } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import { generateGeminiStructuredContent } from "@/services/ai";
import { FLASH_36, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import {
  outlineGenerationSchema,
  outlineGenerationJsonSchema,
  type OutlineGenerationResponse,
} from "./schema";

import { buildOutlineGenerationPromptPayload } from "./prompts/outline-generation.prompt";

/**
 * Generates the thesis outline via Gemini without persisting it.
 *
 * @returns The generated outline or an error message.
 */
export async function generateOutlineAction(): Promise<
  { success: true; outline: OutlineGenerationResponse } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("outline_generation_start", {
      service: "outline",
    });

    const payload = buildOutlineGenerationPromptPayload({
      subjectProblem: matrix.subjectProblem,
      theoreticalFramework: matrix.theoreticalFramework,
      primaryMaterial: matrix.primaryMaterial,
      methodology: matrix.methodology,
    });

    const result =
      await generateGeminiStructuredContent<OutlineGenerationResponse>(
        FLASH_36,
        payload.systemInstruction,
        payload.userPrompt,
        outlineGenerationJsonSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          zodSchema: outlineGenerationSchema,
          seed: GEMINI_SEED,
          thesisMatrix: matrix,
          payloadStage: "outline_generation",
          quiet: true,
        },
      );

    log.info("outline_generation_success", {
      service: "outline",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true, outline: result };
  } catch (err) {
    log.error("outline_generation_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Tez planı oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Persists a generated thesis outline to the database.
 *
 * @param outline - The generated outline data from Gemini.
 * @returns A success flag or an error message.
 */
export async function persistOutlineAction(
  outline: OutlineGenerationResponse,
): Promise<{ success: true } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    await persistOutlines(session.userId, matrix.id, outline);

    invalidateOnboardingStepCache("outline");

    return { success: true };
  } catch (err) {
    log.error("outline_persist_failed", {
      service: "outline",
      error: err instanceof Error ? err : new Error(String(err)),
    });
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
 */
async function persistOutlines(
  userId: number,
  matrixId: number,
  outline: OutlineGenerationResponse,
): Promise<void> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  await db.transaction(async (tx) => {
    // 1. Fetch user's existing topic boxes for this matrix
    const userBoxes = await tx
      .select()
      .from(boxes)
      .where(eq(boxes.matrixId, matrixId));

    // Delete existing outlines for this matrix (cascade deletes outline_boxes)
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
    const childIndexMap: { parentIdx: number; subIdx: number }[] = [];
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
        childIndexMap.push({ parentIdx: i, subIdx: j });
      }
    }

    let insertedChildren: { id: number }[] = [];
    if (childValues.length > 0) {
      insertedChildren = await tx
        .insert(outlines)
        .values(childValues)
        .returning({ id: outlines.id });
    }

    // 2. Auto-link boxes to outline sections (outline_boxes)
    if (userBoxes.length > 0) {
      const outlineBoxLinks: { outlineId: number; boxId: number }[] = [];
      const addedSet = new Set<string>();

      const addLink = (outlineId: number, boxId: number) => {
        const key = `${outlineId}-${boxId}`;
        if (!addedSet.has(key)) {
          addedSet.add(key);
          outlineBoxLinks.push({ outlineId, boxId });
        }
      };

      // Auto-link parent sections
      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i];
        const outlineId = dbParentIdMap.get(i);
        if (!outlineId) continue;

        const recTypes = section.recommendedBoxTypes || [];
        for (const box of userBoxes) {
          if (box.boxType && recTypes.includes(box.boxType)) {
            addLink(outlineId, box.id);
          }
        }
      }

      // Auto-link child subsections
      for (let k = 0; k < childIndexMap.length; k++) {
        const { parentIdx, subIdx } = childIndexMap[k];
        const childOutlineId = insertedChildren[k]?.id;
        if (!childOutlineId) continue;

        const sub = outline.sections[parentIdx]?.subSections?.[subIdx];
        if (!sub) continue;

        const recTypes = sub.recommendedBoxTypes || [];
        for (const box of userBoxes) {
          if (box.boxType && recTypes.includes(box.boxType)) {
            addLink(childOutlineId, box.id);
          }
        }
      }

      if (outlineBoxLinks.length > 0) {
        await tx.insert(outlineBoxes).values(outlineBoxLinks);
      }
    }
  });

  log.info("outline_persist_transaction_complete", {
    service: "outline",
  });
}
