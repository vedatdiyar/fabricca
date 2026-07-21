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
  TezaraThesisDetails,
  OriginalityReportData,
  ThesisMatrix,
} from "@/lib/types";

import { extractQueries } from "./_services/queries";
import { siftAndFetchDetails } from "./_services/sifting";
import { analyzeOriginalityRisk } from "./_services/analysis";
import { calculateRelationships } from "./_services/decision-engine";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { sortComparisonItems } from "./_lib/sort-utils";
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
  flowId?: string,
): Promise<
  | {
      success: true;
      data: {
        tezaraQueries: string[];
      };
    }
  | { error: string }
> {
  const log = new Logger(flowId ?? createFlowId());

  log.info("originality_query_extract_start", {
    service: "originality",
    data: { context: matrix.researchCore },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { tezaraQueries } = await extractQueries(matrix, log);

    log.info("originality_query_extract_success", {
      service: "originality",
      data: { context: matrix.researchCore },
    });

    return {
      success: true,
      data: { tezaraQueries },
    };
  } catch (err) {
    log.error("originality_query_extract_failed", {
      service: "originality",
      error: err,
      data: { context: matrix.researchCore },
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
export async function executeSearchAction(
  params: {
    researchCore: string;
    tezaraQueries: string[];
  },
  flowId?: string,
): Promise<
  | {
      success: true;
      data: {
        tezaraSearchResults: TezaraThesisDetails[][];
      };
    }
  | { error: string }
> {
  const log = new Logger(flowId ?? createFlowId());

  log.info("originality_search_execute_start", {
    service: "originality",
    data: { context: params.researchCore },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const tezaraSearchResults = await Promise.all(
      params.tezaraQueries.map(async (query) => {
        try {
          return await searchTezara(query, log);
        } catch {
          return [];
        }
      }),
    );

    log.info("originality_search_execute_success", {
      service: "originality",
      data: { context: params.researchCore },
    });

    return {
      success: true,
      data: { tezaraSearchResults },
    };
  } catch (err) {
    log.error("originality_search_execute_failed", {
      service: "originality",
      error: err,
      data: { context: params.researchCore },
    });
    return {
      error: "An error occurred while executing the Tezara search.",
    };
  }
}

/**
 * Combined Step 2+3: Executes Tezara search queries and immediately sifts
 * the results through Cohere Rerank — all on the server side, no large
 * payloads transferred to the client.
 *
 * @param params - Thesis matrix + extracted Tezara queries
 * @returns Structured ScrapedTheses, or an error
 */
export async function executeSearchAndSiftAction(
  params: {
    matrix: OnboardingMatrixInput;
    tezaraQueries: string[];
  },
  flowId?: string,
): Promise<{ success: true; data: ScrapedTheses } | { error: string }> {
  const log = new Logger(flowId ?? createFlowId());

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    // Step A: Meilisearch queries
    log.info("tezara_search_start", {
      service: "originality",
      data: {
        queryCount: params.tezaraQueries.length,
        context: params.matrix.researchCore,
      },
    });

    const tezaraSearchResults = await Promise.all(
      params.tezaraQueries.map(async (query) => {
        try {
          return await searchTezara(query, log);
        } catch {
          return [];
        }
      }),
    );

    log.info("tezara_search_success", {
      service: "originality",
      data: { context: params.matrix.researchCore },
    });

    // Step B: Dedup + Cohere Rerank
    const { finalTheses, eliminatedTheses } = await siftAndFetchDetails(
      {
        researchCore: params.matrix.researchCore,
        targetActors: params.matrix.targetActors,
        context: params.matrix.context,
        framework: params.matrix.framework,
        mainClaim: params.matrix.mainClaim,
      },
      tezaraSearchResults,
      log,
    );

    return {
      success: true,
      data: { selected: finalTheses, eliminated: eliminatedTheses },
    };
  } catch (err) {
    log.error("execute_search_and_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.researchCore },
    });
    return {
      error: "An error occurred while sifting theses.",
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
export async function siftThesesAction(
  params: {
    matrix: OnboardingMatrixInput;
    tezaraSearchResults: TezaraThesisDetails[][];
  },
  flowId?: string,
): Promise<{ success: true; data: ScrapedTheses } | { error: string }> {
  const log = new Logger(flowId ?? createFlowId());

  log.info("originality_theses_sift_start", {
    service: "originality",
    data: { context: params.matrix.researchCore },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { finalTheses, eliminatedTheses } = await siftAndFetchDetails(
      {
        researchCore: params.matrix.researchCore,
        targetActors: params.matrix.targetActors,
        context: params.matrix.context,
        framework: params.matrix.framework,
        mainClaim: params.matrix.mainClaim,
      },
      params.tezaraSearchResults,
      log,
    );

    log.info("originality_theses_sift_success", {
      service: "originality",
      data: { context: params.matrix.researchCore },
    });

    return {
      success: true,
      data: { selected: finalTheses, eliminated: eliminatedTheses },
    };
  } catch (err) {
    log.error("originality_theses_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.researchCore },
    });
    return {
      error: "An error occurred while sifting theses.",
    };
  }
}

/**
 * Step 4: Runs the Gemini classification analysis,
 * applies the qualitative decision engine,
 * and writes the complete report to the originality_reports table as a
 * single transaction.
 *
 * @param params - Thesis matrix and scraped theses
 * @returns The complete originality report data, or an error message
 */
export async function finalizeJuryAnalysisAction(
  params: {
    matrix: OnboardingMatrixInput;
    selectedTheses: TezaraThesisDetails[];
  },
  flowId?: string,
): Promise<
  { success: true; data: OriginalityReportData | null } | { error: string }
> {
  const log = new Logger(flowId ?? createFlowId());

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const validDetails = params.selectedTheses;

    // NO_MATCH_FOUND: No theses eligible for analysis — clears DB, returns null
    if (validDetails.length === 0) {
      await db
        .delete(originalityReports)
        .where(eq(originalityReports.userId, session.userId));
      updateTag(CACHE_TAGS.originalityReport);
      return { success: true, data: null };
    }

    // ── LLM qualitative originality audit call ──
    const { auditResults } = await analyzeOriginalityRisk(
      {
        researchCore: params.matrix.researchCore,
        targetActors: params.matrix.targetActors,
        context: params.matrix.context,
        framework: params.matrix.framework,
        mainClaim: params.matrix.mainClaim,
        selectedTheses: validDetails,
      },
      log,
    );

    // ── Decision engine + DB persist ──
    log.info("report_persist_start", {
      service: "originality",
      data: { count: validDetails.length, context: params.matrix.researchCore },
    });

    const relationshipResult = calculateRelationships(
      auditResults,
      validDetails,
      log,
    );

    // Sort comparison items using stable priority-based sort
    relationshipResult.comparisonTable = sortComparisonItems(
      relationshipResult.comparisonTable,
    );

    const activeTheses = relationshipResult.comparisonTable.filter(
      (item) => item.bucket !== "IRRELEVANT",
    );

    // Sanitize titles and authors for active theses
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

    const eliminatedTheses = relationshipResult.comparisonTable.filter(
      (item) => item.bucket === "IRRELEVANT",
    );

    // Build qualitative report data
    const reportData: OriginalityReportData = {
      tezaraResults: {
        relationshipBadge: relationshipResult.globalRelationshipBadge,
        overlapTable: activeTheses.map((item) => ({
          id: item.id,
          title: item.title,
          author: item.author,
          university: item.university,
          year: item.year,
          thesisType: item.thesisType,
          department: item.department,
          yokPdfUrl: item.yokPdfUrl,
          abstract: item.abstract,
          isRelevant: item.isRelevant,
          relevanceExplanation: item.relevanceExplanation,
          originalityStatus: item.originalityStatus,
          uniquenessGap: item.uniquenessGap,
          replicationWarning: item.replicationWarning,
          literatureReviewUsage: item.literatureReviewUsage,
          chapterIntegration: item.chapterIntegration,
          conceptualBorrowing: item.conceptualBorrowing,
        })),
        eliminatedTheses: eliminatedTheses.map((item) => ({
          id: item.id,
          title: item.title,
          author: item.author,
          university: item.university,
          year: item.year,
          thesisType: item.thesisType,
          department: item.department,
          yokPdfUrl: item.yokPdfUrl,
          abstract: item.abstract,
          isRelevant: item.isRelevant,
          relevanceExplanation: item.relevanceExplanation,
          originalityStatus: item.originalityStatus,
          uniquenessGap: item.uniquenessGap,
          replicationWarning: item.replicationWarning,
          literatureReviewUsage: item.literatureReviewUsage,
          chapterIntegration: item.chapterIntegration,
          conceptualBorrowing: item.conceptualBorrowing,
          eliminationStage: "ANALYSIS",
        })),
      },
    };

    // Build database rows to insert
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
      isRelevant: item.isRelevant,
      relevanceExplanation: item.relevanceExplanation,
      originalityStatus: item.originalityStatus,
      uniquenessGap: item.uniquenessGap,
      replicationWarning: item.replicationWarning,
      literatureReviewUsage: item.literatureReviewUsage,
      chapterIntegration: item.chapterIntegration,
      conceptualBorrowing: item.conceptualBorrowing,
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

    log.info("report_persist_success", {
      service: "originality",
      data: {
        activeCount: activeTheses.length,
        eliminatedCount: eliminatedTheses.length,
      },
    });

    updateTag(CACHE_TAGS.originalityReport);

    return { success: true, data: reportData };
  } catch (err) {
    log.error("report_persist_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.researchCore },
    });
    return {
      error: "An error occurred while finalized the jury analysis.",
    };
  }
}
