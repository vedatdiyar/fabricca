"use server";

import { eq } from "drizzle-orm";
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
  JuryArticle,
} from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import type {
  SubBoxInput,
  ValidatedPaper,
} from "./_services/literature-review-papers";
import { mergePapers } from "./_services/literature-review-papers";
import {
  searchOpenAlex,
  resolveFoundationalWorks,
  fetchFullAbstracts,
} from "./_services/search-api";
import {
  runSiftingStage,
  runJuryStage,
  enrichJuryArticleWithCrossRef,
  type LiteratureReviewResult,
} from "./_services/ai-processor";

// ============================================================================
// Helper: enrichBatch — processes articles in concurrency-limited batches
// ============================================================================

const CROSSREF_CONCURRENCY = 5;

async function enrichBatch(
  articles: JuryArticle[],
  pool: ValidatedPaper[],
): Promise<JuryArticle[]> {
  const results: JuryArticle[] = [];
  for (let i = 0; i < articles.length; i += CROSSREF_CONCURRENCY) {
    const batch = articles.slice(i, i + CROSSREF_CONCURRENCY);
    const enriched = await Promise.all(
      batch.map((a) => enrichJuryArticleWithCrossRef(a, pool)),
    );
    results.push(...enriched);
  }
  return results;
}

// ============================================================================
// Helper: processSingleBox — processes a single sub-box through the pipeline
// ============================================================================

/**
 * Runs the full literature review pipeline for a single sub-box:
 * 1. Foundational track — resolves seminal works via OpenAlex or fallback,
 *    directly converts to JuryArticle[] (bypasses all AI stages)
 * 2. OpenAlex semantic search for non-foundational papers
 * 3. Merge + AI sifting + abstract recovery + AI jury + CrossRef validation
 *    on non-foundational papers only
 * 4. Final assembly — foundational articles prepended, duplicates removed
 */
