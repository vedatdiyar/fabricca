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

/**
 * Minimum relevance score ratio relative to the best candidate, since rerank scores are not calibrated probabilities.
 */
const RELATIVE_SCORE_FLOOR_RATIO = 0.5;

/** Maximum candidate thesis cap passed to the LLM jury prompt. */
export const MAX_THESES = 15;

/**
 * Filters reranked theses to the relative-score floor and safety cap for jury evaluation.
 *
 * @param siftedTheses - The reranked thesis candidates to filter.
 * @returns The filtered thesis list ordered by ascending id.
 */
export function filterThesesForJury(
  siftedTheses: SiftedThesis[],
): SiftedThesis[] {
  if (siftedTheses.length === 0) return [];

  const ranked = [...siftedTheses].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0),
  );

  const topScore = ranked[0]?.relevanceScore ?? 0;
  const floor = topScore * RELATIVE_SCORE_FLOOR_RATIO;

  const result = ranked
    .filter((t) => (t.relevanceScore ?? 0) >= floor)
    .slice(0, MAX_THESES);

  return result.sort((a, b) => a.id - b.id);
}

/** Zod schema for an individual recommended guiding thesis. */
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
      "Tezin kullanıcının çalışmasına doğrudan katkı sunduğu alan (Örn: Metodolojik Karşılaştırma / Kuramsal Çerçeve Metodolojisi)",
    ),
  relevanceReason: z
    .string()
    .describe(
      "Kullanıcının bu tezi kendi tezinde nasıl birincil/ikincil kaynak olarak kullanacağına dair rehber not",
    ),
  doi: z.string().optional().describe("Tezin DOI adresi (varsa)"),
});

/** Zod schema for the LLM jury analysis output. */
export const juryAnalysisResultSchema = z.object({
  globalStatus: z.enum([
    "DIRECT_OVERLAP",
    "NOVEL_GAP_IDENTIFIED",
    "NO_RELATED_LITERATURE",
  ]),
  gapAnalysisSummary: gapAnalysisStructuredSchema,
  recommendedTheses: z
    .array(juryRecommendedThesisSchema)
    .max(6)
    .describe(
      "Kullanıcının tez matrisiyle doğrudan bağı olan 0-6 adet rehber tez. Yapay sayı zorlaması yapılmaz.",
    ),
});

/** Inferred type for the LLM jury analysis result. */
export type JuryAnalysisResult = z.infer<typeof juryAnalysisResultSchema>;

/** JSON Schema for Gemini structured outputs. */
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
            "Mevcut Literatürün Haritalandırılması: Sunulan tezlerin araştırmanın hangi boyutlarını ele aldığının tematik haritası ve akademik özeti. Tezleri tematik gruplara ayırarak 'Literatürdeki tezler X grupta kümelenmektedir. İlk grupta..., ikinci grupta...' şeklinde tematik özetle. Her tezden alıntı yaparken mutlaka APA formatında atıf ver: (Yazar, Yıl).",
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
              "Tezin kullanıcının matrisinde AÇIKÇA TANIMLANAN odağıyla doğrudan örtüşen özel alanı",
          },
          relevanceReason: {
            type: "string",
            description:
              "Tezin çalışmada tez matrisindeki sınırlar çerçevesinde dürüstçe nasıl kaynak olarak kullanılacağına dair rehber açıklama. Asla matriste yer almayan varsayımsal veri kaynakları uydurulmaz.",
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
      description:
        "Süzülen tezler arasından seçilen ve tez matrisiyle doğrudan örtüşen 0-6 adet dürüst rehber tez",
    },
  },
  required: ["globalStatus", "gapAnalysisSummary", "recommendedTheses"],
  additionalProperties: false,
};

/**
 * Runs unified LLM jury analysis over the filtered theses in a single Gemini call.
 *
 * @param input - The validated positioning matrix input.
 * @param siftedTheses - The sifted thesis candidates to evaluate.
 * @param logger - Optional structured logger for pipeline events.
 * @returns The structured jury analysis result.
 */
export async function analyzePositioningJury(
  input: PositioningMatrixInput,
  siftedTheses: SiftedThesis[],
  logger?: Logger,
): Promise<JuryAnalysisResult> {
  const filteredTheses = filterThesesForJury(siftedTheses);

  if (filteredTheses.length === 0) {
    logger?.info("positioning_jury_no_theses", {
      service: "positioning",
      filePath:
        "src/app/(onboarding)/onboarding/positioning/_services/analysis.ts",
      data: { inputSubject: input.subjectProblem },
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

  result.recommendedTheses.sort(
    (a, b) => Number(a.externalThesisId) - Number(b.externalThesisId),
  );

  return result;
}
