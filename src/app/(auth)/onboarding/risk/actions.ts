"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { originalityReports, thesisMatrices, thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import { createFlowId, Logger } from "@/lib/logger";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import type {
  OnboardingActionResult,
  ScrapedTheses,
  TavilyEvaluationResponse,
  TezaraThesisSummary,
  OriginalityReportData,
} from "@/lib/types";

import { extractQueries } from "./_services/queries";
import {
  executeParallelSearch,
  evaluateTavilyResults,
} from "./_services/search";
import { siftAndFetchDetails } from "./_services/sifting";
import {
  analyzeOriginalityRisk,
  calculateOriginalityRisk,
  compareThesesByRisk,
} from "./_services/analysis";
import { synthesizeRoadmap } from "./_services/roadmap";

interface OnboardingMatrixInput {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}

/**
 * Step 1: Extracts factual Tavily queries, Tezara keyword combinations,
 * and literature keywords from the thesis matrix using Gemini.
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
        tavilyQueries: string[];
        tezaraQueries: string[];
        keywords: string[];
      };
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_query_extract_start", {
    service: "originality",
    data: { context: matrix.studyTitle },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { tavilyQueries, tezaraQueries, keywords } = await extractQueries(
      {
        studyTitle: matrix.studyTitle,
        researchQuestion: matrix.researchQuestion,
        mainClaim: matrix.mainClaim,
        theoreticalFramework: matrix.theoreticalFramework,
        methodology: matrix.methodology,
        researchScope: matrix.researchScope,
      },
      log,
    );

    log.info("originality_query_extract_success", {
      service: "originality",
      data: { context: matrix.studyTitle },
    });

    return {
      success: true,
      data: { tavilyQueries, tezaraQueries, keywords },
    };
  } catch (err) {
    log.error("originality_query_extract_failed", {
      service: "originality",
      error: err,
      data: { context: matrix.studyTitle },
    });
    return {
      error: "Sorgu ve parametre çıkarma işlemi sırasında bir hata oluştu.",
    };
  }
}

/**
 * Step 2: Executes parallel Tavily and Tezara searches, then evaluates
 * Tavily fact-checking results via Gemini.
 * No database writes.
 *
 * @param params - Study title and query arrays for both search engines
 * @returns Raw search results from Tezara and evaluated Tavily response, or an error
 */
export async function executeSearchAction(params: {
  studyTitle: string;
  tavilyQueries: string[];
  tezaraQueries: string[];
}): Promise<
  | {
      success: true;
      data: {
        tezaraSearchResults: TezaraThesisSummary[][];
        tavilyResults: TavilyEvaluationResponse;
      };
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_search_execute_start", {
    service: "originality",
    data: { context: params.studyTitle },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { tavilySearchResults, tezaraSearchResults } =
      await executeParallelSearch(
        params.tavilyQueries,
        params.tezaraQueries,
        log,
      );

    const tavilyResults = await evaluateTavilyResults(
      { studyTitle: params.studyTitle },
      tavilySearchResults,
      log,
    );

    log.info("originality_search_execute_success", {
      service: "originality",
      data: { context: params.studyTitle },
    });

    return {
      success: true,
      data: { tezaraSearchResults, tavilyResults },
    };
  } catch (err) {
    log.error("originality_search_execute_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    return {
      error: "Paralel tarama motorları çalıştırılırken bir hata oluştu.",
    };
  }
}

/**
 * Step 3: Sifts and fetches details for the Tezara candidates using
 * embedding similarity (top 20), then returns all valid theses
 * directly for jury analysis (deep sifting removed — jury has elimination authority).
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
    data: { context: params.matrix.studyTitle },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const { finalTheses, eliminatedTheses } = await siftAndFetchDetails(
      {
        studyTitle: params.matrix.studyTitle,
        researchQuestion: params.matrix.researchQuestion,
        mainClaim: params.matrix.mainClaim,
        theoreticalFramework: params.matrix.theoreticalFramework,
        methodology: params.matrix.methodology,
        researchScope: params.matrix.researchScope,
      },
      params.tezaraSearchResults,
      log,
    );

    log.info("originality_theses_sift_success", {
      service: "originality",
      data: { context: params.matrix.studyTitle },
    });

    return {
      success: true,
      data: { selected: finalTheses, eliminated: eliminatedTheses },
    };
  } catch (err) {
    log.error("originality_theses_sift_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.studyTitle },
    });
    return {
      error: "Tez eleme ve detay çekme işlemi sırasında bir hata oluştu.",
    };
  }
}

/**
 * Step 4: Runs the Gemini Jury analysis (with elimination authority — may exclude
 * theses with all 4 axes original or completely irrelevant), calculates the final
 * originality risk profile, synthesizes the strategic roadmap, then writes the
 * complete report to the originality_reports table as a single upsert.
 *
 * @param params - Thesis matrix, scraped theses, and Tavily evaluation results
 * @returns The complete originality report data, or an error message
 */
