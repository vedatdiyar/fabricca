import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { AxesOption, TezaraThesisDetails } from "@/lib/types";
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
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
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
    subject: AxesOption;
    theory: AxesOption;
    methodology: AxesOption;
    context?: AxesOption;
  };
  riskScore: number;
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapTable: CalculatedOverlapItem[];
  riskPercentage: number;
}

type AxesLabel = "HIGH" | "PARTIAL" | "NONE";

const SCORE_MAP: Record<AxesLabel, number> = {
  HIGH: 100,
  PARTIAL: 40,
  NONE: 0,
};

const AXIS_WEIGHTS = {
  subject: 0.4,
  theory: 0.3,
  methodology: 0.15,
  context: 0.15,
};

/**
 * Calculates a weighted risk score (0-100) for a single thesis based on its
 * 4-axis overlap labels. Subject/Research Question (40%), Theory (30%),
 * Methodology (15%), Context (15%).
 *
 * @param axes - The 4-axis overlap assessment from Gemini.
 * @returns Rounded risk score between 0 and 100.
 */
export function calculateSingleScore(axes: {
  subject: AxesLabel;
  theory: AxesLabel;
  methodology: AxesLabel;
  context: AxesLabel;
}): number {
  const rawScore =
    SCORE_MAP[axes.subject] * AXIS_WEIGHTS.subject +
    SCORE_MAP[axes.theory] * AXIS_WEIGHTS.theory +
    SCORE_MAP[axes.methodology] * AXIS_WEIGHTS.methodology +
    SCORE_MAP[axes.context] * AXIS_WEIGHTS.context;

  return Math.round(rawScore);
}

/**
 * Determines the project-level global risk badge and percentage based on the
 * maximum individual thesis risk score in the candidate pool.
 *
 * @param scores - Array of per-thesis risk scores (0-100).
 * @returns Global risk badge and display percentage.
 */
export function evaluateGlobalRisk(scores: number[]): {
  badge: string;
  percentage: number;
} {
  if (scores.length === 0) return { badge: "ZERO_RISK", percentage: 0 };

  const maxScore = Math.max(...scores);

  if (maxScore <= 15) return { badge: "ZERO_RISK", percentage: 0 };
  if (maxScore <= 40) return { badge: "LOW_RISK", percentage: 25 };
  if (maxScore <= 70) return { badge: "MEDIUM_RISK", percentage: 50 };
  return { badge: "HIGH_RISK", percentage: 85 };
}

const SCORE_BADGE_THRESHOLDS: [number, string][] = [
  [15, "ZERO_RISK"],
  [40, "LOW_RISK"],
  [70, "MEDIUM_RISK"],
  [100, "HIGH_RISK"],
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
  return "HIGH_RISK";
}

/**
 * Enriches the raw Gemini overlap analysis with thesis metadata and computes
 * each thesis's risk score from the 4 axis labels. The project-level badge
 * is derived from the highest individual risk score in the pool.
 *
 * Filters out IDs hallucinated by Gemini that don't exist in validDetails.
 *
 * @param overlapTable - Raw overlap table from Gemini analysis (axes only).
 * @param validDetails - Enriched thesis metadata for ID lookup.
 * @param logger - Optional logger instance.
 * @returns Enriched overlap table with computed risk scores and project badge.
 */
export function calculateOriginalityRisk(
  overlapTable: Array<{
    id: number;
    academic_reasoning: string;
    subject_overlap: "HIGH" | "PARTIAL" | "NONE";
    methodology_overlap: "HIGH" | "PARTIAL" | "NONE";
    theory_overlap: "HIGH" | "PARTIAL" | "NONE";
    context_overlap: "HIGH" | "PARTIAL" | "NONE";
  }>,
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedOriginalityRiskResult {
  if (validDetails.length === 0 || overlapTable.length === 0) {
    return {
      originalityBadge: "ZERO_RISK",
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
      subject: item.subject_overlap,
      theory: item.theory_overlap,
      methodology: item.methodology_overlap,
      context: item.context_overlap,
    };

    const riskScore = calculateSingleScore(axes);
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

const PRIORITY_MAP: Record<number, number> = {
  0b1111: 1,
  0b1110: 2,
  0b1101: 3,
  0b1011: 4,
  0b0111: 5,
  0b1100: 6,
  0b1001: 7,
  0b1010: 8,
  0b1000: 9,
  0b0011: 10,
  0b0101: 11,
  0b0110: 12,
  0b0001: 13,
  0b0010: 14,
  0b0100: 15,
  0b0000: 16,
};

/**
 * Computes a sort priority integer for a thesis based on its 4-axis overlap profile.
 * Lower numbers indicate higher academic risk and should appear first in the UI table.
 * Uses bit-mask encoding: subject=8, theory=4, methodology=2, context=1.
 */
export function getThesisPriority(axes: {
  subject: string;
  theory: string;
  methodology: string;
  context?: string;
}): number {
  const bits =
    (axes.subject !== "NONE" ? 8 : 0) |
    (axes.theory !== "NONE" ? 4 : 0) |
    (axes.methodology !== "NONE" ? 2 : 0) |
    ((axes.context ?? "NONE") !== "NONE" ? 1 : 0);

  return PRIORITY_MAP[bits] ?? 16;
}

/**
 * Performs comparison between target thesis and a list of identified academic theses
 * using the Academic Jury Analysis model.
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
    subject_overlap: "HIGH" | "PARTIAL" | "NONE";
    methodology_overlap: "HIGH" | "PARTIAL" | "NONE";
    theory_overlap: "HIGH" | "PARTIAL" | "NONE";
    context_overlap: "HIGH" | "PARTIAL" | "NONE";
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
        subject_overlap: "HIGH" | "PARTIAL" | "NONE";
        methodology_overlap: "HIGH" | "PARTIAL" | "NONE";
        theory_overlap: "HIGH" | "PARTIAL" | "NONE";
        context_overlap: "HIGH" | "PARTIAL" | "NONE";
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
        overlappingAxes: [
          o.subject_overlap !== "NONE" && `RQ:${o.subject_overlap}`,
          o.methodology_overlap !== "NONE" && `METH:${o.methodology_overlap}`,
          o.theory_overlap !== "NONE" && `THEORY:${o.theory_overlap}`,
          o.context_overlap !== "NONE" && `CTX:${o.context_overlap}`,
        ].filter(Boolean),
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
