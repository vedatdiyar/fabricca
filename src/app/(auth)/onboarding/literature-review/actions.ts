"use server";

import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  revalidateOnboardingPaths,
  invalidateOnboardingCache,
} from "@/lib/cache-tags";
import {
  thesisMatrices,
  thesisBoxes,
  libraryResources,
  users,
} from "@/db/schema";
import { getSession } from "@/session";
import { Logger, createFlowId } from "@/lib/logger";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ERROR_MSG,
} from "@/lib/constants/session";
import type {
  LiteraturePoolEntry,
  OnboardingActionResult,
  JuryArticle,
} from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import type {
  SubBoxInput,
  RawPaper,
} from "./_services/literature-review-papers";
import { orchestrateBatchProcess } from "./_services/batch-orchestrator";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { generateStructuredContent } from "@/lib/gemini";
import {
  buildStandaloneSemanticQuerySystemInstruction,
  buildSemanticQueryPrompt,
  semanticQuerySchema,
  SemanticQueryResponseSchema,
} from "@/lib/prompts";
import type { GeminiThesisBox } from "@/lib/types";
import { processSingleBox } from "./_services/foundational-oracle";
import { searchOpenAlex } from "./_services/openalex/client";

// ============================================================================
// Batch Action: processAllBoxesAction — delegates to batch orchestrator
// ============================================================================

