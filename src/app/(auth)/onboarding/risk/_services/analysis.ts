import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails, ThesisBadge, ThesisAxes } from "@/lib/types";
import { calculateBadge } from "@/lib/academic/badge-calculator";
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

export interface GeminiOverlapItem {
  id: number;
  problem_sinirlari: { gerekce: string; secim: string };
  teorik_perspektif: { gerekce: string; secim: string };
  metodolojik_kurgu: { gerekce: string; secim: string };
  zaman_mekan_ozgullugu: { gerekce: string; secim: string };
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
  axes: ThesisAxes;
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: ThesisBadge;
  overlapTable: CalculatedOverlapItem[];
  eliminatedTheses: CalculatedOverlapItem[];
}

const BADGE_ORDER: ThesisBadge[] = [
  "İKİZ TEZ",
  "SAVUNMA RİSKİ",
  "TEORİ KAYNAĞI",
  "YÖNTEM KAYNAĞI",
  "BAĞLAM KAYNAĞI",
  "ÖZGÜN",
];

const SELECTION_SCORE: Record<string, number> = {
  TAM_ORTÜŞME: 3,
  KISMI_ORTÜŞME: 2,
  ALAKASIZ: 1,
};

/**
 * Calculates the weighted sum of choice scores across the 4 axes to break ties in sorting.
 */
function getAxesTotalScore(axes: ThesisAxes): number {
  const pScore = SELECTION_SCORE[axes.problem_sinirlari.secim] ?? 1;
  const tScore = SELECTION_SCORE[axes.teorik_perspektif.secim] ?? 1;
  const mScore = SELECTION_SCORE[axes.metodolojik_kurgu.secim] ?? 1;
  // Şayet konu (problem_sinirlari) alakasız ise Bağlam (zaman_mekan_ozgullugu) her türlü alakasız kabul edilir.
  const isTopicAlakasiz = axes.problem_sinirlari.secim === "ALAKASIZ";
  const zScore = isTopicAlakasiz
    ? 1
    : (SELECTION_SCORE[axes.zaman_mekan_ozgullugu.secim] ?? 1);

  return (
    pScore * 3 + // Konu Ağırlığı (x3)
    zScore * 3 + // Bağlam Ağırlığı (x3)
    tScore * 1 + // Teori Ağırlığı (x1)
    mScore * 1 // Yöntem Ağırlığı (x1)
  );
}

/**
 * Compares two theses for sorting: İkiz first, then Sınırdaş/Savunma, then Guides, then Özgün.
 * Breaks ties using sum of axis scores, then doctorate over master's, then most recent first.
 */
