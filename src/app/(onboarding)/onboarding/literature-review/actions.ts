"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { thesisMatrices, users } from "@/db/schema";
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
  fetchPreloadedPool,
} from "./_services/literature-persistence";
import { loadThesisMatrixAndBoxes } from "./_services/process-boxes-data";

// ============================================================================
// Session-based cancellation flags — keyed by userId so concurrent users
// do not interfere with each other's pipeline.
// ============================================================================
const _cancelFlags = new Map<number, boolean>();

/** Called by the client cancel callback to signal the running pipeline to stop. */
export async function setLiteratureCancelledAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    _cancelFlags.set(session.userId, true);
  }
}

/** Called by the client to reset the flag before a fresh pipeline run. */
export async function resetLiteratureCancelledAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    _cancelFlags.set(session.userId, false);
  }
}

function isLiteratureCancelled(userId: number): boolean {
  return _cancelFlags.get(userId) ?? false;
}

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

    const thesisArticlesMap = new Map<
      string,
      import("@/lib/types").JuryArticle[]
    >();
    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      logger,
      thesisArticlesMap,
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
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!matrix) {
      return { error: "Thesis matrix not found." };
    }

    await persistLiteraturePool(literaturePool);

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }

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

export async function fetchPreloadedLiteraturePool(): Promise<{
  data?: LiteraturePoolEntry[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { error: SESSION_ERROR_MSG };

  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, session.userId));

  if (!matrix) return { error: "Thesis matrix not found." };

  const pool = await fetchPreloadedPool(matrix.id);

  return { data: pool };
}

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
      log.warn(msg);
    });

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }

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
    } catch {
      // Session cookie update skipped
    }

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }

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
 * Runs the full literature review pipeline as a single server action with
 * 6 sequential sub-steps + a final top-level total log:
 *   1. literature_db_kontrol      — check for pre-existing literature pool
 *   2. literature_openalex_search — OpenAlex parallel search + clustering
 *   3. literature_foundational_selection — bulk foundational-work selection (Gemini)
 *   4. literature_related_selection — related-article assignment per sub-box
 *   5. literature_sanitization    — bulk title/author cleanup (LLM)
 *   6. literature_db_write        — persist the full literature pool
 *   7. literature_toplam          — final total duration and summary
 *
 * @param boxes   Sub-box inputs to feed the AI pipeline
 * @param thesisArticlesMap  Optional pre-loaded RELATED_THESES articles
 * @returns The literature pool entries or a user-facing error message
 */
export async function runLiteraturePipelineAction(
  boxes: SubBoxInput[],
  thesisArticlesMap?: Map<string, import("@/lib/types").JuryArticle[]>,
): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> {
  const logger = new Logger(createFlowId());
  const pipelineStart = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const userId = session.userId;
    _cancelFlags.set(userId, false);

    // ── Step 1: DB kontrol ──────────────────────────────────────────────
    logger.info("literature_db_kontrol_start");

    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (!matrix) return { error: "Thesis matrix not found." };

    const existingPool = await fetchPreloadedPool(matrix.id);
    if (existingPool && existingPool.length > 0) {
      logger.info("literature_db_kontrol_success");
      logger.info("literature_db_write_success");
      logger.info("literature_toplam", {
        data: { durationMs: Math.round(performance.now() - pipelineStart) },
      });

      return { data: existingPool };
    }

    logger.info("literature_db_kontrol_success");

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    // ── Steps 2-5: orchestrateBatchProcess (logs internally) ────────────
    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      logger,
      thesisArticlesMap ?? new Map(),
      () => isLiteratureCancelled(userId),
      async (thesisBoxId, articles) => {
        await persistSubBoxEntry(thesisBoxId, articles);
      },
    );

    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    // ── Step 6: DB write ────────────────────────────────────────────────
    logger.info("literature_db_write_start");

    await persistLiteraturePool(poolEntries);

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }
    invalidateOnboardingCache();

    logger.info("literature_db_write_success");

    // ── Toplam ──────────────────────────────────────────────────────────
    logger.info("literature_toplam", {
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
