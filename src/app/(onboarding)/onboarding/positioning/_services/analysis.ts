import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import {
  generateStructuredContent,
  type JsonSchema,
} from "@/lib/services/gemini";
import type { Logger } from "@/lib/logger";
import {
  POSITIONING_JURY_SYSTEM_INSTRUCTION,
  buildPositioningJuryUserPrompt,
} from "@/lib/prompts";
import type { SiftedThesis } from "./sifting";
import {
  gapAnalysisStructuredSchema,
  type PositioningMatrixInput,
} from "../_lib/validation";

/** Threshold constant for Cohere relevance score filter. */
export const RELEVANCE_THRESHOLD = 0.75;
/** Minimum target candidate count for jury analysis. */
export const MIN_THESES = 10;
/** Maximum candidate thesis cap passed to LLM jury prompt. */
export const MAX_THESES = 15;

/**
 * Applies empirical threshold filtering (0.75 score bar, Min 10, Max 15) to Cohere-reranked theses.
 *
 * @param siftedTheses - Ordered array of thesis candidates from Cohere Rerank.
 * @returns Array of 10 to 15 filtered candidates tailored for LLM jury evaluation.
 */
export function filterThesesForJury(
  siftedTheses: SiftedThesis[],
): SiftedThesis[] {
  if (siftedTheses.length === 0) return [];

  // Filter candidates with relevance score >= 0.75
  const filtered = siftedTheses.filter(
    (t) => (t.relevanceScore ?? 0) >= RELEVANCE_THRESHOLD,
  );

  if (filtered.length > MAX_THESES) {
    return filtered.slice(0, MAX_THESES);
  }

  if (filtered.length < MIN_THESES) {
    return siftedTheses.slice(0, Math.min(MIN_THESES, siftedTheses.length));
  }

  return filtered;
}

/** Zod schema for individual recommended guiding thesis items. */
export const juryRecommendedThesisSchema = z.object({
  externalThesisId: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe("Süzülen tez listesindeki tez ID'si"),
  title: z.string().describe("Tezin tam akademik başlığı"),
  author: z.string().describe("Tezin yazarı"),
  year: z.number().describe("Tezin hazırlanma yılı"),
  university: z.string().describe("Tezin sunulduğu üniversite"),
  contributionArea: z
    .string()
    .describe(
      "Tezin kullanıcının çalışmasına doğrudan katkı sunduğu alan (Örn: B Aktörünün Söylem Analizi)",
    ),
  relevanceReason: z
    .string()
    .describe(
      "Kullanıcının bu tezi kendi tezinde nasıl birincil/ikincil kaynak olarak kullanacağına dair rehber not",
    ),
  doi: z.string().optional().describe("Tezin DOI adresi (varsa)"),
});

/** Zod schema for LLM Jury Analysis Output. */
export const juryAnalysisResultSchema = z.object({
  globalStatus: z.enum([
    "DIRECT_OVERLAP",
    "NOVEL_GAP_IDENTIFIED",
    "NO_RELATED_LITERATURE",
  ]),
  gapAnalysisSummary: gapAnalysisStructuredSchema,
  recommendedTheses: z
    .array(juryRecommendedThesisSchema)
    .min(4)
    .max(6)
    .describe("Kullanıcının tez yazarken faydalanabileceği 4-6 rehber tez"),
});

/** Inferred TypeScript type for LLM Jury Analysis Result. */
export type JuryAnalysisResult = z.infer<typeof juryAnalysisResultSchema>;

