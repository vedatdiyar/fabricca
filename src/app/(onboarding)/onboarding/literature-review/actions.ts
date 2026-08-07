"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { matrices, users } from "@/db/schema";
import { Logger, createFlowId } from "@/lib/logger";
import {
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ERROR_MSG,
} from "@/lib/session";
import type { LiteraturePoolEntry, OnboardingActionResult } from "@/lib/types";
import type { SubBoxInput } from "./_services/literature-review-papers";
import { orchestrateBatchProcess } from "./_services/batch-orchestrator";
import {
  persistLiteraturePool,
  persistArchiveEntries,
  persistSubBoxEntry,
  persistRelatedTheses,
  fetchPreloadedPool,
} from "./_services/literature-persistence";
import { loadThesisMatrixAndBoxes } from "./_services/process-boxes-data";

const _cancelFlags = new Map<number, boolean>();

/** Signals the running pipeline to stop, called from the client cancel callback. */
export async function setLiteratureCancelledAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    _cancelFlags.set(session.userId, true);
  }
}

/** Resets the cancel flag before a fresh pipeline run. */
export async function resetLiteratureCancelledAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    _cancelFlags.set(session.userId, false);
  }
}

/**
 * Checks whether a cancellation has been requested for the given user.
 *
 * @param userId - The database ID of the user.
 * @returns True when cancellation is requested, false otherwise.
 */
function isLiteratureCancelled(userId: number): boolean {
  return _cancelFlags.get(userId) ?? false;
}

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
    _cancelFlags.set(userId, false);

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { matrix } = await loadThesisMatrixAndBoxes(userId);
    if (!matrix) return { error: "Thesis matrix not found." };
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
    const message = err instanceof Error ? err.message : "Unexpected error";
    logger.error("literature_batch_process_failed", {
      error: err,
    });
    return { error: message };
  }
}

/**
 * Persists the confirmed literature pool to the database.
 *
 * @param args - The confirmation payload.
 * @param args.literaturePool - The literature pool entries to persist.
 * @returns The action result indicating success or an error.
 */
export async function confirmLiteratureAction(args: {
  literaturePool: LiteraturePoolEntry[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("confirm_literature_start");

  try {
    const session = await getSession();
    if (!session) {
      return { error: SESSION_ERROR_MSG };
    }

    const { literaturePool } = args;
    if (!literaturePool || literaturePool.length === 0) {
      return { error: "No literature data found to confirm." };
    }

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return { error: "Thesis matrix not found." };
    }

    await persistLiteraturePool(literaturePool);

    try {
      revalidateOnboardingPaths();
    } catch {}

    invalidateOnboardingCache();

    log.info("confirm_literature_success", {
      durationMs: performance.now() - startTime,
    });

    return { success: true };
  } catch (err) {
    log.error("confirm_literature_failed", {
      error: err,
    });
    return {
      error:
        err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Returns the preloaded literature pool for the current user.
 *
 * @returns The preloaded pool entries or an error message.
 */
export async function fetchPreloadedLiteraturePool(): Promise<{
  data?: LiteraturePoolEntry[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { error: SESSION_ERROR_MSG };

  const [matrix] = await db
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, session.userId));

  if (!matrix) return { error: "Thesis matrix not found." };

  const pool = await fetchPreloadedPool(matrix.id);

  return { data: pool };
}

/**
 * Persists manual archive entries to the database.
 *
 * @param args - The archive append payload.
 * @param args.entries - The archive entries to persist per thesis box.
 * @returns The action result indicating success or an error.
 */
export async function appendArchiveEntriesAction(args: {
  entries: {
    thesisBoxId: number;
    articles: import("@/lib/types").JuryArticle[];
  }[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("append_archive_start");

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { entries } = args;
    if (!entries || entries.length === 0) {
      return { error: "No archive entries found to append." };
    }

    await persistArchiveEntries(entries, (msg) => {
      log.info(msg);
    });

    try {
      revalidateOnboardingPaths();
    } catch {}

    invalidateOnboardingCache();

    log.info("append_archive_success");

    return { success: true };
  } catch (err) {
    log.error("append_archive_failed", {
      error: err,
    });
    return {
      error:
        err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Marks onboarding as completed for the current user and updates the session cookie.
 *
 * @returns The action result indicating success or an error.
 */
export async function finalizeOnboardingAction(): Promise<OnboardingActionResult> {
  const log = new Logger(createFlowId());

  log.info("finalize_onboarding_start");

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [, cookieStore] = await Promise.all([
      db
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, session.userId)),
      cookies(),
    ]);

    try {
      cookieStore.set(
        SESSION_COOKIE_NAME,
        JSON.stringify({
          userId: session.userId,
          name: session.name,
          onboardingCompleted: true,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE_SECONDS,
        },
      );
    } catch {}

    try {
      revalidateOnboardingPaths();
    } catch {}

    invalidateOnboardingCache();

    log.info("finalize_onboarding_success");

    return { success: true };
  } catch (err) {
    log.error("finalize_onboarding_failed", {
      error: err,
    });
    return {
      error:
        err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Checks whether a literature pool already exists for the current user.
 *
 * @returns The existing pool entries and whether a pool exists, or an error.
 */
export async function checkLiteraturePoolAction(): Promise<{
  data?: LiteraturePoolEntry[];
  exists: boolean;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) return { exists: false, error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { exists: false, error: "Thesis matrix not found." };

    const pool = await fetchPreloadedPool(matrix.id);
    if (pool && pool.length > 0) {
      return { data: pool, exists: true };
    }

    return { exists: false };
  } catch (err) {
    return {
      exists: false,
      error: err instanceof Error ? err.message : "Unexpected error",
    };
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
    _cancelFlags.set(userId, false);

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
    } catch {}
    invalidateOnboardingCache();

    logger.info("literature_pipeline_success", {
      data: { durationMs: Math.round(performance.now() - pipelineStart) },
    });

    return { data: poolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    logger.error("literature_pipeline_failed", {
      error: err,
    });
    return { error: message };
  }
}
