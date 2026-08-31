"use server";

import { z } from "zod";
import { db } from "@/core/db";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { PipelineRun } from "@/lib/pipeline-logger";
import { BOX_GENERATION_PIPELINE } from "@/lib/pipeline-definitions";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import { type OnboardingActionResult } from "@/lib/types";
import { fetchThesisMatrix } from "@/app/(onboarding)/onboarding/_services/fetch-actions";
import { insertBoxesTransaction } from "./persist/box-inserter";

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
 * @param flowId - Optional shared flow identifier of the box generation pipeline run.
 * @returns An onboarding action result with a success flag or an error message.
 */
export async function persistBoxesAction(
  boxes: unknown,
  flowId?: string,
): Promise<OnboardingActionResult> {
  const run = flowId
    ? PipelineRun.resume(BOX_GENERATION_PIPELINE, flowId)
    : PipelineRun.create(BOX_GENERATION_PIPELINE);
  const log = run.logger;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

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

    await run.execute("persist", async () => {
      await db.transaction(async (tx) => {
        await insertBoxesTransaction(tx, validBoxes, thesisMatrixId);
      });
    });

    try {
      revalidateOnboardingPaths();
      updateTag(CACHE_TAGS.thesisBoxes);
    } catch (err) {
      log.warn("boxes_revalidate_failed", {
        service: "boxes",
        error: err,
      });
    }

    run.finish();

    return { success: true };
  } catch {
    run.finish();
    return { error: "Konu kutuları veritabanına kaydedilemedi." };
  }
}
