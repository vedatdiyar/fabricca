import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type {
  OverlapLevel,
  TezaraThesisDetails,
  ThesisBadge,
} from "@/lib/types";
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

/**
 * Categorical ordering from lowest to highest risk.
 */
const LEVEL_ORDER: OverlapLevel[] = ["OZGUN", "ORTA", "KRITIK"];

/**
 * Gemini'nin düz boolean + evidence şemasından döndürdüğü
 * tek bir aday tez karşılaştırma satırının tip tanımı.
 *
 * Bu interface hem `analyzeOriginalityRisk` çıktısında hem de
 * `calculateOriginalityRisk` girdisinde ortak tip olarak kullanılarak
 * iki fonksiyon arasındaki pipe'ın tip güvenliğini garanti eder.
 */
export interface GeminiOverlapItem {
  id: number;
  comparisonNote: string;
  subject: OverlapLevel;
  context: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
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
    subject: OverlapLevel;
    theory: OverlapLevel;
    methodology: OverlapLevel;
    context: OverlapLevel;
  };
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: ThesisBadge;
  overlapTable: CalculatedOverlapItem[];
  eliminatedTheses: CalculatedOverlapItem[];
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
    axes.context ?? "OZGUN",
  ];
  let max: OverlapLevel = "OZGUN";
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
    axes.context ?? "OZGUN",
  ];
  const sorted = levels.sort(
    (a, b) => LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a),
  );
  return sorted.length > 1 ? sorted[1] : "OZGUN";
}

interface AxesWithOptionalContext {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}

const BADGE_ORDER: ThesisBadge[] = ["IKIZ", "SINIRDAS", "OZGUN"];

/**
 * Compares two theses for sorting: İkiz first, then Sınırdaş, then Özgün.
 * Within the same badge group, highest axis level first, then second-highest,
 * then doctorate over master's, then most recent first.
 */
export function compareThesesByRisk(
  a: { axes: AxesWithOptionalContext; thesisType: string; year: number },
  b: { axes: AxesWithOptionalContext; thesisType: string; year: number },
): number {
  const badgeA = calculateBadge(a.axes);
  const badgeB = calculateBadge(b.axes);
  const badgeDiff = BADGE_ORDER.indexOf(badgeA) - BADGE_ORDER.indexOf(badgeB);
  if (badgeDiff !== 0) return badgeDiff;

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
 * Determines the project-level global thesis badge by evaluating each
 * remaining thesis through calculateBadge. Priority order: IKIZ > SINIRDAS > OZGUN.
 * - Table empty → "OZGUN"
 */
function evaluateGlobalBadge(overlapTable: CalculatedOverlapItem[]): {
  badge: ThesisBadge;
} {
  if (overlapTable.length === 0) {
    return { badge: "OZGUN" };
  }

  let hasIkiz = false;
  let hasSinirdas = false;

  for (const item of overlapTable) {
    const b = calculateBadge(item.axes);
    if (b === "IKIZ") hasIkiz = true;
    else if (b === "SINIRDAS") hasSinirdas = true;
  }

  if (hasIkiz) return { badge: "IKIZ" };
  if (hasSinirdas) return { badge: "SINIRDAS" };
  return { badge: "OZGUN" };
}

/**
 * Gemini'nin düz boolean + evidence çıktısını alarak her aday tez için
 * deterministik İkincil Katman ve Küme Matematiği ile KRITIK / ORTA / OZGUN
 * sınıflandırması üretir.
 *
 * Eleme kuralı: Subject ve Context eksenleri aynı anda OZGUN ise tez
 * eliminatedTheses listesine taşınır.
 *
 * Metodoloji ekseni Gemini şemasında bulunmadığından sabit OZGUN olarak atanır.
 *
 * @param overlapTable - Gemini'dan dönen düz boolean overlap tablosu
 * @param validDetails - TEZARA'dan çekilen tez detayları
 * @param logger - Opsiyonel loglama servisi
 * @returns Badge, kalan ve elenen tez listeleri
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
      originalityBadge: "OZGUN",
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

    const axes = {
      subject: item.subject,
      theory: item.theory,
      methodology: item.methodology,
      context: item.context,
    };

    const thesisEntry: CalculatedOverlapItem = {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      comparisonNote: item.comparisonNote,
      yokPdfUrl: detail.yokPdfUrl,
      axes,
    };

    // Gate: Toplam uyuşan eksen sayısı 1 veya daha az ise bu çalışma alakasız/düşük risk kabul edilerek elenir
    const totalNonOriginal =
      (axes.subject !== "OZGUN" ? 1 : 0) +
      (axes.theory !== "OZGUN" ? 1 : 0) +
      (axes.methodology !== "OZGUN" ? 1 : 0) +
      (axes.context !== "OZGUN" ? 1 : 0);

    const isEliminated = totalNonOriginal <= 1;

    if (isEliminated) {
      logger?.info("originality_thesis_eliminated", {
        service: "originality",
        data: {
          context: "calculateOriginalityRisk",
          reason: "low_overall_axis_overlap",
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
    originalityBadge: globalBadge.badge,
    overlapTable: calculatedOverlapTable,
    eliminatedTheses,
  };
}

/**
 * Hedef tez ile tespit edilen aday akademik tezler arasında, deterministik
 * ikincil katman boolean şeması üzerinden karşılaştırma analizi yapar.
 *
 * @param params - Hedef tez matrisi ve aday tez detayları
 * @param log - Loglama servisi
 * @param chunkSize - Paralel Gemini çağrılarında kullanılacak grup boyutu
 * @returns Gemini'nin ürettiği düz boolean overlap tablosu
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
  chunkSize = 4,
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

      return result.overlapTable || [];
    });

    const results = await Promise.all(analysisPromises);
    const overlapTable = results.flat();

    log.preview(
      "Overlap Analysis Results",
      overlapTable.map((o) => ({
        id: o.id,
        axes: {
          subject: o.subject,
          context: o.context,
          theory: o.theory,
          methodology: o.methodology,
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
