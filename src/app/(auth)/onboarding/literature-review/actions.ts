"use server";

import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  users,
} from "@/db/schema";
import { getSession } from "@/proxy";
import { Logger, createFlowId } from "@/lib/logger";
import type {
  LiteraturePoolEntry,
  OnboardingActionResult,
} from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import type { SubBoxInput, RawPaper } from "@/lib/literature-review-papers";
import { mergePapers } from "@/lib/literature-review-papers";
import {
  searchOpenAlex,
  searchOpenAlexKeyword,
} from "./_services/search-api";
import {
  runSiftingStage,
  runJuryStage,
  enrichJuryArticleWithCrossRef,
  type LiteratureReviewResult,
} from "./_services/ai-processor";

// Re-export for consumer compatibility
export type { LiteratureReviewResult } from "./_services/ai-processor";

// ============================================================================
// Main Action: processLiteratureReviewAction
// ============================================================================

/**
 * Processes a single sub-box through the 5-stage literature review pipeline:
 * 1. OpenAlex search (semantic + keyword fallback)
 * 2. DOI-based deduplication (saved as rawApiPool)
 * 3. AI sifting — aggressive gating
 * 4. AI jury analysis → starter pack + reserved pool
 * 5. CrossRef polite-pool validation on final jury articles + abstract restore
 *
 * @param subBox - Sub-box metadata including semanticSearchBlock
 * @returns LiteratureReviewResult with starterPack and reservedPool arrays
 */
