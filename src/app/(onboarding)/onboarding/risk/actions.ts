"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { originalityReports } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type {
  ScrapedTheses,
  TezaraThesisSummary,
  OriginalityReportData,
  ThesisMatrix,
} from "@/lib/types";

import { extractQueries } from "./_services/queries";
import { siftAndFetchDetails } from "./_services/sifting";
import { analyzeOriginalityRisk } from "./_services/analysis";
import { calculateRelationships } from "./_services/decision-engine";
import type { CalculatedComparisonItem } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { BADGE_ORDER_PRIORITY, BUCKET_ORDER } from "./_lib/sort-utils";
import { searchTezara } from "@/lib/tezara";

type OnboardingMatrixInput = ThesisMatrix;

/**
 * Step 1: Extracts Tezara keyword combinations and literature keywords
 * from the thesis matrix using Gemini.
 * No database writes.
 *
 * @param matrix - The thesis matrix input
 * @returns Extracted query strings and keywords, or an error message
 */
export async function extractQueriesAction(
  matrix: OnboardingMatrixInput,
): Promise<
  | {
      success: true;
      data: {
        tezaraQueries: string[];
      };
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_query_extract_start", {
    service: "originality",
    data: { context: matrix.researchFocus },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { tezaraQueries } = await extractQueries(matrix, log);

    log.info("originality_query_extract_success", {
      service: "originality",
      data: { context: matrix.researchFocus },
    });

    return {
      success: true,
      data: { tezaraQueries },
    };
  } catch (err) {
    log.error("originality_query_extract_failed", {
      service: "originality",
      error: err,
      data: { context: matrix.researchFocus },
    });
    return {
      error: "An error occurred while extracting queries and parameters.",
    };
  }
}

/**
 * Step 2: Executes Tezara search queries.
 * No database writes.
 *
 * @param params - Study title and query array for Tezara
 * @returns Raw search results from Tezara, or an error
 */
export async function executeSearchAction(params: {
  researchFocus: string;
  tezaraQueries: string[];
}): Promise<
  | {
      success: true;
      data: {
        tezaraSearchResults: TezaraThesisSummary[][];
      };
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_search_execute_start", {
    service: "originality",
    data: { context: params.researchFocus },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const tezaraSearchResults = await Promise.all(
      params.tezaraQueries.map(async (query) => {
        try {
          return await searchTezara(query, log, true);
        } catch (err) {
          log.error("originality_search_tezara_failed", {
            service: "originality",
            error: err,
            data: { query, context: `Query: ${query}` },
          });
          return [];
        }
      }),
    );

    log.info("originality_search_execute_success", {
      service: "originality",
      data: { context: params.researchFocus },
    });

    return {
      success: true,
      data: { tezaraSearchResults },
    };
  } catch (err) {
    log.error("originality_search_execute_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchFocus },
    });
    return {
      error: "An error occurred while executing the Tezara search.",
    };
  }
}

/**
 * Step 3: Sifts and fetches details for the Tezara candidates using
 * Cohere rerank (top 20), then returns all valid theses
 * directly for classification analysis.
 * No database writes.
 *
 * @param params - Thesis matrix and raw Tezara search results
 * @returns Structured ScrapedTheses object with selected and eliminated theses, or an error
 */
export async function siftThesesAction(params: {
  matrix: OnboardingMatrixInput;
  tezaraSearchResults: TezaraThesisSummary[][];
}): Promise<{ success: true; data: ScrapedTheses } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_theses_sift_start", {
    service: "originality",
    data: { context: params.matrix.researchFocus },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { finalTheses, eliminatedTheses } = await siftAndFetchDetails(
      {
        mainActors: params.matrix.mainActors,
        researchFocus: params.matrix.researchFocus,
        temporalScope: params.matrix.temporalScope,
        spatialScope: params.matrix.spatialScope,
        theoreticalFramework: params.matrix.theoreticalFramework,
        methodology: params.matrix.methodology,
        mainClaim: params.matrix.mainClaim,
      },
      params.tezaraSearchResults,
      log,
    );

    log.info("originality_theses_sift_success", {
      service: "originality",
      data: { context: params.matrix.researchFocus },
    });

    return {
      success: true,
      data: { selected: finalTheses, eliminated: eliminatedTheses },
    };
  } catch (err) {
    log.error("originality_theses_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.researchFocus },
    });
    return {
      error: "An error occurred while sifting theses and fetching details.",
    };
  }
}

/**
 * Step 4: Runs the Gemini classification analysis in batches of 3,
 * applies the deterministic decision engine (RİSK / KATKI / GÜRÜLTÜ),
 * and writes the complete report to the originality_reports table as a
 * single transaction.
 *
 * @param params - Thesis matrix and scraped theses
 * @returns The complete originality report data, or an error message
 */
