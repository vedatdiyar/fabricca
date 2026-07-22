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
import {
  loadThesisMatrixAndBoxes,
  loadOverlapTheses,
} from "./_services/process-boxes-data";

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

    const { matrix, allBoxRows } = await loadThesisMatrixAndBoxes(userId);
    if (!matrix) return { error: "Thesis matrix not found." };
    if (isLiteratureCancelled(userId)) return { error: "cancelled" };

    const { thesisArticlesMap } = await loadOverlapTheses(allBoxRows);
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
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
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

  log.info("confirm_literature_start", { service: "literature" });

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
      service: "literature",
      durationMs: performance.now() - startTime,
      data: {
        resultCount: literaturePool.reduce(
          (sum, entry) => sum + entry.articles.length,
          0,
        ),
      },
    });

    return { success: true };
  } catch (err) {
    log.error("confirm_literature_failed", {
      service: "literature",
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

  log.info("append_archive_start", { service: "literature" });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { entries } = args;
    if (!entries || entries.length === 0) {
      return { error: "No archive entries found to append." };
    }

    await persistArchiveEntries(entries, (msg, data) => {
      log.warn(msg, { service: "literature", data });
    });

    try {
      revalidateOnboardingPaths();
    } catch {
      // Revalidation path skipped
    }

    invalidateOnboardingCache();

    log.info("append_archive_success", { service: "literature" });

    return { success: true };
  } catch (err) {
    log.error("append_archive_failed", {
      service: "literature",
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

    log.info("finalize_onboarding_success", { service: "literature" });

    return { success: true };
  } catch (err) {
    log.error("finalize_onboarding_failed", {
      service: "literature",
      error: err,
    });
    return {
      error:
        err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