async function processSingleBox(
  subBox: SubBoxInput,
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    historicalLimits: string;
    spatialLimits: string;
  },
  logger: Logger,
): Promise<LiteratureReviewResult> {
  if (!subBox.semanticSearchBlock.trim()) {
    return { starterPack: [], reservedPool: [] };
  }

  const boxCtx = `Kutu: ${subBox.title}`;

  // ------------------------------------------------------------------
  // Stage 1: Foundational Track (independent, bypasses AI stages)
  // ------------------------------------------------------------------
  const foundationalArticles: JuryArticle[] = [];

  if (subBox.foundationalQueries && subBox.foundationalQueries.length > 0) {
    logger.info("literature_foundational_start", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      data: {
        queryCount: subBox.foundationalQueries.length,
        subBoxTitle: subBox.title,
        context: boxCtx,
      },
    });

    const foundationalStart = performance.now();
    const resolved = await resolveFoundationalWorks(
      subBox.foundationalQueries,
      logger,
    );

    for (const fw of resolved) {
      foundationalArticles.push({
        type: "PRIMARY" as const,
        title: fw.title,
        abstract: "",
        url: fw.id,
        doi: "",
        publisher: fw.publisher ?? "",
        publicationYear: fw.publicationYear,
        authors: fw.authors,
        isFoundational: true,
      });
    }

    logger.info("literature_foundational_done", {
      service: "literature",
      durationMs: performance.now() - foundationalStart,
      filePath: "onboarding/literature-review/actions.ts",
      status: "SUCCESS",
      data: { resultCount: foundationalArticles.length, context: boxCtx },
    });
  }

  // ------------------------------------------------------------------
  // Stage 2: OpenAlex semantic search (non-foundational only)
  // ------------------------------------------------------------------
  logger.info("literature_search_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: { queryCount: 1, subBoxTitle: subBox.title, context: boxCtx },
  });

  const searchStart = performance.now();
  const semanticRaw = await searchOpenAlex(subBox.semanticSearchBlock);

  logger.info("literature_search_done", {
    service: "literature",
    durationMs: performance.now() - searchStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: { resultCount: semanticRaw.length, context: boxCtx },
  });

  if (semanticRaw.length === 0 && foundationalArticles.length === 0) {
    return { starterPack: [], reservedPool: [] };
  }

  if (semanticRaw.length === 0) {
    return { starterPack: foundationalArticles, reservedPool: [] };
  }

  // ------------------------------------------------------------------
  // Stage 3: Multi-strategy deduplication (semantic papers only)
  // ------------------------------------------------------------------
  const mergeStart = performance.now();
  const merged = mergePapers(semanticRaw);

  logger.info("literature_merge_done", {
    service: "literature",
    durationMs: performance.now() - mergeStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: { mergedCount: merged.length, context: boxCtx },
  });

  const rawApiPool = merged;

  // Patch empty abstracts before AI sifting so the model never sees
  // a null/blank abstract and discards a potentially relevant paper.
  for (const p of merged) {
    if (!p.abstract || !p.abstract.trim()) {
      p.abstract = "Özet verisi bulunamadı, başlık üzerinden değerlendirin";
    }
  }

  // ------------------------------------------------------------------
  // Stage 4: AI Sifting (semantic papers only)
  // ------------------------------------------------------------------
  const siftStart = performance.now();
  const sifted = await runSiftingStage(subBox, merged, logger, thesisCtx);

  logger.info("literature_sifting_done", {
    service: "literature",
    durationMs: performance.now() - siftStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      before: merged.length,
      after: sifted.length,
      context: boxCtx,
    },
  });

  if (sifted.length === 0) {
    return { starterPack: foundationalArticles, reservedPool: [] };
  }

  // ------------------------------------------------------------------
  // Stage 5: Full Abstract Recovery (post-sifting)
  // ------------------------------------------------------------------
  const abstractStart = performance.now();
  const siftedIds: string[] = [];
  for (const p of sifted) {
    if (p.openAlexId) siftedIds.push(p.openAlexId);
  }

  let abstractMap = new Map<string, string>();
  if (siftedIds.length > 0) {
    abstractMap = await fetchFullAbstracts(siftedIds);
  }

  for (const p of sifted) {
    if (p.openAlexId) {
      const resolved = abstractMap.get(p.openAlexId);
      if (resolved) p.abstract = resolved;
    }
    if (!p.abstract || !p.abstract.trim()) {
      p.abstract = "Özet verisi bulunamadı, başlık üzerinden değerlendirin";
    }
  }

  logger.info("literature_abstract_recovery_done", {
    service: "literature",
    durationMs: performance.now() - abstractStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      count: siftedIds.length,
      resultCount: abstractMap.size,
      context: boxCtx,
    },
  });

  // ------------------------------------------------------------------
  // Stage 6: AI Jury Analysis (semantic papers only)
  // ------------------------------------------------------------------
  const juryStart = performance.now();
  const result = await runJuryStage(subBox, sifted, logger);

  logger.info("literature_jury_done", {
    service: "literature",
    durationMs: performance.now() - juryStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      count: sifted.length,
      resultCount: result.starterPack.length + result.reservedPool.length,
      starterPackCount: result.starterPack.length,
      reservedPoolCount: result.reservedPool.length,
      context: boxCtx,
    },
  });

  // ------------------------------------------------------------------
  // Stage 7: CrossRef Polite-Pool Validation
  // ------------------------------------------------------------------
  const crossrefStart = performance.now();
  const [enrichedStarterPack, enrichedReservedPool] = await Promise.all([
    enrichBatch(result.starterPack, rawApiPool),
    enrichBatch(result.reservedPool, rawApiPool),
  ]);

  logger.info("literature_crossref_done", {
    service: "literature",
    durationMs: performance.now() - crossrefStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      enrichedCount: enrichedStarterPack.length + enrichedReservedPool.length,
      context: boxCtx,
    },
  });

  // ------------------------------------------------------------------
  // Final: Prepend foundational articles, dedup from semantic results
  // ------------------------------------------------------------------
  if (foundationalArticles.length > 0) {
    const foundationalTitles = new Set(
      foundationalArticles
        .map((a) => a.title?.toLowerCase().trim())
        .filter(Boolean),
    );

    const dedupedStarterPack = enrichedStarterPack.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );
    const dedupedReservedPool = enrichedReservedPool.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );

    return {
      starterPack: [...foundationalArticles, ...dedupedStarterPack],
      reservedPool: dedupedReservedPool,
    };
  }

  return {
    starterPack: enrichedStarterPack,
    reservedPool: enrichedReservedPool,
  };
}

