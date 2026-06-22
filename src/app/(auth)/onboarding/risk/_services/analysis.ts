import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  geminiAnalysisSchema,
  buildAnalysisSystemInstruction,
  buildAnalysisPrompt,
} from "@/lib/prompts";

export interface AnalyzeOriginalityRiskParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  validDetails: TezaraThesisDetails[];
}

export interface CalculatedOverlapItem {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  comparisonNote?: string;
  yokPdfUrl?: string;
  axes: {
    subject: number;
    theory: number;
    methodology: number;
    context: number;
  };
  riskScore: number;
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge:
    | "KRITIK_CAKISMA"
    | "SINIRDAS_CALISMA"
    | "BESLEYICI_CALISMA"
    | "OZGUN_CALISMA";
  overlapTable: CalculatedOverlapItem[];
  riskPercentage: number;
}

/**
 * Calculates a risk score (0-100) for a single thesis as the arithmetic mean
 * of its 4 dimensional index scores.
 *
 * @param axes - The 4-axis numeric indices from Gemini (0-100 each).
 * @returns Rounded risk score between 0 and 100.
 */
export function calculateRiskScore(axes: {
  subject: number;
  theory: number;
  methodology: number;
  context: number;
}): number {
  return Math.round(
    (axes.subject + axes.theory + axes.methodology + axes.context) / 4,
  );
}

/**
 * Determines the project-level global risk badge and display percentage based
 * on the maximum individual thesis risk score in the candidate pool.
 *
 * @param scores - Array of per-thesis risk scores (0-100).
 * @returns Global risk badge and display percentage.
 */
export function evaluateGlobalRisk(scores: number[]): {
  badge: string;
  percentage: number;
} {
  if (scores.length === 0) return { badge: "OZGUN_CALISMA", percentage: 0 };

  const maxScore = Math.max(...scores);

  if (maxScore <= 30) return { badge: "OZGUN_CALISMA", percentage: 0 };
  if (maxScore <= 50) return { badge: "BESLEYICI_CALISMA", percentage: 25 };
  if (maxScore <= 70) return { badge: "SINIRDAS_CALISMA", percentage: 50 };
  return { badge: "KRITIK_CAKISMA", percentage: 85 };
}

const SCORE_BADGE_THRESHOLDS: [number, string][] = [
  [30, "OZGUN_CALISMA"],
  [50, "BESLEYICI_CALISMA"],
  [70, "SINIRDAS_CALISMA"],
  [100, "KRITIK_CAKISMA"],
];

/**
 * Maps an individual thesis risk score to its corresponding risk badge.
 * Useful for per-thesis UI badge display.
 *
 * @param score - Risk score (0-100).
 * @returns Corresponding risk badge label.
 */
export function getScoreBadge(score: number): string {
  for (const [threshold, badge] of SCORE_BADGE_THRESHOLDS) {
    if (score <= threshold) return badge;
  }
  return "KRITIK_CAKISMA";
}

/**
 * Computes a sort priority integer for a thesis based on its 4-axis scores.
 * Higher total overlap = higher priority (appears first in UI).
 * Uses simple sum of axis scores.
 */
export function getThesisPriority(axes: {
  subject: number;
  theory: number;
  methodology: number;
  context?: number;
}): number {
  return axes.subject + axes.theory + axes.methodology + (axes.context ?? 0);
}

/**
 * Enriches the raw Gemini overlap analysis with thesis metadata and computes
 * each thesis's risk score from the 4 dimensional indices. The project-level
 * badge is derived from the highest individual risk score in the pool.
 *
 * Filters out IDs hallucinated by Gemini that don't exist in validDetails.
 *
 * @param overlapTable - Raw overlap table from Gemini analysis (indices only).
 * @param validDetails - Enriched thesis metadata for ID lookup.
 * @param logger - Optional logger instance.
 * @returns Enriched overlap table with computed risk scores and project badge.
 */
export function calculateOriginalityRisk(
  overlapTable: Array<{
    id: number;
    academic_reasoning: string;
    subject_index: number;
    methodology_index: number;
    theory_index: number;
    context_index: number;
  }>,
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedOriginalityRiskResult {
  if (validDetails.length === 0 || overlapTable.length === 0) {
    return {
      originalityBadge: "OZGUN_CALISMA",
      overlapTable: [],
      riskPercentage: 0,
    };
  }

  const calculatedOverlapTable: CalculatedOverlapItem[] = [];
  const allScores: number[] = [];

  for (const item of overlapTable) {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      logger?.warn("originality_hallucinated_id_filtered", {
        service: "originality",
        data: {
          context: "calculateOriginalityRisk",
          hallucinatedId: item.id,
        },
      });
      continue;
    }

    const axes = {
      subject: item.subject_index,
      theory: item.theory_index,
      methodology: item.methodology_index,
      context: item.context_index,
    };

    const riskScore = calculateRiskScore(axes);
    allScores.push(riskScore);

    calculatedOverlapTable.push({
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      comparisonNote: item.academic_reasoning,
      yokPdfUrl: detail.yokPdfUrl,
      axes,
      riskScore,
    });
  }

  const globalRisk = evaluateGlobalRisk(allScores);

  return {
    originalityBadge:
      globalRisk.badge as CalculatedOriginalityRiskResult["originalityBadge"],
    overlapTable: calculatedOverlapTable,
    riskPercentage: globalRisk.percentage,
  };
}

/**
 * Performs comparison between target thesis and a list of identified academic
 * theses using the Academic Jury Analysis model.
 *
 * @param params - Comparison target matrix and candidate details.
 * @param log - Logger instance.
 * @returns Gemini response containing the evaluation overlap table.
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
): Promise<{
  overlapTable: {
    id: number;
    academic_reasoning: string;
    subject_index: number;
    methodology_index: number;
    theory_index: number;
    context_index: number;
  }[];
}> {
  log.file("analysis.ts:42");
  const startTime = performance.now();
  log.info("originality_risk_analyze_start", {
    service: "originality",
    data: {
      count: params.validDetails.length,
      context: params.studyTitle,
    },
  });

  try {
    log.prompt(
      "gemini-3.1-flash-lite (HIGH thinking)",
      buildAnalysisPrompt(params),
    );

    const result = await generateStructuredContent<{
      overlapTable: {
        id: number;
        academic_reasoning: string;
        subject_index: number;
        methodology_index: number;
        theory_index: number;
        context_index: number;
      }[];
    }>(
      "gemini-3.1-flash-lite",
      buildAnalysisSystemInstruction(),
      buildAnalysisPrompt(params),
      geminiAnalysisSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    );

    const overlapTable = result.overlapTable || [];

    log.preview(
      "Overlap Analysis Results",
      overlapTable.map((o) => ({
        id: o.id,
        indices: {
          subject: o.subject_index,
          methodology: o.methodology_index,
          theory: o.theory_index,
          context: o.context_index,
        },
        reasoning: o.academic_reasoning?.slice(0, 120),
      })),
    );

    const durationMs = performance.now() - startTime;
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info("originality_risk_analyze_success", {
      service: "originality",
      durationMs,
      tokens: { input: tokens.input ?? 0, output: tokens.output ?? 0 },
      data: {
        count: params.validDetails.length,
        resultCount: overlapTable.length,
        context: params.studyTitle,
      },
    });

    return { overlapTable };
  } catch (err) {
    log.error("originality_risk_analyze_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