export function compareThesesByRisk(
  a: { axes: ThesisAxes; thesisType: string; year: number },
  b: { axes: ThesisAxes; thesisType: string; year: number },
): number {
  const badgeA = calculateBadge(a.axes);
  const badgeB = calculateBadge(b.axes);
  const badgeDiff = BADGE_ORDER.indexOf(badgeA) - BADGE_ORDER.indexOf(badgeB);
  if (badgeDiff !== 0) return badgeDiff;

  const scoreA = getAxesTotalScore(a.axes);
  const scoreB = getAxesTotalScore(b.axes);
  if (scoreB !== scoreA) return scoreB - scoreA;

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
 * Determines the project-level global thesis badge by evaluating each
 * remaining thesis. Priority order: IKIZ > SAVUNMA > GUIDES > OZGUN.
 */
function evaluateGlobalBadge(
  overlapTable: CalculatedOverlapItem[],
): ThesisBadge {
  if (overlapTable.length === 0) {
    return "ÖZGÜN";
  }

  let worstBadge: ThesisBadge = "ÖZGÜN";
  for (const item of overlapTable) {
    const badge = calculateBadge(item.axes);
    if (BADGE_ORDER.indexOf(badge) < BADGE_ORDER.indexOf(worstBadge)) {
      worstBadge = badge;
    }
  }

  return worstBadge;
}

/**
 * Maps LLM output table data to individual thesis entities. Evaluates risk badges
 * and isolates unrelated candidates ("ÖZGÜN") into the eliminated list.
 *
 * @param overlapTable - Gemini output
 * @param validDetails - Theses details fetched from Tezara
 * @param logger - Logger
 * @returns Originality badge, active overlap list and eliminated list
 */
export function calculateOriginalityRisk(
  overlapTable: GeminiOverlapItem[],
  validDetails: TezaraThesisDetails[],
  logger?: Logger,
): CalculatedOriginalityRiskResult {
  const calculatedOverlapTable: CalculatedOverlapItem[] = [];
  const eliminatedTheses: CalculatedOverlapItem[] = [];

  if (validDetails.length === 0 || overlapTable.length === 0) {
    return {
      originalityBadge: "ÖZGÜN",
      overlapTable: [],
      eliminatedTheses: [],
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

    const axes: ThesisAxes = {
      problem_sinirlari: item.problem_sinirlari,
      teorik_perspektif: item.teorik_perspektif,
      metodolojik_kurgu: item.metodolojik_kurgu,
      zaman_mekan_ozgullugu: item.zaman_mekan_ozgullugu,
    };

    // Combine comparison notes of each axis or use the first non-empty gerekce
    const comparisonNote = [
      axes.problem_sinirlari.gerekce,
      axes.teorik_perspektif.gerekce,
      axes.metodolojik_kurgu.gerekce,
      axes.zaman_mekan_ozgullugu.gerekce,
    ]
      .filter(Boolean)
      .join(" ");

    const thesisEntry: CalculatedOverlapItem = {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      comparisonNote,
      yokPdfUrl: detail.yokPdfUrl,
      axes,
    };

    const badge = calculateBadge(axes);
    if (badge === "ÖZGÜN") {
      logger?.info("originality_thesis_eliminated", {
        service: "originality",
        data: {
          context: "calculateOriginalityRisk",
          reason: "unrelated_or_fully_original",
          thesisId: detail.id,
          thesisTitle: detail.title,
          axes,
        },
      });
      eliminatedTheses.push(thesisEntry);
    } else {
      calculatedOverlapTable.push(thesisEntry);
    }
  }

  const globalBadge = evaluateGlobalBadge(calculatedOverlapTable);

  return {
    originalityBadge: globalBadge,
    overlapTable: calculatedOverlapTable,
    eliminatedTheses,
  };
}

/**
 * Runs originality comparison analysis against target thesis matrices.
 * Evaluates theses in parallel batches of size 4.
 *
 * @param params - Target matrix parameters
 * @param log - Logger
 * @param chunkSize - Batch chunk size (defaults to 4)
 * @returns Gemini output overlap table
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
  chunkSize = 3,
): Promise<{
  overlapTable: GeminiOverlapItem[];
}> {
  log.file("analysis.ts");
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
    for (let i = 0; i < params.validDetails.length; i += chunkSize) {
      chunks.push(params.validDetails.slice(i, i + chunkSize));
    }

    const analysisPromises = chunks.map(async (group) => {
      const candidateParams = {
        ...params,
        validDetails: group,
      };

      try {
        const result = await generateStructuredContent<{
          overlapTable: GeminiOverlapItem[];
        }>(
          "gemini-3.1-flash-lite",
          buildAnalysisSystemInstruction(),
          buildAnalysisPrompt(candidateParams),
          geminiAnalysisSchema,
          log,
          {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            temperature: 1.0,
            seed: 42,
          },
        );

        const items = result?.overlapTable || [];
        const returnedIds = new Set(items.map((it) => it.id));
        const finalItems: GeminiOverlapItem[] = [...items];

        // Gracefully backfill any missing IDs in this chunk with safe fallback "ÖZGÜN"
        for (const thesis of group) {
          if (!returnedIds.has(thesis.id)) {
            log.warn("originality_missing_thesis_id_backfilled", {
              service: "originality",
              data: {
                thesisId: thesis.id,
                thesisTitle: thesis.title,
              },
            });
            finalItems.push({
              id: thesis.id,
              problem_sinirlari: {
                gerekce:
                  "Sistem eksik analizi güvenli varsayılan ile doldurdu.",
                secim: "ALAKASIZ",
              },
              teorik_perspektif: {
                gerekce:
                  "Sistem eksik analizi güvenli varsayılan ile doldurdu.",
                secim: "ALAKASIZ",
              },
              metodolojik_kurgu: {
                gerekce:
                  "Sistem eksik analizi güvenli varsayılan ile doldurdu.",
                secim: "ALAKASIZ",
              },
              zaman_mekan_ozgullugu: {
                gerekce:
                  "Sistem eksik analizi güvenli varsayılan ile doldurdu.",
                secim: "ALAKASIZ",
              },
            });
          }
        }
        return finalItems;
      } catch (err) {
        log.warn("originality_chunk_analysis_failed", {
          service: "originality",
          error: err,
          data: {
            chunkIds: group.map((t) => t.id),
          },
        });
        // Graceful error fallback for all theses in this group to avoid failing onboarding
        return group.map((t) => ({
          id: t.id,
          problem_sinirlari: {
            gerekce: "Analiz sırasında hata oluştu.",
            secim: "ALAKASIZ",
          },
          teorik_perspektif: {
            gerekce: "Analiz sırasında hata oluştu.",
            secim: "ALAKASIZ",
          },
          metodolojik_kurgu: {
            gerekce: "Analiz sırasında hata oluştu.",
            secim: "ALAKASIZ",
          },
          zaman_mekan_ozgullugu: {
            gerekce: "Analiz sırasında hata oluştu.",
            secim: "ALAKASIZ",
          },
        }));
      }
    });

    const results = await Promise.all(analysisPromises);
    const overlapTable = results.flat();

    log.preview(
      "Overlap Analysis Results",
      overlapTable.map((o) => ({
        id: o.id,
        axes: {
          problem_sinirlari: o.problem_sinirlari.secim,
          teorik_perspektif: o.teorik_perspektif.secim,
          metodolojik_kurgu: o.metodolojik_kurgu.secim,
          zaman_mekan_ozgullugu: o.zaman_mekan_ozgullugu.secim,
        },
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
