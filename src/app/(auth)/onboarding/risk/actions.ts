"use server";

import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type {
  OnboardingActionResult,
  ScrapedTheses,
  TavilyEvaluationResponse,
  OriginalityReportData,
  GeminiThesisBox,
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
import { generateStructuredContent } from "@/lib/gemini";
import {
  THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";
import { searchWikipediaTheorist } from "@/lib/wikipedia";

interface OnboardingMatrixInput {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}

/**
 * Executes parallel searches on Tavily and Tezara, evaluates Tavily findings, sifts Tezara findings
 * using Gemini, and returns the selected/eliminated theses along with Tavily evaluation summaries.
 * Bypasses database writes entirely.
 *
 * @param matrix - The target thesis matrix fields from the client state.
 * @returns Success response with scrapedTheses and tavilyResults, or an error.
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
  const startTime = performance.now();

  log.info({ step: "searchAndSiftTheses", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({ step: "searchAndSiftTheses", status: "FAILED", diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadı. Lütfen tekrar giriş yapın." } });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    if (!matrix) {
      log.warn({ step: "searchAndSiftTheses", status: "FAILED", diagnostics: { errorCode: "VALIDATION_ERROR", message: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." } });
      return { error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." };
    }

    const { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits } = matrix;

    // Step 1: AI - Generate Tavily and Tezara queries
    const { tavilyQueries, tezaraQueries, keywords } = await extractQueries(
      { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits },
      log,
    );

    // Step 2: Parallel search execution
    const { tavilySearchResults, tezaraSearchResults } = await executeParallelSearch(tavilyQueries, tezaraQueries, log);

    // Step 3: AI - Evaluate Tavily fact-check results using Gemini
    const tavilyEvaluation = await evaluateTavilyResults(
      { studyTitle, researchQuestion, mainClaim, theoreticalFramework },
      tavilySearchResults,
      log,
    );

    // Step 4 & 5: Sift candidate theses and fetch full details
    const { finalTheses: validDetails, eliminatedTheses } = await siftAndFetchDetails(
      { studyTitle, researchQuestion, theoreticalFramework, methodology, historicalSpatialLimits },
      tezaraSearchResults,
      log,
    );

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({ step: "searchAndSiftTheses", status: "SUCCESS", metrics: { duration, outputRows: validDetails.length } });

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
 * Runs the Gemini Jury analysis on the selected theses, calculates the final originality risk profile,
 * synthesizes the strategic roadmap, and returns the complete OriginalityReportData.
 * Bypasses database writes entirely.
 *
 * @param scrapedTheses - Selected and eliminated theses results from Step 3.
 * @param tavilyResults - Fact check summaries from Tavily.
 * @param matrix - The target thesis matrix fields from the client state.
 * @returns Complete originality report object or error.
 */
export async function runJuryAnalysisAction(
  scrapedTheses: ScrapedTheses,
  tavilyResults: TavilyEvaluationResponse,
  matrix: OnboardingMatrixInput,
): Promise<{ success: true; data: OriginalityReportData } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({ step: "runJuryAnalysis", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({ step: "runJuryAnalysis", status: "FAILED", diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadı. Lütfen tekrar giriş yapın." } });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    if (!matrix) {
      log.warn({ step: "runJuryAnalysis", status: "FAILED", diagnostics: { errorCode: "VALIDATION_ERROR", message: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." } });
      return { error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." };
    }

    const { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits } = matrix;
    const validDetails = scrapedTheses.selected;

    let tezaraResults: OriginalityReportData["tezaraResults"];

    if (validDetails.length === 0) {
      tezaraResults = {
        originalityBadge: "ZERO_RISK",
        overlapTable: [],
        strategicRecommendations: "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü maksimum seviyenedir.",
        riskPercentage: 0,
      };
    } else {
      // Step 6: AI - Compare across four axes
      const { overlapTable } = await analyzeOriginalityRisk(
        { studyTitle, researchQuestion, mainClaim, methodology, theoreticalFramework, historicalSpatialLimits, validDetails },
        log,
      );

      // Step 7: Calculate risk scores from boolean overlap flags
      const riskCalcResult = calculateOriginalityRisk(overlapTable, validDetails, log);

      // Rate-limit pause before roadmap synthesis
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 8: AI - Synthesize strategic academic roadmap
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

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({ step: "runJuryAnalysis", status: "SUCCESS", metrics: { duration, outputRows: tezaraResults.overlapTable.length } });

    return {
      success: true,
      data: {
        tavilyResults: { items: tavilyResults.items, briefingNote: tavilyResults.briefingNote },
        tezaraResults,
      },
    };
  } catch (err) {
    log.error({ step: "runJuryAnalysis", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: err instanceof Error ? err.message : String(err) } });
    return { error: "Gemini jüri analizi veya risk seviyesi belirlenirken hata oluştu." };
  }
}

/**
 * Kullanıcının risk aşamasını onaylayıp geçmesine olanak tanır.
 *
 * @returns Başarı durumu veya hata mesajı.
 */
export async function completeRiskStageAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "completeRiskStage", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({ step: "completeRiskStage", status: "FAILED", diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadı. Lütfen tekrar giriş yapın." } });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    revalidatePath("/onboarding", "layout");
    log.info({ step: "completeRiskStage", status: "SUCCESS" });
    return { success: true };
  } catch (err) {
    log.error({ step: "completeRiskStage", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: err instanceof Error ? err.message : String(err) } });
    return { error: "Risk aşaması tamamlanırken bir hata oluştu." };
  }
}

/**
 * Onboarding risk raporunu getirmek için client durumunda saklanan verileri döner.
 * Bypasses database select entirely.
 *
 * @returns Stored report data or error message.
 */
export async function getStoredOriginalityReportAction() {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "getStoredOriginalityReport", status: "START" });
  log.info({ step: "getStoredOriginalityReport", status: "SUCCESS" });

  return { error: "Özgünlük raporu verisi istemci durumunda saklanmaktadır." };
}

/**
 * Mevcut kullanıcının tez matrisini bularak tez kutularını (boxes) oluşturur ve JSON döner.
 * Bypasses database operations completely.
 *
 * @param matrix - The target thesis matrix fields from the client state.
 * @returns Başarı durumu ve kutular veya hata mesajı.
 */
export async function generateBoxesForCurrentMatrixJSONAction(
  matrix: OnboardingMatrixInput,
): Promise<{ success: true; boxes: GeminiThesisBox[] } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({ step: "generateBoxesForCurrentMatrixJSON", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({ step: "generateBoxesForCurrentMatrixJSON", status: "FAILED", diagnostics: { errorCode: "AUTH_ERROR", message: "Oturum bulunamadı. Lütfen tekrar giriş yapın." } });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    if (!matrix) {
      log.warn({ step: "generateBoxesForCurrentMatrixJSON", status: "FAILED", diagnostics: { errorCode: "VALIDATION_ERROR", message: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." } });
      return { error: "Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun." };
    }

    // Step 1: AI - Generate draft boxes via Gemini
    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      methodology: matrix.methodology,
      theoreticalFramework: matrix.theoreticalFramework,
      historicalSpatialLimits: matrix.historicalSpatialLimits,
    });

    const generationResult = await generateStructuredContent<{ boxes: GeminiThesisBox[] }>(
      "gemini-3.1-flash-lite",
      THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      { thinkingConfig: null },
    );

    const draftBoxes = generationResult.boxes || [];

    // Step 2: Wikipedia concurrent cross-check for theorists
    log.info({ step: "wikipedia_cross_check", status: "START" });

    await Promise.all(
      draftBoxes.map(async (box) => {
        const theorists = box.theorists || [];
        if (theorists.length === 0) return;
        const verificationPromises = theorists.map(async (theoristName) => {
          try {
            const wikiResult = await searchWikipediaTheorist(theoristName, box.category, log);
            if (wikiResult) return theoristName;
          } catch {
            /* filtered — silently skip unverifiable theorists */
          }
          return null;
        });
        const verificationResults = await Promise.all(verificationPromises);
        box.theorists = verificationResults.filter((name): name is string => name !== null);
      }),
    );

    log.info({ step: "wikipedia_cross_check", status: "SUCCESS" });

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({ step: "generateBoxesForCurrentMatrixJSON", status: "SUCCESS", metrics: { duration, outputRows: draftBoxes.length } });

    return { success: true, boxes: draftBoxes };
  } catch (err) {
    log.error({ step: "generateBoxesForCurrentMatrixJSON", status: "FAILED", diagnostics: { errorCode: "SYSTEM_ERROR", message: err instanceof Error ? err.message : String(err) } });
    return { error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu." };
  }
}
