import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { OverlapLevel, TezaraThesisDetails } from "@/lib/types";
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

/**
 * Categorical ordering from lowest to highest risk.
 */
const LEVEL_ORDER: OverlapLevel[] = [
  "YOK",
  "DUSUK",
  "ORTA",
  "YUKSEK",
  "KRITIK",
];

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
    subject: OverlapLevel;
    theory: OverlapLevel;
    methodology: OverlapLevel;
    context: OverlapLevel;
  };
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge:
    | "KRITIK_CAKISMA"
    | "SINIRDAS_CALISMA"
    | "BESLEYICI_CALISMA"
    | "OZGUN_CALISMA";
  overlapTable: CalculatedOverlapItem[];
  eliminatedTheses: CalculatedOverlapItem[];
  riskPercentage: number;
}

/**
 * Returns the highest (most dangerous) overlap level present in the given axes.
 */
export function getThesisMaxLevel(axes: {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}): OverlapLevel {
  const levels = [
    axes.subject,
    axes.theory,
    axes.methodology,
    axes.context ?? "YOK",
  ];
  let max: OverlapLevel = "YOK";
  for (const l of levels) {
    if (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(max)) max = l;
  }
  return max;
}

/**
 * Returns the second-highest overlap level for tiebreaker sorting.
 */
function getThesisSecondMaxLevel(axes: {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}): OverlapLevel {
  const levels = [
    axes.subject,
    axes.theory,
    axes.methodology,
    axes.context ?? "YOK",
  ];
  const sorted = levels.sort(
    (a, b) => LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a),
  );
  return sorted.length > 1 ? sorted[1] : "YOK";
}

interface AxesWithOptionalContext {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}

/**
 * Compares two theses for sorting: highest axis level first, then second-highest,
 * then doctorate over master's, then most recent first.
 */
export function compareThesesByRisk(
  a: { axes: AxesWithOptionalContext; thesisType: string; year: number },
  b: { axes: AxesWithOptionalContext; thesisType: string; year: number },
): number {
  const maxA = getThesisMaxLevel(a.axes);
  const maxB = getThesisMaxLevel(b.axes);
  const diff = LEVEL_ORDER.indexOf(maxB) - LEVEL_ORDER.indexOf(maxA);
  if (diff !== 0) return diff;

  const secondA = getThesisSecondMaxLevel(a.axes);
  const secondB = getThesisSecondMaxLevel(b.axes);
  const diff2 = LEVEL_ORDER.indexOf(secondB) - LEVEL_ORDER.indexOf(secondA);
  if (diff2 !== 0) return diff2;

  const tA = (a.thesisType || "").toLowerCase();
  const tB = (b.thesisType || "").toLowerCase();
  const wA =
    tA.includes("doktora") || tA.includes("phd")
      ? 2
      : tA.includes("yüksek lisans")
        ? 1
        : 0;
  const wB =
    tB.includes("doktora") || tB.includes("phd")
      ? 2
      : tB.includes("yüksek lisans")
        ? 1
        : 0;
  if (wB !== wA) return wB - wA;

  return (b.year || 0) - (a.year || 0);
}

/**
 * Determines the project-level global risk badge and percentage based on the
 * highest single axis value across all remaining theses.
 *
 * Rule:
 * - Any KRITIK axis → KRITIK_CAKISMA (85%)
 * - No KRITIK but ≥1 YUKSEK → SINIRDAS_CALISMA (50%)
 * - All axes ≤ ORTA → BESLEYICI_CALISMA (25%)
 * - Table empty → OZGUN_CALISMA (0%)
 */
function evaluateGlobalBadge(overlapTable: CalculatedOverlapItem[]): {
  badge: CalculatedOriginalityRiskResult["originalityBadge"];
  percentage: number;
} {
  if (overlapTable.length === 0) {
    return { badge: "OZGUN_CALISMA", percentage: 0 };
  }

  let hasKRITIK = false;
  let hasYUKSEK = false;

  for (const item of overlapTable) {
    const levels = [
      item.axes.subject,
      item.axes.theory,
      item.axes.methodology,
      item.axes.context,
    ];
    if (levels.includes("KRITIK")) hasKRITIK = true;
    if (levels.includes("YUKSEK")) hasYUKSEK = true;
  }

  if (hasKRITIK) return { badge: "KRITIK_CAKISMA", percentage: 85 };
  if (hasYUKSEK) return { badge: "SINIRDAS_CALISMA", percentage: 50 };
  return { badge: "BESLEYICI_CALISMA", percentage: 25 };
}

/**
 * Enriches the raw Gemini overlap analysis with thesis metadata and applies
 * the jury elimination filter: a thesis stays in the overlap table only if at
 * least one of its 4 axes is KRITIK or YUKSEK. All others are relegated to
 * eliminatedTheses.
 *
 * The global badge is derived from the highest single axis level across
 * remaining theses, following institutional council rules.
 *
 * Filters out IDs hallucinated by Gemini that don't exist in validDetails.
 */
