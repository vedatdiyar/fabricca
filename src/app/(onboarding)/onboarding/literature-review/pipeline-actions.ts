"use server";

import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { PipelineRun } from "@/lib/pipeline-logger";
import { LITERATURE_PIPELINE } from "@/lib/pipeline-definitions";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import type { LiteraturePoolEntry } from "@/lib/types";
import type { SubBoxInput } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
import { orchestrateBatchProcess } from "@/app/(onboarding)/onboarding/literature-review/_services/batch-orchestrator";
import {
  persistLiteraturePool,
  persistSubBoxEntry,
} from "@/app/(onboarding)/onboarding/literature-review/_services/pool-persistence";
import { persistRelatedTheses } from "@/app/(onboarding)/onboarding/literature-review/_services/related-theses";
import { loadThesisMatrixAndBoxes } from "@/app/(onboarding)/onboarding/literature-review/_services/process-boxes-data";
import { isLiteratureCancelled } from "./cancel-state";
import { resetLiteratureCancelledAction } from "./cancel-actions";

/**
 * Processes all sub-boxes through the batch literature pipeline.
 *
 * @param boxes - The sub-box inputs to process.
 * @returns The persisted literature pool entries or an error message.
 */
export async function processAllBoxesAction(
  boxes: SubBoxInput[],
): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> {
  const run = PipelineRun.create(LITERATURE_PIPELINE);

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;
    await resetLiteratureCancelledAction();

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { matrix } = await loadThesisMatrixAndBoxes(userId);
    if (!matrix) return { error: "Tez matrisi bulunamadı." };
    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { poolEntries } = await run.execute("scan", () =>
      orchestrateBatchProcess(
        boxes,
        run.logger,
        matrix.subjectProblem,
        () => isLiteratureCancelled(userId),
        async (thesisBoxId, articles) => {
          await persistSubBoxEntry(thesisBoxId, articles);
        },
      ),
    );

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    run.finish();

    return { data: poolEntries };
  } catch (err) {
    run.finish();
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    return { error: message };
  }
}

/**
 * Runs the full literature pipeline (search, jury, selection, persistence) and returns the pool.
 *
 * @param boxes - The sub-box inputs to process.
 * @returns The persisted literature pool entries or an error message.
 */
export async function runLiteraturePipelineAction(
  boxes: SubBoxInput[],
): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> {
  const run = PipelineRun.create(LITERATURE_PIPELINE);
  const pipelineStart = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;
    await resetLiteratureCancelledAction();

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { matrix } = await loadThesisMatrixAndBoxes(userId);
    const subjectProblem = matrix?.subjectProblem ?? "";

    const { poolEntries } = await run.execute("scan", () =>
      orchestrateBatchProcess(
        boxes,
        run.logger,
        subjectProblem,
        () => isLiteratureCancelled(userId),
        async (thesisBoxId, articles) => {
          await persistSubBoxEntry(thesisBoxId, articles);
        },
      ),
    );

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    await run.execute("persist", () => persistLiteraturePool(poolEntries));

    await persistRelatedTheses(userId);

    try {
      revalidateOnboardingPaths();
    } catch (err) {
      run.logger.warn("literature_pipeline_revalidate_failed", {
        service: "literature",
        error: err,
      });
    }
    invalidateOnboardingCache();

    run.finish({
      durationMs: Math.round(performance.now() - pipelineStart),
    });

    return { data: poolEntries };
  } catch (err) {
    run.finish();
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    return { error: message };
  }
}
