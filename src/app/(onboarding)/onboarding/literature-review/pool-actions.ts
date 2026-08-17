"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import { matrices } from "@/db/schema";
import { Logger, createFlowId } from "@/lib/logger";
import { handleActionError } from "@/lib/errors/handle-error";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import type { LiteraturePoolEntry, OnboardingActionResult } from "@/lib/types";
import {
  persistLiteraturePool,
  persistRelatedTheses,
  fetchPreloadedPool,
} from "@/features/literature-review/literature-persistence";

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
      return { error: "Onaylanacak literatür verisi bulunamadı." };
    }

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    await persistLiteraturePool(literaturePool);
    await persistRelatedTheses(session.userId);

    try {
      revalidateOnboardingPaths();
    } catch (err) {
      log.warn("confirm_literature_revalidate_failed", {
        service: "literature",
        error: err,
      });
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

/**
 * Returns the preloaded literature pool for the current user.
 *
 * @returns The preloaded pool entries or an error message.
 */
export async function fetchPreloadedLiteraturePool(): Promise<{
  data?: LiteraturePoolEntry[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const pool = await fetchPreloadedPool(matrix.id);

    return { data: pool };
  } catch (err) {
    return handleActionError(err);
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

    if (!matrix) return { exists: false, error: "Tez matrisi bulunamadı." };

    const pool = await fetchPreloadedPool(matrix.id);
    if (pool && pool.length > 0) {
      return { data: pool, exists: true };
    }

    return { exists: false };
  } catch (err) {
    return {
      exists: false,
      error:
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