export function calculateOriginalityRisk(
  overlapTable: Array<{
    id: number;
    academic_reasoning: string;
    subject_scorecard?: {
      same_core_question: boolean;
      significant_topic_intersection: boolean;
      background_mention_only: boolean;
    };
    subject_overlap: OverlapLevel;
    methodology_scorecard?: {
      identical_method_and_tools: boolean;
      partially_shared_approach: boolean;
      different_empirical_design: boolean;
    };
    methodology_overlap: OverlapLevel;
    theory_scorecard?: {
      same_theoretical_backbone: boolean;
      shared_concepts_only: boolean;
      different_epistemology: boolean;
    };
    theory_overlap: OverlapLevel;
    context_scorecard?: {
      overlapping_universe_and_sample: boolean;
      partial_contextual_contact: boolean;
      distinct_context: boolean;
    };
    context_overlap: OverlapLevel;
  }>,
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedOriginalityRiskResult {
  const calculatedOverlapTable: CalculatedOverlapItem[] = [];
  const eliminatedTheses: CalculatedOverlapItem[] = [];

  if (validDetails.length === 0 || overlapTable.length === 0) {
    return {
      originalityBadge: "OZGUN_CALISMA",
      overlapTable: [],
      eliminatedTheses: [],
      riskPercentage: 0,
    };
  }

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

    const thesisEntry: CalculatedOverlapItem = {
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
    };

    // Jury elimination filter: only theses with at least one KRITIK or YUKSEK
    // axis are kept in the risk table. All others are eliminated.
    const hasKRITIKorYUKSEK = (
      [
        axes.subject,
        axes.theory,
        axes.methodology,
        axes.context,
      ] as OverlapLevel[]
    ).some((level) => level === "KRITIK" || level === "YUKSEK");

    if (hasKRITIKorYUKSEK) {
      calculatedOverlapTable.push(thesisEntry);
    } else {
      logger?.info("originality_thesis_eliminated", {
        service: "originality",
        data: {
          context: "calculateOriginalityRisk",
          thesisId: detail.id,
          thesisTitle: detail.title,
          axes,
        },
      });
      eliminatedTheses.push(thesisEntry);
    }
  }

  const globalBadge = evaluateGlobalBadge(calculatedOverlapTable);

  return {
    originalityBadge: globalBadge.badge,
    overlapTable: calculatedOverlapTable,
    eliminatedTheses,
    riskPercentage: globalBadge.percentage,
  };
}

/**
 * Performs comparison between target thesis and a list of identified academic
 * theses using the Academic Jury Analysis model.
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
): Promise<{
  overlapTable: {
    id: number;
    academic_reasoning: string;
    subject_scorecard?: {
      same_core_question: boolean;
      significant_topic_intersection: boolean;
      background_mention_only: boolean;
    };
    subject_overlap: OverlapLevel;
    methodology_scorecard?: {
      identical_method_and_tools: boolean;
      partially_shared_approach: boolean;
      different_empirical_design: boolean;
    };
    methodology_overlap: OverlapLevel;
    theory_scorecard?: {
      same_theoretical_backbone: boolean;
      shared_concepts_only: boolean;
      different_epistemology: boolean;
    };
    theory_overlap: OverlapLevel;
    context_scorecard?: {
      overlapping_universe_and_sample: boolean;
      partial_contextual_contact: boolean;
      distinct_context: boolean;
    };
    context_overlap: OverlapLevel;
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
    const chunks: TezaraThesisDetails[][] = [];
    const chunkSize = 3;
    for (let i = 0; i < params.validDetails.length; i += chunkSize) {
      chunks.push(params.validDetails.slice(i, i + chunkSize));
    }

    const analysisPromises = chunks.map(async (group) => {
      const candidateParams = {
        ...params,
        validDetails: group,
      };

      const result = await generateStructuredContent<{
        overlapTable: {
          id: number;
          academic_reasoning: string;
          subject_scorecard: {
            same_core_question: boolean;
            significant_topic_intersection: boolean;
            background_mention_only: boolean;
          };
          subject_overlap: OverlapLevel;
          methodology_scorecard: {
            identical_method_and_tools: boolean;
            partially_shared_approach: boolean;
            different_empirical_design: boolean;
          };
          methodology_overlap: OverlapLevel;
          theory_scorecard: {
            same_theoretical_backbone: boolean;
            shared_concepts_only: boolean;
            different_epistemology: boolean;
          };
          theory_overlap: OverlapLevel;
          context_scorecard: {
            overlapping_universe_and_sample: boolean;
            partial_contextual_contact: boolean;
            distinct_context: boolean;
          };
          context_overlap: OverlapLevel;
        }[];
      }>(
        "gemini-3.1-flash-lite",
        buildAnalysisSystemInstruction(),
        buildAnalysisPrompt(candidateParams),
        geminiAnalysisSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          seed: 42,
        },
      );

      return result.overlapTable || [];
    });

    const results = await Promise.all(analysisPromises);
    const overlapTable = results.flat();

    log.preview(
      "Overlap Analysis Results",
      overlapTable.map((o) => ({
        id: o.id,
        overlap: {
          subject: o.subject_overlap,
          methodology: o.methodology_overlap,
          theory: o.theory_overlap,
          context: o.context_overlap,
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
