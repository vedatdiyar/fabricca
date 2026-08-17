"use server";

import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { Logger, createFlowId } from "@/lib/logger";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import type { LiteraturePoolEntry } from "@/lib/types";
import type { SubBoxInput } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
import { orchestrateBatchProcess } from "@/app/(onboarding)/onboarding/literature-review/_services/batch-orchestrator";
import {
  persistLiteraturePool,
  persistSubBoxEntry,
  persistRelatedTheses,
} from "@/app/(onboarding)/onboarding/literature-review/_services/literature-persistence";
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
  const logger = new Logger(createFlowId());

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;
    await resetLiteratureCancelledAction();

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { matrix } = await loadThesisMatrixAndBoxes(userId);
    if (!matrix) return { error: "Tez matrisi bulunamadı." };
    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      logger,
      matrix.subjectProblem,
      () => isLiteratureCancelled(userId),
      async (thesisBoxId, articles) => {
        await persistSubBoxEntry(thesisBoxId, articles);
      },
    );

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    return { data: poolEntries };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    logger.error("literature_batch_process_failed", {
      error: err,
    });
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
  const logger = new Logger(createFlowId());
  const pipelineStart = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;
    await resetLiteratureCancelledAction();

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { matrix } = await loadThesisMatrixAndBoxes(userId);
    const subjectProblem = matrix?.subjectProblem ?? "";

    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      logger,
      subjectProblem,
      () => isLiteratureCancelled(userId),
      async (thesisBoxId, articles) => {
        await persistSubBoxEntry(thesisBoxId, articles);
      },
    );

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    logger.info("literature_pool_persist_start");
    await persistLiteraturePool(poolEntries);
    logger.info("literature_pool_persist_success");

    await persistRelatedTheses(userId);

    try {
      revalidateOnboardingPaths();
    } catch (err) {
      logger.warn("literature_pipeline_revalidate_failed", {
        service: "literature",
        error: err,
      });
    }
    invalidateOnboardingCache();

    logger.info("literature_pipeline_success", {
      data: { durationMs: Math.round(performance.now() - pipelineStart) },
    });

    return { data: poolEntries };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    logger.error("literature_pipeline_failed", {
      error: err,
    });
    return { error: message };
  }
}