// ============================================================================
// Main Action: processLiteratureReviewAction (bulk/parallel)
// ============================================================================

/**
 * Processes multiple sub-boxes through the literature review pipeline in parallel.
 * Each box goes through: OpenAlex search → dedup → AI sifting → abstract recovery
 * → jury analysis → CrossRef validation.
 *
 * @param subBoxes - Array of SubBoxInput to process concurrently
 * @returns Array of LiteratureReviewResult in the same order as the input, or an error message
 */
export async function processLiteratureReviewAction(
  subBoxes: SubBoxInput[],
): Promise<{ data?: LiteratureReviewResult[]; error?: string }> {
  const logger = new Logger(createFlowId());

  try {
    if (!subBoxes || subBoxes.length === 0) {
      return { data: [] };
    }

    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const [thesisCtx] = await db
      .select({
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        historicalLimits: thesisMatrices.historicalLimits,
        spatialLimits: thesisMatrices.spatialLimits,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    const results: LiteratureReviewResult[] = [];

    for (const box of subBoxes) {
      try {
        const result = await processSingleBox(box, thesisCtx, logger);
        results.push(result);
      } catch (err) {
        const boxTitle = box.title ?? "Bilinmeyen kutu";
        logger.error("literature_box_failed", {
          service: "literature",
          filePath: "onboarding/literature-review/actions.ts",
          data: { subBoxTitle: boxTitle },
          error: err,
        });
        results.push({
          starterPack: [],
          reservedPool: [],
          error: `Kutu "${boxTitle}" işlenirken hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`,
        });
      }

      // 1200ms delay between boxes to respect OpenAlex rate limits
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    revalidatePath("/onboarding/literature-review");

    return { data: results };
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
 * @param args - Object containing the literature pool data
 * @param args.literaturePool - Array of LiteraturePoolEntry from Zustand store
 * @returns Onboarding action result indicating success or an error message
 */
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
      log.warn("confirm_literature_failed", {
        service: "literature",
        data: { reason: "Oturum bulunamadı." },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    const { literaturePool } = args;

    if (!literaturePool || literaturePool.length === 0) {
      log.warn("confirm_literature_failed", {
        service: "literature",
        data: { reason: "Onaylanacak literatür verisi bulunamadı." },
      });
      return { error: "Onaylanacak literatür verisi bulunamadı." };
    }

    // 1. Get the user's thesis matrix
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    const thesisMatrixId = matrix.id;

    // Compute total resource count for the final summary log
    // 2. Atomic transaction
    await db.transaction(async (tx) => {
      const allResources: NewLibraryResource[] = [];

      // 2a. Bulk-fetch all boxes for this matrix (avoids N+1 queries)
      const allBoxes = await tx
        .select({ id: thesisBoxes.id, title: thesisBoxes.title })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      const boxMap = new Map(allBoxes.map((b) => [b.title, b.id]));

      for (const entry of literaturePool) {
        const subBoxTitle = entry.subBoxTitle;
        const thesisBoxId = boxMap.get(subBoxTitle);

        if (!thesisBoxId) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

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
            isRead: false,
          });
        }
      }

      // 2d. Bulk insert all literature resources
      if (allResources.length > 0) {
        await tx.insert(libraryResources).values(allResources);
      }

      // 2e. Mark onboarding as completed
      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
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
      // Session cookie update skipped
    }

    // 4. Revalidate paths
    try {
      revalidatePath("/onboarding", "layout");
      revalidatePath("/", "layout");
    } catch {
      // Revalidation path skipped
    }

    log.info("confirm_literature_success", {
      service: "literature",
      durationMs: performance.now() - startTime,
      data: {
        resultCount: literaturePool.reduce(
          (sum, entry) =>
            sum + entry.starterPack.length + entry.reservedPool.length,
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
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