export async function processAllBoxesAction(
  boxes: SubBoxInput[],
  cachedPapers?: Record<string, RawPaper[]>,
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
    if (!session) return { error: SESSION_ERROR_MSG };

    // =========================================================================
    // Step 1: Load thesis matrix + existing box rows from DB
    // =========================================================================
    const [matrix] = await db
      .select({
        id: thesisMatrices.id,
        studyTitle: thesisMatrices.studyTitle,
        researchQuestion: thesisMatrices.researchQuestion,
        theoreticalFramework: thesisMatrices.theoreticalFramework,
        methodology: thesisMatrices.methodology,
        researchScope: thesisMatrices.researchScope,
        mainClaim: thesisMatrices.mainClaim,
      })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const thesisMatrixId = matrix.id;

    const allBoxRows = await db
      .select({
        id: thesisBoxes.id,
        title: thesisBoxes.title,
        parentId: thesisBoxes.parentId,
        description: thesisBoxes.description,
        boxType: thesisBoxes.boxType,
        semanticQuery: thesisBoxes.semanticQuery,
      })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

    // Index: parent title → parent DB row
    const parentByTitle = new Map<string, (typeof allBoxRows)[number]>();
    // Index: parentId → Map<child title, child DB row>
    const childrenByParent = new Map<
      number,
      Map<string, (typeof allBoxRows)[number]>
    >();

    for (const row of allBoxRows) {
      if (row.parentId === null) {
        parentByTitle.set(row.title, row);
      } else {
        let children = childrenByParent.get(row.parentId);
        if (!children) {
          children = new Map();
          childrenByParent.set(row.parentId, children);
        }
        children.set(row.title, row);
      }
    }

    // =========================================================================
    // Step 2: Semantic Query Generation
    // For each sub-box with an empty semanticQuery, call Gemini and persist.
    // =========================================================================
    const sqLimiter = createConcurrencyLimiter(3);
    const sqTasks: Promise<void>[] = [];

    for (const box of boxes) {
      const parentRow = parentByTitle.get(box.title);
      if (!parentRow) continue;

      const childMap = childrenByParent.get(parentRow.id) ?? new Map();

      for (const sub of box.subBoxes) {
        if (sub.semanticQuery?.trim()) continue;

        const childRow = childMap.get(sub.title);
        if (!childRow) continue;

        sqTasks.push(
          sqLimiter.exec(async () => {
            const result = await generateStructuredContent<{
              semanticQuery: string;
            }>(
              "gemini-3.1-flash-lite",
              buildStandaloneSemanticQuerySystemInstruction(),
              buildSemanticQueryPrompt(sub.title, childRow.description ?? ""),
              semanticQuerySchema,
              logger,
              {
                payloadStage: "semantic_query",
                zodSchema: SemanticQueryResponseSchema,
                seed: 2,
                temperature: 1.0,
              },
            );

            sub.semanticQuery = result.semanticQuery;

            await db
              .update(thesisBoxes)
              .set({ semanticQuery: result.semanticQuery })
              .where(eq(thesisBoxes.id, childRow.id));
          }),
        );
      }
    }

    await Promise.all(sqTasks);

    // =========================================================================
    // Step 3: Foundational Mining (per parent box via processSingleBox)
    // =========================================================================
    const miningLimiter = createConcurrencyLimiter(3);

    const adaptToGeminiThesisBox = (b: SubBoxInput): GeminiThesisBox => ({
      title: b.title,
      boxType: (b.boxType as GeminiThesisBox["boxType"]) ?? "CONCEPTUAL",
      description: b.description,
      parentId: null,
      semanticQuery: null,
      concepts: [],
      foundationalQueries: b.foundationalQueries,
    });

    const mineTasks = boxes.map(async (box, idx) => {
      const adapted = adaptToGeminiThesisBox(box);
      return miningLimiter.exec(async () => {
        const mined = await processSingleBox(adapted, idx, matrix, logger);
        if (!mined) return;

        box.foundationalQueries.push(mined.foundationalQuery);

        for (const sub of box.subBoxes) {
          sub.foundationalQueries.push(mined.foundationalQuery);
        }
      });
    });

    await Promise.all(mineTasks);

    // =========================================================================
    // Step 4: Cache Prefetch — use fresh semantic queries to pre-cache OpenAlex
    // =========================================================================
    const cacheLimiter = createConcurrencyLimiter(3);
    const prefetchedCache: Record<string, RawPaper[]> = {};

    const cacheTasks = boxes.map(async (box) => {
      const queries = box.subBoxes
        .map((s) => s.semanticQuery?.trim())
        .filter((q): q is string => !!q);

      if (queries.length === 0) return;

      const allPapers: RawPaper[] = [];

      for (const query of queries) {
        const papers = await cacheLimiter.exec(() => searchOpenAlex(query));
        allPapers.push(...papers);
      }

      prefetchedCache[box.title] = allPapers;
    });

    await Promise.all(cacheTasks);

    const mergedCache = { ...(cachedPapers ?? {}), ...prefetchedCache };

    // =========================================================================
    // Existing flow: load YÖK thesis entries + orchestrate
    // =========================================================================

    // Load YÖK thesis entries from library_resources (written during box confirmation)
    // These are the "İlişkisel Tez Çalışmaları" from the risk originality report,
    // identified by relevanceScore: 0.99 and a non-null boxId relationship.
    const thesisResources = await db
      .select({
        boxTitle: thesisBoxes.title,
        title: libraryResources.title,
        url: libraryResources.url,
        publisher: libraryResources.publisher,
        publicationYear: libraryResources.publicationYear,
        authors: libraryResources.authors,
        relevanceScore: libraryResources.relevanceScore,
      })
      .from(libraryResources)
      .innerJoin(thesisBoxes, eq(libraryResources.thesisBoxId, thesisBoxes.id))
      .innerJoin(
        thesisMatrices,
        eq(thesisBoxes.thesisMatrixId, thesisMatrices.id),
      )
      .where(
        and(
          eq(thesisMatrices.userId, session.userId),
          eq(libraryResources.relevanceScore, 0.99),
        ),
      );

    // Build per-box thesis article map
    const thesisArticlesMap = new Map<string, JuryArticle[]>();
    for (const row of thesisResources) {
      const entry: JuryArticle = {
        title: row.title,
        abstract: "",
        url: row.url ?? "",
        doi: null as string | null,
        publisher: row.publisher ?? "",
        publicationYear: row.publicationYear ?? 0,
        authors: (row.authors as string[]) ?? [],
        isFoundational: false,
        relevanceScore: 0.99,
      };
      const existing = thesisArticlesMap.get(row.boxTitle) ?? [];
      existing.push(entry);
      thesisArticlesMap.set(row.boxTitle, existing);
    }

    logger.info("literature_thesis_articles_loaded", {
      service: "literature",
      filePath: "onboarding/literature-review/actions.ts",
      data: {
        thesisCount: thesisResources.length,
        boxCountWithTheses: thesisArticlesMap.size,
      },
    });

    const { poolEntries } = await orchestrateBatchProcess(
      boxes,
      logger,
      mergedCache,
      thesisArticlesMap,
    );

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
      return { error: SESSION_ERROR_MSG };
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

      let totalSkipped = 0;

      for (const entry of literaturePool) {
        const subBoxTitle = entry.subBoxTitle;
        const thesisBoxId = boxMap.get(subBoxTitle);

        if (!thesisBoxId) {
          throw new Error(
            `Alt kutu bulunamadı: "${subBoxTitle}". Lütfen onboarding sürecini baştan başlatın.`,
          );
        }

        const existingRecords = await tx
          .select({ title: libraryResources.title, doi: libraryResources.doi })
          .from(libraryResources)
          .where(eq(libraryResources.thesisBoxId, thesisBoxId));

        const existingTitleSet = new Set(
          existingRecords
            .map((r) => r.title?.toLowerCase().trim())
            .filter(Boolean),
        );

        const existingDoiSet = new Set(
          existingRecords
            .map((r) => r.doi?.toLowerCase().trim())
            .filter((d): d is string => !!d),
        );

        const toInsert: NewLibraryResource[] = [];
        let boxSkipped = 0;

        const maybePushArticle = (article: (typeof entry.articles)[number]) => {
          const title = article.title;
          const titleKey = title.toLowerCase().trim();
          const doiKey = article.doi?.toLowerCase().trim() ?? null;

          if (!titleKey) {
            boxSkipped++;
            return;
          }

          if (existingTitleSet.has(titleKey)) {
            boxSkipped++;
            return;
          }

          if (doiKey && existingDoiSet.has(doiKey)) {
            boxSkipped++;
            return;
          }

          existingTitleSet.add(titleKey);
          if (doiKey) existingDoiSet.add(doiKey);

          toInsert.push({
            thesisBoxId,
            title,
            abstract: article.abstract ?? null,
            url: article.url ?? null,
            doi: article.doi?.trim() || null,
            publisher: article.publisher ?? null,
            publicationYear: article.publicationYear ?? null,
            authors: article.authors ?? null,
            isRead: false,
            isFoundational: article.isFoundational ?? false,
            relevanceScore: article.relevanceScore ?? 0,
          });
        };

        for (const article of entry.articles) maybePushArticle(article);

        if (toInsert.length > 0) {
          await tx.insert(libraryResources).values(toInsert);
        }

        if (boxSkipped > 0) {
          log.warn("confirm_literature_duplicate_skipped", {
            service: "literature",
            data: { subBoxTitle, skippedCount: boxSkipped },
          });
          totalSkipped += boxSkipped;
        }
      }

      if (totalSkipped > 0) {
        log.warn("confirm_literature_duplicates_total", {
          service: "literature",
          data: { totalSkipped },
        });
      }

      await tx
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));
    });

    try {
      const cookieStore = await cookies();
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
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}
