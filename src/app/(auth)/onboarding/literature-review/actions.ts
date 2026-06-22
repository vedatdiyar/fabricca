"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  users,
} from "@/db/schema";
import { getSession } from "@/session";
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
  resolveFoundationalWorks,
  fetchFullAbstracts,
  enrichFinalArticles,
} from "./_services/search-api";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";
import {
  runAcademicReviewStage,
  deduplicateCandidatesGlobally,
  type LiteratureReviewResult,
} from "./_services/ai-processor";

// ============================================================================
// Helper: isArchivalBox — detects boxes that should bypass external APIs
// ============================================================================

function isArchivalBox(subBox: SubBoxInput): boolean {
  if (!subBox.foundationalQueries || subBox.foundationalQueries.length === 0) {
    return false;
  }
  const first = subBox.foundationalQueries[0];
  return (
    first.author === "Primary Source Repository" || first.publicationYear === 0
  );
}

// ============================================================================
// Helper: withOpenAlexRetry — retries searchOpenAlex on 429/network errors
// ============================================================================

async function withOpenAlexRetry(
  query: string,
  logger: Logger,
): Promise<RawPaper[]> {
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await searchOpenAlex(query);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_ATTEMPTS) {
        const delayMs = Math.random() * 300 + 200;
        logger.warn("openalex_rate_limit_retry", {
          service: "literature",
          filePath: "onboarding/literature-review/actions.ts",
          data: {
            attempt,
            maxAttempts: MAX_ATTEMPTS,
            delayMs: Math.round(delayMs),
            query: query.substring(0, 120),
            error: lastError.message,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error("OpenAlex isteği başarısız oldu");
}

// ============================================================================
// Helper: processSingleBox — processes a single sub-box through the pipeline
// ============================================================================

async function processSingleBox(
  subBox: SubBoxInput,
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    researchScope: string;
  },
  logger: Logger,
): Promise<LiteratureReviewResult> {
  if (isArchivalBox(subBox)) {
    logger.info("literature_archival_bypass", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      data: {
        subBoxTitle: subBox.title,
        boxType: subBox.boxType ?? "bilinmiyor",
        foundationalQueryCount: subBox.foundationalQueries?.length ?? 0,
        context: `Kutu: ${subBox.title}`,
      },
    });
    return { starterPack: [], reservedPool: [], isArchivalBypass: true };
  }

  if (
    !subBox.semanticSearchQueries ||
    subBox.semanticSearchQueries.length === 0
  ) {
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
        title: formatAcademicTitle(fw.title),
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
  // Stage 2: OpenAlex semantic search (retry-safe)
  // ------------------------------------------------------------------
  logger.info("literature_search_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: {
      queryCount: subBox.semanticSearchQueries.length,
      subBoxTitle: subBox.title,
      context: boxCtx,
    },
  });

  const searchStart = performance.now();
  const searchResultsList: RawPaper[][] = [];
  for (let qIdx = 0; qIdx < subBox.semanticSearchQueries.length; qIdx++) {
    const query = subBox.semanticSearchQueries[qIdx];
    if (!query.trim()) continue;

    const results = await withOpenAlexRetry(query, logger);
    searchResultsList.push(results);

    if (qIdx < subBox.semanticSearchQueries.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, OPENALEX_REQUEST_DELAY_MS),
      );
    }
  }
  const semanticRaw = searchResultsList.flat();

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

  // ------------------------------------------------------------------
  // Stage 4: Full Abstract Recovery (all merged papers)
  // ------------------------------------------------------------------
  const abstractStart = performance.now();
  const mergedIds: string[] = [];
  for (const p of merged) {
    if (p.openAlexId) mergedIds.push(p.openAlexId);
  }

  let abstractMap = new Map<string, string>();
  if (mergedIds.length > 0) {
    abstractMap = await fetchFullAbstracts(mergedIds, logger);
  }

  for (const p of merged) {
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
      count: mergedIds.length,
      resultCount: abstractMap.size,
      context: boxCtx,
    },
  });

  // ------------------------------------------------------------------
  // Stage 5: Single-stage AI Academic Review (eleme + jüri)
  // ------------------------------------------------------------------
  const reviewStart = performance.now();
  const result = await runAcademicReviewStage(
    subBox,
    merged,
    logger,
    thesisCtx,
  );

  // ------------------------------------------------------------------
  // Stage 5.5: Final Enrichment — Crossref künye takviyesi (top 5)
  // ------------------------------------------------------------------
  const enrichmentStart = performance.now();
  result.starterPack = await enrichFinalArticles(result.starterPack, 5, logger);
  result.reservedPool = await enrichFinalArticles(
    result.reservedPool,
    5,
    logger,
  );

  logger.info("literature_enrichment_done", {
    service: "literature",
    durationMs: performance.now() - enrichmentStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      starterPackCount: result.starterPack.length,
      reservedPoolCount: result.reservedPool.length,
      context: boxCtx,
    },
  });

  logger.info("literature_academic_review_done", {
    service: "literature",
    durationMs: performance.now() - reviewStart,
    filePath: "onboarding/literature-review/actions.ts",
    status: "SUCCESS",
    data: {
      count: merged.length,
      resultCount: result.starterPack.length + result.reservedPool.length,
      starterPackCount: result.starterPack.length,
      reservedPoolCount: result.reservedPool.length,
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

    const dedupedStarterPack = result.starterPack.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );
    const dedupedReservedPool = result.reservedPool.filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    );

    return {
      starterPack: [...foundationalArticles, ...dedupedStarterPack],
      reservedPool: dedupedReservedPool,
    };
  }

  return {
    starterPack: result.starterPack,
    reservedPool: result.reservedPool,
  };
}

