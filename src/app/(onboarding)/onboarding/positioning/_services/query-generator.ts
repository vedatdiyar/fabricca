import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import {
  buildQueryGenerationPromptPayload,
  type MatrixInputForQuery,
} from "../_prompts/query-generator.prompt";
import type { Logger } from "@/lib/logger";

/** Zod schema for 4-channel, 6-facet multi-source queries. */
export const multiSourcePositioningQuerySchema = z.object({
  thesisEmpiricalQuery: z
    .string()
    .describe(
      "YÖK tez arşivi için araştırmanın temel ampirik sorunsalını ve vaka alanını hedefleyen yoğun Türkçe semantik sorgu.",
    ),
  thesisMethodologyQuery: z
    .string()
    .describe(
      "YÖK tez arşivi için araştırmanın yöntemini, kuramsal desenini ve analitik modelini hedefleyen Türkçe sorgu.",
    ),
  globalTheoreticalQuery: z
    .string()
    .describe(
      "Uluslararası kuramsal literatür, kavramsal modeller ve seminal yazarlar için İngilizce akademik sorgu.",
    ),
  globalEmpiricalQuery: z
    .string()
    .describe(
      "Benzer uluslararası vakalar, ampirik araştırmalar ve olgusal tartışmalar için İngilizce sorgu.",
    ),
  dergiparkQuery: z
    .string()
    .describe(
      "Türkiye hakemli dergi makaleleri için DergiPark odaklı akademik Türkçe sorgu.",
    ),
  fieldWebQuery: z
    .string()
    .describe(
      "Türkiye sahası, güncel raporlar, mevzuat ve sektörel olgular için Exa arama sorgusu.",
    ),
  substantiveKeywords: z
    .array(z.string())
    .describe(
      "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik olgu, aktör, kuram ve yöntem kavramı.",
    ),
});

export type MultiSourcePositioningQuery = z.infer<
  typeof multiSourcePositioningQuerySchema
>;

/** JSON schema for Gemini structured outputs matching multiSourcePositioningQuerySchema. */
export const multiSourcePositioningQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    thesisEmpiricalQuery: {
      type: "string",
      description:
        "YÖK tez arşivi için araştırmanın temel ampirik sorunsalını ve vaka alanını hedefleyen yoğun Türkçe semantik sorgu.",
    },
    thesisMethodologyQuery: {
      type: "string",
      description:
        "YÖK tez arşivi için araştırmanın yöntemini, kuramsal desenini ve analitik modelini hedefleyen Türkçe sorgu.",
    },
    globalTheoreticalQuery: {
      type: "string",
      description:
        "Uluslararası kuramsal literatür, kavramsal modeller ve seminal yazarlar için İngilizce akademik sorgu.",
    },
    globalEmpiricalQuery: {
      type: "string",
      description:
        "Benzer uluslararası vakalar, ampirik araştırmalar ve olgusal tartışmalar için İngilizce sorgu.",
    },
    dergiparkQuery: {
      type: "string",
      description:
        "Türkiye hakemli dergi makaleleri için DergiPark odaklı akademik Türkçe sorgu.",
    },
    fieldWebQuery: {
      type: "string",
      description:
        "Türkiye sahası, güncel raporlar, mevzuat ve sektörel olgular için Exa arama sorgusu.",
    },
    substantiveKeywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik kavram.",
    },
  },
  required: [
    "thesisEmpiricalQuery",
    "thesisMethodologyQuery",
    "globalTheoreticalQuery",
    "globalEmpiricalQuery",
    "dergiparkQuery",
    "fieldWebQuery",
    "substantiveKeywords",
  ],
  additionalProperties: false,
};

/**
 * Generates 6 complementary multi-channel search queries from the thesis matrix or proposal.
 *
 * @param matrix - The input containing subjectProblem and optional theoretical/methodological context.
 * @param logger - Optional logger for observability.
 * @returns The structured multi-source positioning query output.
 */
export async function generatePositioningQuery(
  matrix: MatrixInputForQuery,
  logger?: Logger,
): Promise<MultiSourcePositioningQuery> {
  const payload = buildQueryGenerationPromptPayload(matrix);

  try {
    const result =
      await generateGeminiStructuredContent<MultiSourcePositioningQuery>(
        FLASH_LITE_35,
        payload.systemInstruction,
        payload.userPrompt,
        multiSourcePositioningQueryJsonSchema,
        logger,
        {
          zodSchema: multiSourcePositioningQuerySchema,
          payloadStage: "positioning_query_generation",
          seed: GEMINI_SEED,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          thesisMatrix: matrix,
          quiet: true,
        },
      );

    return result;
  } catch (error) {
    logger?.warn("positioning_query_generation_fallback", { error });
    const fallbackSlice = matrix.subjectProblem.slice(0, 250);
    return {
      thesisEmpiricalQuery: fallbackSlice,
      thesisMethodologyQuery: fallbackSlice,
      globalTheoreticalQuery: fallbackSlice,
      globalEmpiricalQuery: fallbackSlice,
      dergiparkQuery: `DergiPark ${fallbackSlice}`,
      fieldWebQuery: fallbackSlice,
      substantiveKeywords: [],
    };
  }
}
