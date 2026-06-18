"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { originalityReports, thesisMatrices, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
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
} from "./_services/analysis";
import { synthesizeRoadmap } from "./_services/roadmap";

interface OnboardingMatrixInput {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
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

  log.info({
    step: "extractQueries",
    service: "originality",
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const { tavilyQueries, tezaraQueries, keywords } = await extractQueries(
      {
        studyTitle: matrix.studyTitle,
        methodology: matrix.methodology,
        historicalSpatialLimits: matrix.historicalSpatialLimits,
      },
      log,
    );

    log.info({
      step: "extractQueries",
      status: "SUCCESS",
      service: "originality",
    });

    return {
      success: true,
      data: { tavilyQueries, tezaraQueries, keywords },
    };
  } catch (err) {
    log.error({
      step: "extractQueries",
      status: "FAILED",
      service: "originality",
      diagnostics: {
        errorCode: "EXTRACT_QUERIES_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
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

  log.info({
    step: "executeSearch",
    service: "originality",
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

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

    log.info({
      step: "executeSearch",
      status: "SUCCESS",
      service: "originality",
    });

    return {
      success: true,
      data: { tezaraSearchResults, tavilyResults },
    };
  } catch (err) {
    log.error({
      step: "executeSearch",
      status: "FAILED",
      service: "originality",
      diagnostics: {
        errorCode: "EXECUTE_SEARCH_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      error: "Paralel tarama motorları çalıştırılırken bir hata oluştu.",
    };
  }
}

/**
 * Step 3: Sifts and fetches details for the Tezara candidates using
 * embedding similarity and Gemini deep sifting.
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

  log.info({
    step: "siftTheses",
    service: "originality",
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const { finalTheses, eliminatedTheses } = await siftAndFetchDetails(
      {
        studyTitle: params.matrix.studyTitle,
        researchQuestion: params.matrix.researchQuestion,
        theoreticalFramework: params.matrix.theoreticalFramework,
        methodology: params.matrix.methodology,
        historicalSpatialLimits: params.matrix.historicalSpatialLimits,
      },
      params.tezaraSearchResults,
      log,
    );

    log.info({
      step: "siftTheses",
      status: "SUCCESS",
      service: "originality",
    });

    return {
      success: true,
      data: { selected: finalTheses, eliminated: eliminatedTheses },
    };
  } catch (err) {
    log.error({
      step: "siftTheses",
      status: "FAILED",
      service: "originality",
      diagnostics: {
        errorCode: "SIFT_THESES_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      error: "Tez eleme ve detay çekme işlemi sırasında bir hata oluştu.",
    };
  }
}

/**
 * Step 4: Runs the Gemini Jury analysis, calculates the final originality
 * risk profile, synthesizes the strategic roadmap, then writes the complete
 * report to the originality_reports table as a single upsert at the very end.
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

  log.info({
    step: "finalizeJuryAnalysis",
    service: "originality",
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const {
      studyTitle,
      researchQuestion,
      mainClaim,
      methodology,
      theoreticalFramework,
      historicalSpatialLimits,
    } = params.matrix;
    const validDetails = params.scrapedTheses.selected;

    let tezaraResults: OriginalityReportData["tezaraResults"];

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ZERO_RISK",
        overlapTable: [],
        strategicRecommendations:
          "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir.",
        riskPercentage: 0,
      };
    } else {
      const { overlapTable } = await analyzeOriginalityRisk(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          methodology,
          theoreticalFramework,
          historicalSpatialLimits,
          validDetails,
        },
        log,
      );

      const riskCalcResult = calculateOriginalityRisk(
        overlapTable,
        validDetails,
      );

      const strategicRecommendations = await synthesizeRoadmap(
        {
          studyTitle,
          researchQuestion,
          mainClaim,
          methodology,
          theoreticalFramework,
          historicalSpatialLimits,
          comparisonResults: riskCalcResult.overlapTable.map((item) => ({
            title: item.title,
            author: item.author,
            year: item.year,
            axes: item.axes,
            originalityLevel: item.originalityLevel,
            comparisonNote: item.comparisonNote || "",
          })),
        },
        log,
      );

      tezaraResults = {
        originalityBadge: riskCalcResult.originalityBadge,
        overlapTable: riskCalcResult.overlapTable,
        strategicRecommendations,
        riskPercentage: riskCalcResult.riskPercentage,
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

    log.info({
      step: "finalizeJuryAnalysis",
      status: "SUCCESS",
      service: "originality",
    });

    return { success: true, data: reportData };
  } catch (err) {
    log.error({
      step: "finalizeJuryAnalysis",
      status: "FAILED",
      service: "originality",
      diagnostics: {
        errorCode: "FINALIZE_JURY_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
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
  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, session.userId));

    if (matrix) {
      await db
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
    }

    revalidatePath("/onboarding", "layout");
    return { success: true };
  } catch {
    return { error: "Risk aşaması tamamlanırken bir hata oluştu." };
  }
}
