import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { buildQueryGenerationPromptPayload } from "../_prompts/query-generator.prompt";
import type { Logger } from "@/lib/logger";

/** Zod schema for generated dense multi-aspect semantic search queries. */
export const positioningQuerySchema = z.object({
  primaryEmpiricalQuery: z
    .string()
    .describe(
      "Vektör arama motoru için araştırmanın temel ampirik sorunsalını ve olgusunu hedefleyen 20-25 kelimelik yoğun semantik sorgu.",
    ),
  actorsAndSourcesQuery: z
    .string()
    .describe(
      "Araştırmanın dayandığı kuramsal modelleri, kavramsal çerçeveyi ve temel analitik eksenleri hedefleyen 20-25 kelimelik semantik sorgu.",
    ),
  periodAndContextQuery: z
    .string()
    .describe(
      "Araştırmanın yöntemini, vaka/örneklem yapısını, dönemini veya ampirik bağlamını hedefleyen 20-25 kelimelik semantik sorgu.",
    ),
  substantiveKeywords: z
    .array(z.string())
    .describe(
      "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik olgu, aktör, kuram ve yöntem kavramı.",
    ),
});

export type PositioningQuery = z.infer<typeof positioningQuerySchema>;

/** JSON schema matching positioningQuerySchema for Gemini structured outputs. */
export const positioningQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    primaryEmpiricalQuery: {
      type: "string",
      description:
        "Vektör arama motoru için araştırmanın temel ampirik sorunsalını ve olgusunu hedefleyen 20-25 kelimelik yoğun semantik sorgu.",
    },
    actorsAndSourcesQuery: {
      type: "string",
      description:
        "Araştırmanın dayandığı kuramsal modelleri, kavramsal çerçeveyi ve temel analitik eksenleri hedefleyen 20-25 kelimelik semantik sorgu.",
    },
    periodAndContextQuery: {
      type: "string",
      description:
        "Araştırmanın yöntemini, vaka/örneklem yapısını, dönemini veya ampirik bağlamını hedefleyen 20-25 kelimelik semantik sorgu.",
    },
    substantiveKeywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik olgu, aktör, kuram ve yöntem kavramı.",
    },
  },
  required: [
    "primaryEmpiricalQuery",
    "actorsAndSourcesQuery",
    "periodAndContextQuery",
    "substantiveKeywords",
  ],
  additionalProperties: false,
};

/**
 * Generates 3 complementary empirical, theoretical, and methodological semantic search queries
 * from the thesis matrix using FLASH_LITE_35 with LOW thinking for high speed and determinism.
 *
 * @param matrix - The positioning matrix containing subjectProblem, theoreticalFramework, methodology.
 * @param logger - Optional logger for observability.
 * @returns The structured multi-aspect positioning query output.
 */
export async function generatePositioningQuery(
  matrix: { subjectProblem: string },
  logger?: Logger,
): Promise<PositioningQuery> {
  const payload = buildQueryGenerationPromptPayload(matrix);

  try {
    const result = await generateGeminiStructuredContent<PositioningQuery>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      positioningQueryJsonSchema,
      logger,
      {
        zodSchema: positioningQuerySchema,
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
      primaryEmpiricalQuery: fallbackSlice,
      actorsAndSourcesQuery: fallbackSlice,
      periodAndContextQuery: fallbackSlice,
      substantiveKeywords: [],
    };
  }
}