export async function finalizeJuryAnalysisAction(params: {
  matrix: OnboardingMatrixInput;
  scrapedTheses: ScrapedTheses;
}): Promise<
  { success: true; data: OriginalityReportData | null } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const juryStart = performance.now();

  log.groupStart("originality_jury_finalize");

  try {
    const session = await getSession();
    if (!session) {
      log.groupEnd("originality_jury_finalize", performance.now() - juryStart);
      return { error: SESSION_ERROR_MSG };
    }

    const validDetails = params.scrapedTheses.selected;

    // NO_MATCH_FOUND: No theses eligible for analysis — clears DB, returns null
    if (validDetails.length === 0) {
      log.groupEnd("originality_jury_finalize", performance.now() - juryStart);
      await db
        .delete(originalityReports)
        .where(eq(originalityReports.userId, session.userId));
      updateTag(CACHE_TAGS.originalityReport);
      return { success: true, data: null };
    }

    // ── LLM sınıflandırma analizi (3'erli batch, ThinkingLevel.HIGH) ──
    const { llmResults } = await analyzeOriginalityRisk(
      {
        mainActors: params.matrix.mainActors,
        researchFocus: params.matrix.researchFocus,
        temporalScope: params.matrix.temporalScope,
        spatialScope: params.matrix.spatialScope,
        theoreticalFramework: params.matrix.theoreticalFramework,
        methodology: params.matrix.methodology,
        mainClaim: params.matrix.mainClaim,
        selectedTheses: validDetails,
      },
      log,
    );

    // ── Deterministik karar motoru — GÜRÜLTÜ elenir, RİSK/KATKI sınıflanır ──
    const relationshipResult = calculateRelationships(
      llmResults,
      validDetails,
      log,
    );

    // ── Priority-ordered stable sorting ──
    relationshipResult.comparisonTable.sort(
      (a: CalculatedComparisonItem, b: CalculatedComparisonItem) => {
        if (a.bucket !== b.bucket) {
          return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
        }
        const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
        const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
        if (pA !== pB) return pA - pB;
        // Same badge: higher relevance score first
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Tiebreaker: newest first
        return b.year - a.year;
      },
    );

    const activeTheses = relationshipResult.comparisonTable.filter(
      (item) => item.bucket !== "IRRELEVANT",
    );

    // ── Akademik standardizasyon (Sadece aktif/elenmemiş tezler için) ──
    if (activeTheses.length > 0) {
      const sanitized = await sanitizeAcademicDataBulk(
        activeTheses.map((item) => ({
          title: item.title,
          author: item.author,
        })),
      );
      for (let i = 0; i < activeTheses.length; i++) {
        if (sanitized[i]) {
          activeTheses[i].title = sanitized[i].title;
          activeTheses[i].author = sanitized[i].author;
        }
      }
    }

    const buildDimensions = (item: CalculatedComparisonItem) => ({
      researchFocus: item.researchFocus,
      mainActors: item.mainActors,
      temporalScope: item.temporalScope,
      spatialScope: item.spatialScope,
      theoreticalFramework: item.theoreticalFramework,
      methodology: item.methodology,
      mainClaim: item.mainClaim,
    });

    const reportData: OriginalityReportData = {
      tezaraResults: {
        relationshipBadge: relationshipResult.globalRelationshipBadge,
        overlapTable: activeTheses.map((item) => ({
          id: item.id,
          primaryBadge: item.primaryBadge,
          badges: item.badges,
          yokPdfUrl: item.yokPdfUrl,
          abstract: item.abstract,
          title: item.title,
          author: item.author,
          university: item.university,
          year: item.year,
          thesisType: item.thesisType,
          department: item.department,
          relevanceScore: item.relevanceScore,
          dimensionScores: buildDimensions(item),
        })),
        eliminatedTheses: [], // Elenen tezler UI katmanına gönderilmez
      },
    };

    // ── Transactional write: eski kayıtları sil, sadece aktif tezleri yaz ──
    const dbRows = activeTheses.map((item) => ({
      userId: session.userId,
      externalThesisId: item.id,
      title: item.title,
      author: item.author,
      university: item.university,
      year: item.year,
      thesisType: item.thesisType,
      department: item.department,
      yokPdfUrl: item.yokPdfUrl ?? null,
      abstract: item.abstract ?? null,
      diagnosis: item.primaryBadge,
      relevanceScore: item.relevanceScore,
      researchFocusScore: item.researchFocus,
      mainActorsScore: item.mainActors,
      temporalScopeScore: item.temporalScope.score,
      temporalScopeLabel: item.temporalScope.label,
      spatialScopeScore: item.spatialScope,
      theoreticalFrameworkScore: item.theoreticalFramework,
      methodologyScore: item.methodology,
      mainClaimScore: item.mainClaim,
      academicTactic: "",
      isEliminated: false,
      eliminationStage: null,
      updatedAt: new Date(),
    }));

    await db.transaction(async (tx) => {
      await tx
        .delete(originalityReports)
        .where(eq(originalityReports.userId, session.userId));

      if (dbRows.length > 0) {
        await tx.insert(originalityReports).values(dbRows);
      }
    });

    log.groupEnd("originality_jury_finalize", performance.now() - juryStart);
    updateTag(CACHE_TAGS.originalityReport);

    return { success: true, data: reportData };
  } catch (err) {
    const durationMs = performance.now() - juryStart;
    log.error("originality_jury_finalize_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.matrix.researchFocus },
    });
    log.groupEnd("originality_jury_finalize", durationMs);
    return {
      error:
        "An error occurred while preparing the analysis and relationship report.",
    };
  }
}