export async function processLiteratureReviewAction(
  subBox: SubBoxInput,
): Promise<{ data?: LiteratureReviewResult; error?: string }> {
  const logger = new Logger(createFlowId());

  try {
    if (!subBox.semanticSearchBlock.trim()) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Fetch thesis matrix context for global alignment
    // ------------------------------------------------------------------
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const [thesisCtx] = await db
      .select({
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        historicalSpatialLimits: thesisMatrices.historicalSpatialLimits,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    // ------------------------------------------------------------------
    // Stage 1: OpenAlex search (semantic vector + keyword fallback)
    // ------------------------------------------------------------------
    logger.info("literature_search_start", {
      service: "literature",
      data: { queryCount: 1, subBoxTitle: subBox.title },
    });

    const searchStart = performance.now();

    const searchCalls: Promise<RawPaper[]>[] = [
      searchOpenAlex(subBox.semanticSearchBlock),
      searchOpenAlexKeyword(subBox.title),
    ];
    const settled = await Promise.allSettled(searchCalls);

    const allRaw: RawPaper[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        allRaw.push(...result.value);
      }
    }

    logger.info("literature_search_done", {
      service: "literature",
      durationMs: performance.now() - searchStart,
      data: { rawCount: allRaw.length },
    });

    if (allRaw.length === 0) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Stage 2: DOI-based deduplication
    // ------------------------------------------------------------------
    const mergeStart = performance.now();
    const merged = mergePapers(allRaw);

    logger.info("literature_merge_done", {
      service: "literature",
      durationMs: performance.now() - mergeStart,
      data: { mergedCount: merged.length },
    });

    const rawApiPool = merged;

    // ------------------------------------------------------------------
    // Stage 3: AI Sifting — aggressive gating
    // ------------------------------------------------------------------
    const siftStart = performance.now();
    const sifted = await runSiftingStage(subBox, merged, logger, thesisCtx);

    logger.info("literature_sifting_done", {
      service: "literature",
      durationMs: performance.now() - siftStart,
      data: { before: merged.length, after: sifted.length },
    });

    if (sifted.length === 0) {
      return { data: { starterPack: [], reservedPool: [] } };
    }

    // ------------------------------------------------------------------
    // Stage 4: AI Jury Analysis — starter pack & reserved pool
    // ------------------------------------------------------------------
    const juryStart = performance.now();
    const result = await runJuryStage(subBox, sifted, logger);

    logger.info("literature_jury_done", {
      service: "literature",
      durationMs: performance.now() - juryStart,
      data: {
        starterPackCount: result.starterPack.length,
        reservedPoolCount: result.reservedPool.length,
      },
    });

    // ------------------------------------------------------------------
    // Stage 5: CrossRef polite-pool validation on final jury articles
    // ------------------------------------------------------------------
    const crossrefStart = performance.now();
    const [enrichedStarterPack, enrichedReservedPool] = await Promise.all([
      Promise.all(
        result.starterPack.map((a) =>
          enrichJuryArticleWithCrossRef(a, rawApiPool),
        ),
      ),
      Promise.all(
        result.reservedPool.map((a) =>
          enrichJuryArticleWithCrossRef(a, rawApiPool),
        ),
      ),
    ]);

    logger.info("literature_crossref_done", {
      service: "literature",
      durationMs: performance.now() - crossrefStart,
      data: {
        enrichedCount: enrichedStarterPack.length + enrichedReservedPool.length,
      },
    });

    return {
      data: {
        starterPack: enrichedStarterPack,
        reservedPool: enrichedReservedPool,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    logger.error("literature_review_failed", {
      service: "literature",
      error: err,
    });
    return { error: message };
  }
}

// ============================================================================
// Final Action: confirmLiteratureAction
// ============================================================================

const COOKIE_NAME = "fabricca_session";

/**
 * Finalizes the onboarding process by bulk-inserting literature review results
 * and marking the user as fully onboarded.
 *
 * 1. Validates session and retrieves the user's thesis matrix.
 * 2. In a single Drizzle transaction:
 *    a. Maps each `LiteraturePoolEntry` to sub-box DB IDs.
 *    b. Inserts starter pack articles with `status: APPROVED`.
 *    c. Inserts reserved pool articles with `status: RESERVED`.
 *    d. Sets `users.onboardingCompleted = true`.
 * 3. Updates the `fabricca_session` cookie with `onboardingCompleted: true`.
 * 4. Revalidates paths and returns success.
 *
 * @param args.literaturePool - Array of LiteraturePoolEntry from Zustand store
 * @returns OnboardingActionResult
 */
export async function confirmLiteratureAction(args: {
  literaturePool: LiteraturePoolEntry[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({ step: "confirmLiterature", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({
        step: "confirmLiterature",
        status: "FAILED",
        diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadi." },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    const { literaturePool } = args;

    if (!literaturePool || literaturePool.length === 0) {
      log.warn({
        step: "confirmLiterature",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Literatür havuzu boş.",
        },
      });
      return { error: "Onaylanacak literatür verisi bulunamadı." };
    }

    // 1. Get the user's thesis matrix
    log.info({ step: "find_matrix", status: "START", service: "db" });
    const t0 = performance.now();
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));
    log.info({
      step: "find_matrix",
      status: matrix ? "SUCCESS" : "NOT_FOUND",
      metrics: { durationMs: performance.now() - t0 },
      service: "db",
    });

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    const thesisMatrixId = matrix.id;

    // 2. Atomic transaction
    await db.transaction(async (tx) => {
      const allResources: NewLibraryResource[] = [];

      for (const entry of literaturePool) {
        // 2a. Find sub-box by thesisMatrixId + title
        const subBoxTitle = entry.subBoxTitle;
        const [box] = await tx
          .select({ id: thesisBoxes.id })
          .from(thesisBoxes)
          .where(
            and(
              eq(thesisBoxes.thesisMatrixId, thesisMatrixId),
              eq(thesisBoxes.title, subBoxTitle),
            ),
          );

        if (!box) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

        const thesisBoxId = box.id;

        // 2b. Map starter pack articles → APPROVED
        for (const article of entry.starterPack) {
          allResources.push({
            thesisBoxId,
            status: "APPROVED",
            type: article.type,
            title: article.title,
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            strategicRecommendations: article.strategicRecommendations ?? null,
            isRead: false,
          });
        }

        // 2c. Map reserved pool articles → RESERVED
        for (const article of entry.reservedPool) {
          allResources.push({
            thesisBoxId,
            status: "RESERVED",
            type: article.type,
            title: article.title,
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            strategicRecommendations: article.strategicRecommendations ?? null,
            isRead: false,
          });
        }
      }

      // 2d. Bulk insert all literature resources
      if (allResources.length > 0) {
        log.info({
          step: "insert_literature_resources",
          status: "START",
          service: "db",
          data: { count: allResources.length },
        });
        const t1 = performance.now();
        await tx.insert(libraryResources).values(allResources);
        log.info({
          step: "insert_literature_resources",
          status: "SUCCESS",
          metrics: { durationMs: performance.now() - t1 },
          service: "db",
        });
      }

      // 2e. Mark onboarding as completed
      log.info({ step: "complete_onboarding", status: "START", service: "db" });
      const t2 = performance.now();
      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
      log.info({
        step: "complete_onboarding",
        status: "SUCCESS",
        metrics: { durationMs: performance.now() - t2 },
        service: "db",
      });
    });

    // 3. Update session cookie with onboardingCompleted: true
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        COOKIE_NAME,
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
          maxAge: 60 * 60 * 24 * 7,
        },
      );
    } catch {
      log.info({
        step: "session_cookie_update_skipped",
        status: "SUCCESS",
      });
    }

    // 4. Revalidate paths
    try {
      revalidatePath("/onboarding", "layout");
      revalidatePath("/", "layout");
    } catch {
      log.info({ step: "revalidate_path_skipped", status: "SUCCESS" });
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "confirmLiterature",
      status: "SUCCESS",
      metrics: { duration, totalEntries: literaturePool.length },
    });

    return { success: true };
  } catch (err) {
    log.error({
      step: "confirmLiterature",
      status: "FAILED",
      diagnostics: {
        errorCode: "TRANSACTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      error:
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
