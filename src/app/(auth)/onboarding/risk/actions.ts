"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type {
  OnboardingActionResult,
  ScrapedTheses,
  TavilyEvaluationResponse,
  OriginalityReportData,
} from "@/lib/types";

import { extractQueries } from "./_services/queries";
import {
  executeParallelSearch,
  evaluateTavilyResults,
} from "./_services/search";
import { siftAndFetchDetails } from "./_services/sifting";
import { analyzeOriginalityRisk } from "./_services/analysis";
import { calculateOriginalityRisk } from "./_services/risk-calc";
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
 * Executes parallel searches on Tavily and Tezara, evaluates Tavily findings,
 * sifts Tezara findings using Gemini, and returns the selected/eliminated theses.
 * Does not write to database.
 */
export async function searchAndSiftThesesAction(
  matrix: OnboardingMatrixInput,
): Promise<
  | {
      success: true;
      scrapedTheses: ScrapedTheses;
      tavilyResults: TavilyEvaluationResponse;
      keywords: string[];
    }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "searchAndSiftTheses", status: "START" });

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    if (!matrix) return { error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." };

    const { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits } = matrix;

    const { tavilyQueries, tezaraQueries, keywords } = await extractQueries(
      { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits },
      log,
    );

    const { tavilySearchResults, tezaraSearchResults } = await executeParallelSearch(tavilyQueries, tezaraQueries, log);

    const tavilyEvaluation = await evaluateTavilyResults(
      { studyTitle, researchQuestion, mainClaim, theoreticalFramework },
      tavilySearchResults,
      log,
    );

    const { finalTheses: validDetails, eliminatedTheses } = await siftAndFetchDetails(
      { studyTitle, researchQuestion, theoreticalFramework, methodology, historicalSpatialLimits },
      tezaraSearchResults,
      log,
    );

    log.info({ step: "searchAndSiftTheses", status: "SUCCESS" });

    return {
      success: true,
      scrapedTheses: { selected: validDetails, eliminated: eliminatedTheses },
      tavilyResults: tavilyEvaluation,
      keywords,
    };
  } catch (err) {
    log.error({ step: "searchAndSiftTheses", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: err instanceof Error ? err.message : String(err) } });
    return { error: "YÖKTEZ tarama ve süzme işlemi sırasında bir hata oluştu." };
  }
}

/**
 * Runs the Gemini Jury analysis, calculates the final originality risk profile,
 * synthesizes the strategic roadmap, writes the report to originality_reports,
 * and returns the data to the client.
 */
export async function runJuryAnalysisAction(
  scrapedTheses: ScrapedTheses,
  tavilyResults: TavilyEvaluationResponse,
  matrix: OnboardingMatrixInput,
): Promise<{ success: true; data: OriginalityReportData } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "runJuryAnalysis", status: "START" });

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits } = matrix;
    const validDetails = scrapedTheses.selected;

    let tezaraResults: OriginalityReportData["tezaraResults"];

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ZERO_RISK",
        overlapTable: [],
        strategicRecommendations: "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir.",
        riskPercentage: 0,
      };
    } else {
      const { overlapTable } = await analyzeOriginalityRisk(
        { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits, validDetails },
        log,
      );

      const riskCalcResult = calculateOriginalityRisk(overlapTable, validDetails, log);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const strategicRecommendations = await synthesizeRoadmap(
        {
          studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits,
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
      tavilyResults: { items: tavilyResults.items, briefingNote: tavilyResults.briefingNote },
      tezaraResults,
    };

    // Write to originality_reports
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

    log.info({ step: "runJuryAnalysis", status: "SUCCESS" });

    return { success: true, data: reportData };
  } catch (err) {
    log.error({ step: "runJuryAnalysis", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: err instanceof Error ? err.message : String(err) } });
    return { error: "Gemini jüri analizi veya risk seviyesi belirlenirken hata oluştu." };
  }
}

/**
 * Marks the risk stage as complete and redirects to boxes.
 */
export async function completeRiskStageAction(): Promise<OnboardingActionResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    revalidatePath("/onboarding", "layout");
    return { success: true };
  } catch {
    return { error: "Risk aşaması tamamlanırken bir hata oluştu." };
  }
}