// ============================================================================
// Main Action: processLiteratureReviewAction (single-box sequential)
// ============================================================================

export async function processLiteratureReviewAction(
  box: SubBoxInput,
): Promise<{ data?: LiteratureReviewResult; error?: string }> {
  const logger = new Logger(createFlowId());

  logger.info("literature_process_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: {
      context: "Kutu literatür taraması başlatıldı",
      subBoxTitle: box.title,
    },
  });

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const [thesisCtx] = await db
      .select({
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        researchScope: thesisMatrices.researchScope,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    const result = await processSingleBox(box, thesisCtx, logger);
    return { data: result };
  } catch (err) {
    const boxTitle = box.title ?? "Bilinmeyen kutu";
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    logger.error("literature_review_failed", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      data: { subBoxTitle: boxTitle },
      error: err,
    });
    return { error: message };
  }
}

// ============================================================================
// Batch Action: processAllBoxesAction — 5-stage orchestration for all boxes
// ============================================================================

/**
 * OpenAlex rate limit: minimum delay (ms) between sequential search requests.
 * OpenAlex enforces ~1 request/second for non-authenticated use.
 * 1100ms = 1s base + 100ms safety margin.
 */
const OPENALEX_REQUEST_DELAY_MS = 1100;

export async function processAllBoxesAction(
  boxes: SubBoxInput[],
): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> {
  const logger = new Logger(createFlowId());

  logger.info("literature_batch_process_start", {
    service: "literature",
    filePath: "onboarding/literature-review/actions.ts",
    data: {
      boxCount: boxes.length,
      context: "Toplu literatür taraması başlatıldı",
    },
  });

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const [thesisCtx] = await db
      .select({
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        researchScope: thesisMatrices.researchScope,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!thesisCtx) return { error: "Tez matrisi bulunamadı." };

    // ------------------------------------------------------------------
    // Phase 1: Sequential OpenAlex search with rate-limit throttle
    // ------------------------------------------------------------------
    const boxSearchResults = new Map<string, ValidatedPaper[]>();
    const archivalBoxes = new Set<string>();
    const foundationalLookups = new Map<string, { resolved: JuryArticle[] }>();

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      logger.info("literature_batch_search_start", {
        service: "literature",
        filePath: "onboarding/literature-review/actions.ts",
        data: {
          boxIndex: i,
          boxTitle: box.title,
          boxType: box.boxType ?? "bilinmiyor",
        },
      });

      // Detect archival boxes early
      if (isArchivalBox(box)) {
        archivalBoxes.add(box.title);
        boxSearchResults.set(box.title, []);
        foundationalLookups.set(box.title, { resolved: [] });

        logger.info("literature_archival_bypass", {
          service: "literature",
          filePath: "onboarding/literature-review/actions.ts",
          data: {
            subBoxTitle: box.title,
            boxType: box.boxType ?? "bilinmiyor",
            context: `Kutu: ${box.title}`,
          },
        });
        continue;
      }

      if (
        !box.semanticSearchQueries ||
        box.semanticSearchQueries.length === 0
      ) {
        boxSearchResults.set(box.title, []);
        foundationalLookups.set(box.title, { resolved: [] });
        continue;
      }

      // Foundational track (independent)
      const foundationalArticles: JuryArticle[] = [];
      if (box.foundationalQueries && box.foundationalQueries.length > 0) {
        logger.info("literature_foundational_start", {
          service: "literature",
          filePath: "onboarding/literature-review/actions.ts",
          data: {
            queryCount: box.foundationalQueries.length,
            subBoxTitle: box.title,
          },
        });

        const resolved = await resolveFoundationalWorks(
          box.foundationalQueries,
          logger,
        );

        for (const fw of resolved) {
          foundationalArticles.push({
            type: "PRIMARY" as const,
            title: formatAcademicTitle(fw.title),
            abstract: "",
            url: fw.id,
            doi: "",
            publisher: fw.publisher ?? "",
            publicationYear: fw.publicationYear,
            authors: fw.authors,
            isFoundational: true,
          });
        }
      }
      foundationalLookups.set(box.title, {
        resolved: foundationalArticles,
      });

      // OpenAlex semantic search with throttle
      const searchResultsList: RawPaper[][] = [];
      for (let qIdx = 0; qIdx < box.semanticSearchQueries.length; qIdx++) {
        const query = box.semanticSearchQueries[qIdx];
        if (!query.trim()) continue;

        const results = await withOpenAlexRetry(query, logger);
        searchResultsList.push(results);

        if (qIdx < box.semanticSearchQueries.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, OPENALEX_REQUEST_DELAY_MS),
          );
        }
      }
      const semanticRaw = searchResultsList.flat();

      logger.info("literature_batch_search_done", {
        service: "literature",
        filePath: "onboarding/literature-review/actions.ts",
        data: {
          boxTitle: box.title,
          resultCount: semanticRaw.length,
        },
      });

      // Within-box dedup
      const merged = mergePapers(semanticRaw);
      boxSearchResults.set(box.title, merged);

      // Throttle between boxes (skip last)
      if (i < boxes.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, OPENALEX_REQUEST_DELAY_MS),
        );
      }
    }

    // ------------------------------------------------------------------
    // Phase 2: Global cross-box deduplication
    // ------------------------------------------------------------------
    const dedupStart = performance.now();
    const dedupedResults = deduplicateCandidatesGlobally(
      boxSearchResults,
      logger,
    );

    logger.info("literature_global_dedup_done", {
      service: "literature",
      durationMs: performance.now() - dedupStart,
      filePath: "onboarding/literature-review/actions.ts",
      data: {
        totalBefore: [...boxSearchResults.values()].reduce(
          (s, a) => s + a.length,
          0,
        ),
        totalAfter: [...dedupedResults.values()].reduce(
          (s, a) => s + a.length,
          0,
        ),
      },
    });

    // ------------------------------------------------------------------
    // Phase 3: Full abstract recovery (surviving candidates only)
    // ------------------------------------------------------------------
    const allSurvivingIds: string[] = [];
    for (const [, candidates] of dedupedResults) {
      for (const p of candidates) {
        if (p.openAlexId) allSurvivingIds.push(p.openAlexId);
      }
    }

    let abstractMap = new Map<string, string>();
    if (allSurvivingIds.length > 0) {
      abstractMap = await fetchFullAbstracts(allSurvivingIds, logger);
    }

    for (const [, candidates] of dedupedResults) {
      for (const p of candidates) {
        if (p.openAlexId) {
          const resolved = abstractMap.get(p.openAlexId);
          if (resolved) p.abstract = resolved;
        }
        if (!p.abstract || !p.abstract.trim()) {
          p.abstract = "Özet verisi bulunamadı, başlık üzerinden değerlendirin";
        }
      }
    }

    // ------------------------------------------------------------------
    // Phase 4: Academic review (Gemini) — per box sequential
    // ------------------------------------------------------------------
    const poolEntries: LiteraturePoolEntry[] = [];

    for (const box of boxes) {
      if (archivalBoxes.has(box.title)) {
        poolEntries.push({
          subBoxTitle: box.title,
          starterPack: foundationalLookups.get(box.title)?.resolved ?? [],
          reservedPool: [],
        });
        continue;
      }

      const candidates = dedupedResults.get(box.title);
      if (!candidates || candidates.length === 0) {
        // Only foundational articles if any
        poolEntries.push({
          subBoxTitle: box.title,
          starterPack: foundationalLookups.get(box.title)?.resolved ?? [],
          reservedPool: [],
        });
        continue;
      }

      const reviewResult = await runAcademicReviewStage(
        box,
        candidates,
        logger,
        thesisCtx,
      );

      // Prepend foundational articles
      const foundationalArticles =
        foundationalLookups.get(box.title)?.resolved ?? [];
      if (foundationalArticles.length > 0) {
        const foundationalTitles = new Set(
          foundationalArticles
            .map((a) => a.title?.toLowerCase().trim())
            .filter(Boolean),
        );

        reviewResult.starterPack = reviewResult.starterPack.filter(
          (a) =>
            !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
        );
        reviewResult.reservedPool = reviewResult.reservedPool.filter(
          (a) =>
            !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
        );

        reviewResult.starterPack = [
          ...foundationalArticles,
          ...reviewResult.starterPack,
        ];
      }

      // ------------------------------------------------------------------
      // Phase 5: Crossref enrichment (top 5)
      // ------------------------------------------------------------------
      reviewResult.starterPack = await enrichFinalArticles(
        reviewResult.starterPack,
        5,
        logger,
      );
      reviewResult.reservedPool = await enrichFinalArticles(
        reviewResult.reservedPool,
        5,
        logger,
      );

      poolEntries.push({
        subBoxTitle: box.title,
        starterPack: reviewResult.starterPack,
        reservedPool: reviewResult.reservedPool,
      });
    }

    logger.info("literature_batch_process_done", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      data: {
        boxCount: boxes.length,
        totalStarterPack: poolEntries.reduce(
          (s, e) => s + e.starterPack.length,
          0,
        ),
        totalReservedPool: poolEntries.reduce(
          (s, e) => s + e.reservedPool.length,
          0,
        ),
      },
    });

    return { data: poolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    logger.error("literature_batch_process_failed", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      error: err,
    });
    return { error: message };
  }
}

