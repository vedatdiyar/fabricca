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
  RawPaper,
  ValidatedPaper,
} from "./_services/literature-review-papers";
import { mergePapers } from "./_services/literature-review-papers";
import {
  searchOpenAlex,
  searchOpenAlexKeyword,
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
 * Runs the full 6-stage pipeline for a single sub-box:
 * 1. OpenAlex search (semantic + keyword fallback + foundational)
 * 2. DOI-based deduplication
 * 3. AI sifting
 * 4. Full abstract recovery
 * 5. AI jury analysis → starter pack + reserved pool
 * 6. CrossRef polite-pool validation
 */
async function processSingleBox(
  subBox: SubBoxInput,
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    historicalSpatialLimits: string;
  },
  logger: Logger,
): Promise<LiteratureReviewResult> {
  if (!subBox.semanticSearchBlock.trim()) {
    return { starterPack: [], reservedPool: [] };
  }

  // ------------------------------------------------------------------
  // Stage 1: OpenAlex search (semantic vector + keyword fallback + foundational)
  // ------------------------------------------------------------------
  logger.info("literature_search_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: { queryCount: 1, subBoxTitle: subBox.title },
  });

  const searchStart = performance.now();

  const searchCalls: Promise<RawPaper[]>[] = [
    searchOpenAlex(subBox.semanticSearchBlock),
    searchOpenAlexKeyword(subBox.title),
  ];
  if (subBox.foundationalQueries && subBox.foundationalQueries.length > 0) {
    const foundationalPromise = resolveFoundationalWorks(
      subBox.foundationalQueries,
      logger,
    );
    searchCalls.push(
      foundationalPromise.then((foundational) =>
        foundational.map(
          (fw): RawPaper => ({
            source: "openalex" as const,
            title: fw.title,
            abstract: null,
            metadata: null,
            doi: null,
            url: fw.id,
            authors: [],
            year: fw.publicationYear,
            publisher: null,
            openAlexId: fw.id,
            isFoundational: true,
            relevanceScore: 1.0,
          }),
        ),
      ),
    );
  }

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
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: { resultCount: allRaw.length },
  });

  if (allRaw.length === 0) {
    return { starterPack: [], reservedPool: [] };
  }

  // ------------------------------------------------------------------
  // Stage 2: Multi-strategy deduplication
  // ------------------------------------------------------------------
  const mergeStart = performance.now();
  const merged = mergePapers(allRaw);

  logger.info("literature_merge_done", {
    service: "literature",
    durationMs: performance.now() - mergeStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: { mergedCount: merged.length },
  });

  const rawApiPool = merged;

  // ------------------------------------------------------------------
  // Stage 3: AI Sifting (foundational papers bypass with score 100)
  // ------------------------------------------------------------------
  const siftStart = performance.now();

  const foundationalPapers = merged.filter((p) => p.isFoundational);
  const nonFoundationalPapers = merged.filter((p) => !p.isFoundational);

  const siftedNonFoundational = await runSiftingStage(
    subBox,
    nonFoundationalPapers,
    logger,
    thesisCtx,
  );

  for (const fp of foundationalPapers) {
    (fp as unknown as Record<string, unknown>).siftingScore = 100;
  }

  const sifted = [...foundationalPapers, ...siftedNonFoundational];

  logger.info("literature_sifting_done", {
    service: "literature",
    durationMs: performance.now() - siftStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      before: merged.length,
      after: sifted.length,
      foundationalBypassed: foundationalPapers.length,
    },
  });

  if (sifted.length === 0) {
    return { starterPack: [], reservedPool: [] };
  }

  // ------------------------------------------------------------------
  // Stage 4: Full Abstract Recovery (post-sifting)
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
  }

  logger.info("literature_abstract_recovery_done", {
    service: "literature",
    durationMs: performance.now() - abstractStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      requestedCount: siftedIds.length,
      resolvedCount: abstractMap.size,
    },
  });

  // ------------------------------------------------------------------
  // Stage 5: AI Jury Analysis
  // ------------------------------------------------------------------
  const juryStart = performance.now();
  const result = await runJuryStage(subBox, sifted, logger);

  logger.info("literature_jury_done", {
    service: "literature",
    durationMs: performance.now() - juryStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      starterPackCount: result.starterPack.length,
      reservedPoolCount: result.reservedPool.length,
      foundationalCount: foundationalPapers.length,
    },
  });

  // ------------------------------------------------------------------
  // Foundational Bypass: Force foundational papers into starterPack as PRIMARY
  // ------------------------------------------------------------------
  if (foundationalPapers.length > 0) {
    const foundationalJuryArticles: JuryArticle[] = foundationalPapers.map(
      (fp) => ({
        type: "PRIMARY" as const,
        title: fp.title,
        abstract: fp.abstract ?? "",
        url: fp.url ?? "",
        doi: fp.doi ?? "",
        publisher: fp.publisher ?? "",
        publicationYear: fp.year ?? 0,
        authors: fp.authors,
        isFoundational: true,
      }),
    );

    const foundationalTitles = new Set(
      foundationalPapers
        .map((fp) => fp.title?.toLowerCase().trim())
        .filter(Boolean),
    );

    result.starterPack = [
      ...foundationalJuryArticles,
      ...result.starterPack.filter(
        (a) =>
          !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
      ),
    ];

    result.reservedPool = result.reservedPool.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );
  }

  // ------------------------------------------------------------------
  // Stage 6: CrossRef polite-pool validation (concurrency-limited)
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
    },
  });

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
        historicalSpatialLimits: thesisMatrices.historicalSpatialLimits,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    const settled = await Promise.allSettled(
      subBoxes.map((box) => processSingleBox(box, thesisCtx, logger)),
    );

    const results: LiteratureReviewResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
        const boxTitle = subBoxes[i]?.title ?? `index ${i}`;
        logger.error("literature_box_failed", {
          service: "literature",
          filePath: "onboarding/literature-review/actions.ts",
          data: { subBoxTitle: boxTitle },
          error: s.reason,
        });
        results.push({
          starterPack: [],
          reservedPool: [],
          error: `Kutu "${boxTitle}" işlenirken hata: ${s.reason?.message ?? "Bilinmeyen hata"}`,
        });
      }
    }

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

  log.info({
    step: "confirmLiterature",
    service: "literature",
  });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({
        step: "confirmLiterature",
        status: "FAILED",
        service: "literature",
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
        service: "literature",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Literatür havuzu boş.",
        },
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
    const totalResourceCount = literaturePool.reduce(
      (sum, entry) =>
        sum + entry.starterPack.length + entry.reservedPool.length,
      0,
    );

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

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "confirmLiterature",
      status: "SUCCESS",
      service: "literature",
      data: { resultCount: totalResourceCount },
      metrics: { duration },
    });

    return { success: true };
  } catch (err) {
    log.error({
      step: "confirmLiterature",
      status: "FAILED",
      service: "literature",
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
