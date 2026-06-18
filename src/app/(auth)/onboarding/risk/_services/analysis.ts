import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import { extractMessage } from "@/lib/error-utils";
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
  comparisonNote: string;
  axes: {
    subject: AxesOption;
    theory: AxesOption;
    methodology: AxesOption;
    context?: AxesOption;
  };
  originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapTable: CalculatedOverlapItem[];
  riskPercentage: number;
}

function badgeToRiskPercentage(
  badge: CalculatedOriginalityRiskResult["originalityBadge"],
): number {
  switch (badge) {
    case "HIGH_RISK":
      return 100;
    case "MEDIUM_RISK":
      return 50;
    case "LOW_RISK":
      return 25;
    case "ZERO_RISK":
      return 0;
  }
}

/**
 * Enriches the raw Gemini overlap analysis with thesis metadata and passes
 * Gemini's holistic originality_level through to the output. This function
 * is deliberately passive — no axis counting, no weighted scoring.
 *
 * @param overlapTable - Raw overlap table from Gemini analysis.
 * @param validDetails - Enriched thesis metadata for ID lookup.
 * @returns Enriched overlap table with Gemini's originality level and badge.
 */
export function calculateOriginalityRisk(
  overlapTable: Array<{
    id: number;
    academic_reasoning: string;
    originality_level: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
    subject_overlap: "HIGH" | "PARTIAL" | "NONE";
    methodology_overlap: "HIGH" | "PARTIAL" | "NONE";
    theory_overlap: "HIGH" | "PARTIAL" | "NONE";
    context_overlap: "HIGH" | "PARTIAL" | "NONE";
  }>,
  validDetails: TezaraThesisDetails[],
): CalculatedOriginalityRiskResult {
  if (validDetails.length === 0 || overlapTable.length === 0) {
    return {
      originalityBadge: "ZERO_RISK",
      overlapTable: [],
      riskPercentage: 0,
    };
  }

  const calculatedOverlapTable = overlapTable.map((item) => {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      throw new Error(`Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`);
    }

    return {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      comparisonNote: item.academic_reasoning,
      axes: {
        subject: item.subject_overlap,
        theory: item.theory_overlap,
        methodology: item.methodology_overlap,
        context: item.context_overlap,
      },
      originalityLevel: item.originality_level,
    };
  });

  const levels = new Set(calculatedOverlapTable.map((i) => i.originalityLevel));
  const RISK_PRIORITY = [
    "HIGH_RISK",
    "MEDIUM_RISK",
    "LOW_RISK",
    "ZERO_RISK",
  ] as const;
  const originalityBadge =
    RISK_PRIORITY.find((r) => levels.has(r)) ?? "ZERO_RISK";

  return {
    originalityBadge,
    overlapTable: calculatedOverlapTable,
    riskPercentage: badgeToRiskPercentage(originalityBadge),
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
    originality_level: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
    subject_overlap: "HIGH" | "PARTIAL" | "NONE";
    methodology_overlap: "HIGH" | "PARTIAL" | "NONE";
    theory_overlap: "HIGH" | "PARTIAL" | "NONE";
    context_overlap: "HIGH" | "PARTIAL" | "NONE";
  }[];
}> {
  log.file("analysis.ts:42");
  const startTime = performance.now();
  log.info({
    step: "analyze_originality_risk",
    status: "START",
    thesisCount: params.validDetails.length,
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
        originality_level:
          | "HIGH_RISK"
          | "MEDIUM_RISK"
          | "LOW_RISK"
          | "ZERO_RISK";
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

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info({
      step: "analyze_originality_risk",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: overlapTable.length,
      },
    });

    return { overlapTable };
  } catch (err) {
    log.error({
      step: "analyze_originality_risk",
      status: "FAILED",
      diagnostics: {
        errorCode: "GEMINI_ANALYSIS_ERROR",
        message: extractMessage(err),
        model: "gemini-3.1-flash-lite",
      },
    });
    throw err;
  }
}