// ============================================================================
// Final Action: confirmLiteratureAction
// ============================================================================

const COOKIE_NAME = "fabricca_session";

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

    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (!matrix) {
      return { error: "Tez matrisi bulunamadı." };
    }

    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      const allResources: NewLibraryResource[] = [];

      const allBoxes = await tx
        .select({ id: thesisBoxes.id, title: thesisBoxes.title })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      const boxMap = new Map<string, number>();
      for (const b of allBoxes) {
        if (boxMap.has(b.title)) {
          throw new Error(
            `Aynı başlıkta birden fazla kutu bulundu: "${b.title}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }
        boxMap.set(b.title, b.id);
      }

      for (const entry of literaturePool) {
        const subBoxTitle = entry.subBoxTitle;
        const thesisBoxId = boxMap.get(subBoxTitle);

        if (!thesisBoxId) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

        for (const article of entry.starterPack) {
          allResources.push({
            thesisBoxId,
            status: "APPROVED",
            type: article.type,
            title: formatAcademicTitle(article.title),
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi ?? null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            isRead: false,
          });
        }

        for (const article of entry.reservedPool) {
          allResources.push({
            thesisBoxId,
            status: "RESERVED",
            type: article.type,
            title: formatAcademicTitle(article.title),
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

      if (allResources.length > 0) {
        await tx
          .insert(libraryResources)
          .values(allResources)
          .onConflictDoNothing();
      }

      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
    });

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

    try {
      revalidatePath("/onboarding", "layout");
      revalidatePath("/", "layout");
    } catch {
      // Revalidation path skipped
    }

    updateTag("thesis-matrix");
    updateTag("originality-report");
    updateTag("thesis-boxes");

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