/** JSON Schema specification for Gemini structured outputs. */
export const juryAnalysisResultJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    globalStatus: {
      type: "string",
      enum: ["DIRECT_OVERLAP", "NOVEL_GAP_IDENTIFIED", "NO_RELATED_LITERATURE"],
      description:
        "Yalnızca Konu + Teori + Analiz Birimi BİREBİR aynı ise DIRECT_OVERLAP verilir. Özgün katkı varsa NOVEL_GAP_IDENTIFIED verilir.",
    },
    gapAnalysisSummary: {
      type: "object",
      properties: {
        literatureMapping: {
          type: "string",
          description:
            "Mevcut Literatürün Haritalandırılması: Sunulan tezlerin araştırmanın hangi boyutlarını ele aldığının akademik özeti",
        },
        academicGap: {
          type: "string",
          description:
            "Literatürdeki Boşluk: İncelediğin tezlerin neleri göz ardı ettiği veya yetersiz kaldığı alanların analizi",
        },
        originalContribution: {
          type: "string",
          description:
            "Çalışmanın Özgün Katkısı: Kullanıcının tez matrisinin bu boşluğu nasıl doldurduğu ve literatüre getirdiği yenilik",
        },
      },
      required: ["literatureMapping", "academicGap", "originalContribution"],
      additionalProperties: false,
      description: "3 sabit akademik sentez bölümü",
    },
    recommendedTheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          externalThesisId: {
            type: "string",
            description: "Süzülen tez listesindeki tez ID'si",
          },
          title: { type: "string", description: "Tezin başlığı" },
          author: { type: "string", description: "Tezin yazarı" },
          year: { type: "number", description: "Tezin yılı" },
          university: { type: "string", description: "Tezin üniversitesi" },
          contributionArea: {
            type: "string",
            description:
              "Tezin kullanıcının çalışmasına katkı sunduğu özel alan",
          },
          relevanceReason: {
            type: "string",
            description:
              "Tezin çalışmada kaynak olarak nasıl kullanılacağına dair yönlendirici rehber açıklama",
          },
        },
        required: [
          "externalThesisId",
          "title",
          "author",
          "year",
          "university",
          "contributionArea",
          "relevanceReason",
        ],
        additionalProperties: false,
      },
      description: "Süzülen tezler arasından seçilen 4-6 adet rehber tez",
    },
  },
  required: ["globalStatus", "gapAnalysisSummary", "recommendedTheses"],
  additionalProperties: false,
};

/**
 * Conducts unified LLM Jury Analysis on filtered positioning theses using Gemini 3.1 Flash-Lite in a SINGLE API call.
 * Produces global status, gap analysis markdown summary, and 4-6 recommended guide theses simultaneously.
 *
 * @param input - The validated 5-field positioning matrix input.
 * @param siftedTheses - Candidates returned by searchAndSiftTheses.
 * @param logger - Optional Logger instance for telemetry.
 * @returns Promise resolving to unified JuryAnalysisResult.
 */
export async function analyzePositioningJury(
  input: PositioningMatrixInput,
  siftedTheses: SiftedThesis[],
  logger?: Logger,
): Promise<JuryAnalysisResult> {
  const filteredTheses = filterThesesForJury(siftedTheses);

  if (filteredTheses.length === 0) {
    logger?.warn("positioning_jury_no_theses", {
      service: "positioning",
      filePath:
        "src/app/(onboarding)/onboarding/positioning/_services/analysis.ts",
      data: { inputSubject: input.subjectAndProblem },
    });

    return {
      globalStatus: "NO_RELATED_LITERATURE",
      gapAnalysisSummary: {
        literatureMapping:
          "Veritabanında girilen tez matrisiyle doğrudan ilişkilendirilebilecek herhangi bir akademik teze rastlanmamıştır.",
        academicGap:
          "Doğrudan eşleşen bir çalışma bulunmadığı için mevcut literatürde tespit edilmiş bir çakışma veya doymuşluk alanı bulunmamaktadır.",
        originalContribution:
          "Çalışmanız literatürde henüz işlenmemiş son derece bakir ve yüksek özgünlüğe sahip bir alanda konumlanmaktadır.",
      },
      recommendedTheses: [],
    };
  }

  const thesisListText = filteredTheses
    .map(
      (t, idx) => `[Tez #${idx + 1}] ID: ${t.id}
Başlık: ${t.title}
Yazar: ${t.author || "Bilinmiyor"} (${t.year || "N/A"})
Üniversite/Bölüm: ${t.university || "N/A"} - ${t.department || "N/A"}
Tür: ${t.thesisType || "N/A"} | Dil: ${t.language || "N/A"} | Cohere Skoru: ${t.relevanceScore?.toFixed(4) || "N/A"}
Özet: ${t.abstract}`,
    )
    .join("\n\n---\n\n");

  const userPrompt = buildPositioningJuryUserPrompt(
    input,
    thesisListText,
    filteredTheses.length,
  );

  const result = await generateStructuredContent<JuryAnalysisResult>(
    FLASH_LITE_31,
    POSITIONING_JURY_SYSTEM_INSTRUCTION,
    userPrompt,
    juryAnalysisResultJsonSchema,
    logger,
    {
      zodSchema: juryAnalysisResultSchema,
      payloadStage: "positioning_jury_analysis",
      seed: GEMINI_SEED,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      thesisMatrix: { input, filteredThesesCount: filteredTheses.length },
    },
  );

  return result;
}