export async function finalizeJuryAnalysisAction(params: {
  matrix: OnboardingMatrixInput;
  scrapedTheses: ScrapedTheses;
  tavilyResults: TavilyEvaluationResponse;
}): Promise<
  { success: true; data: OriginalityReportData } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info("originality_jury_finalize_start", {
    service: "originality",
    data: { context: params.matrix.studyTitle },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const {
      studyTitle,
      researchQuestion,
      theoreticalFramework,
      methodology,
      researchScope,
      mainClaim,
    } = params.matrix;
    const validDetails = params.scrapedTheses.selected;

    let tezaraResults: OriginalityReportData["tezaraResults"];

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ÖZGÜN",
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir.",
      };
    } else {
      const { overlapTable } = await analyzeOriginalityRisk(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          theoreticalFramework,
          methodology,
          researchScope,
          validDetails,
        },
        log,
      );

      const riskCalcResult = calculateOriginalityRisk(
        overlapTable,
        validDetails,
        log,
      );

      // Hem semantik risk önceliği (badge) hem de ID bazlı katı determinizm
      const stableSort = (
        a: (typeof riskCalcResult.overlapTable)[number],
        b: (typeof riskCalcResult.overlapTable)[number],
      ) => {
        const badgeDiff = compareThesesByRisk(a, b);
        return badgeDiff !== 0 ? badgeDiff : a.id - b.id;
      };
      riskCalcResult.overlapTable.sort(stableSort);
      riskCalcResult.eliminatedTheses.sort(stableSort);

      const strategicRecommendations = await synthesizeRoadmap(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          theoreticalFramework,
          methodology,
          researchScope,
          comparisonResults: riskCalcResult.overlapTable.map((item) => ({
            title: item.title,
            author: item.author,
            year: item.year,
            axes: item.axes,
            comparisonNote: item.comparisonNote || "",
          })),
        },
        log,
      );

      tezaraResults = {
        originalityBadge: riskCalcResult.originalityBadge,
        overlapTable: riskCalcResult.overlapTable,
        strategicRecommendations,
      };
    }

    const reportData: OriginalityReportData = {
      tavilyResults: {
        items: params.tavilyResults.items,
        briefingNote: params.tavilyResults.briefingNote,
      },
      tezaraResults,
    };

    // Single database write at the very end of the pipeline
    await db
      .insert(originalityReports)
      .values({
        userId: session.userId,
        tavilyResults: reportData.tavilyResults,
        tezaraResults: reportData.tezaraResults,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: originalityReports.userId,
        set: {
          tavilyResults: reportData.tavilyResults,
          tezaraResults: reportData.tezaraResults,
          updatedAt: new Date(),
        },
      });

    log.info("originality_jury_finalize_success", {
      service: "originality",
      data: { context: params.matrix.studyTitle },
    });

    updateTag(CACHE_TAGS.originalityReport);

    return { success: true, data: reportData };
  } catch (err) {
    log.error("originality_jury_finalize_failed", {
      service: "originality",
      error: err,
      data: { context: params.matrix.studyTitle },
    });
    return {
      error: "Jüri analizi ve risk raporu hazırlanırken bir hata oluştu.",
    };
  }
}

/**
 * Marks the risk stage as complete, clears downstream thesis_boxes,
 * and redirects to boxes.
 *
 * @returns Success or error response
 */
export async function completeRiskStageAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("originality_risk_complete_start", {
    service: "originality",
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrix) {
      await db.transaction(async (tx) => {
        await tx
          .delete(thesisBoxes)
          .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
      });
    }

    revalidateOnboardingPaths();

    updateTag(CACHE_TAGS.thesisBoxes);

    log.info("originality_risk_complete_success", {
      service: "originality",
      durationMs: performance.now() - startTime,
    });

    return { success: true };
  } catch (err) {
    log.error("originality_risk_complete_failed", {
      service: "originality",
      error: err,
    });
    return { error: "Risk aşaması tamamlanırken bir hata oluştu." };
  }
}
