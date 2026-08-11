"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boxes as boxRows } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import { type OnboardingActionResult } from "@/lib/types";
import { fetchThesisMatrix } from "../../_services/fetch-actions";

const confirmBoxSchema: z.ZodType<{
  title: string;
  boxType:
    | "SUBJECT_PROBLEM"
    | "THEORETICAL_FRAMEWORK"
    | "METHODOLOGY"
    | "PRIMARY_MATERIAL";
  description?: string;
  parentId: number | null;
  semanticQuery: string | null;
  subBoxes?: unknown;
  concepts?: string[];
}> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    boxType: z.enum([
      "SUBJECT_PROBLEM",
      "THEORETICAL_FRAMEWORK",
      "METHODOLOGY",
      "PRIMARY_MATERIAL",
    ]),
    description: z.string().optional().default(""),
    parentId: z.number().nullable(),
    semanticQuery: z.string().nullable(),
    subBoxes: z.array(confirmBoxSchema).optional(),
    concepts: z.array(z.string()).optional().default([]),
  }),
);

const confirmBoxesSchema = z.array(confirmBoxSchema);

/**
 * Persists the boxes to the database in a single transaction and invalidates caches.
 *
 * @param boxes - The boxes payload to validate and persist.
 * @returns An onboarding action result with a success flag or an error message.
 */
export async function persistBoxesAction(
  boxes: unknown,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("boxes_persist_start", {
      service: "boxes",
      filePath:
        "src/app/(onboarding)/onboarding/boxes/_services/persist-boxes.ts",
    });

    const parsed = confirmBoxesSchema.safeParse(boxes);
    if (!parsed.success) {
      log.error("boxes_persist_validation_failed", {
        service: "boxes",
        error: parsed.error,
      });
      return { error: "Geçersiz konu kutusu verisi alındı." };
    }

    const validBoxes = parsed.data;
    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      await tx
        .delete(boxRows)
        .where(
          and(
            eq(boxRows.matrixId, thesisMatrixId),
            ne(boxRows.boxType, "RELATED_THESES"),
          ),
        );

      const parentFlatIndices: number[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        if (validBoxes[i].parentId === null) {
          parentFlatIndices.push(i);
        }
      }

      const parentValues = parentFlatIndices.map((i) => ({
        matrixId: thesisMatrixId,
        title: validBoxes[i].title,
        boxType: validBoxes[i].boxType,
        description: validBoxes[i].description || "",
        parentId: null,
        semanticQuery: null,
        concepts: validBoxes[i].concepts || [],
      }));

      let insertedParents: { id: number }[] = [];
      if (parentValues.length > 0) {
        insertedParents = await tx
          .insert(boxRows)
          .values(parentValues)
          .returning({ id: boxRows.id });
      }

      const dbParentIdMap = new Map<number, number>();
      for (let j = 0; j < parentFlatIndices.length; j++) {
        const dbId = insertedParents[j]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(parentFlatIndices[j], dbId);
        }
      }

      const childValues: (typeof boxRows.$inferInsert)[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        const box = validBoxes[i];
        if (box.parentId === null) continue;
        const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
        childValues.push({
          matrixId: thesisMatrixId,
          title: box.title,
          boxType: box.boxType,
          description: box.description || "",
          parentId: mappedParentId,
          semanticQuery: box.semanticQuery || "",
          concepts: box.concepts ?? [],
        });
      }

      if (childValues.length > 0) {
        await tx.insert(boxRows).values(childValues);
      }
    });

    try {
      revalidateOnboardingPaths();
      updateTag(CACHE_TAGS.thesisBoxes);
    } catch {}

    log.info("boxes_persist_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true };
  } catch (err) {
    log.error("boxes_persist_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return { error: "Konu kutuları veritabanına kaydedilemedi." };
  }
}

/**
 * Legacy alias for persistBoxesAction.
 */
export const confirmBoxesAction = persistBoxesAction;
