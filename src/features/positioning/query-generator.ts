import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/services/ai";
import { buildQueryGenerationPromptPayload } from "./prompts/query-generator.prompt";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "./validation";

/** Zod schema for generated dense semantic search queries. */
export const positioningQuerySchema = z.object({
  primaryQuery: z
    .string()
    .describe(
      "Vektör arama motoru için en fazla 20-30 kelimelik, araştırmanın temel olgusal nesnesini, aktörlerini, dönemini ve sorunsalını içeren yüksek yoğunluklu semantik arama sorgusu.",
    ),
  substantiveKeywords: z
    .array(z.string())
    .describe(
      "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 3-6 adet spesifik akademik olgu ve aktör kavramı.",
    ),
});

export type PositioningQuery = z.infer<typeof positioningQuerySchema>;

/** Vanilla JSON schema for Gemini structured output. */
export const positioningQueryJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    primaryQuery: {
      type: "string",
      description:
        "Vektör arama motoru için en fazla 20-30 kelimelik, araştırmanın temel olgusal nesnesini, aktörlerini, dönemini ve sorunsalını içeren yüksek yoğunluklu semantik arama sorgusu.",
    },
    substantiveKeywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 3-6 adet spesifik akademik olgu ve aktör kavramı.",
    },
  },
  required: ["primaryQuery", "substantiveKeywords"],
  additionalProperties: false,
};

/**
 * Generates a dense, distilled semantic query from the thesis matrix using FLASH_LITE_31 and HIGH thinking.
 *
 * @param matrix - The 3-component positioning matrix.
 * @param logger - Optional logger for observability.
 * @returns The structured positioning query output.
 */
export async function generatePositioningQuery(
  matrix: PositioningMatrixInput,
  logger?: Logger,
): Promise<PositioningQuery> {
  const payload = buildQueryGenerationPromptPayload(matrix);

  try {
    const result = await generateGeminiStructuredContent<PositioningQuery>(
      FLASH_LITE_31,
      payload.systemInstruction,
      payload.userPrompt,
      positioningQueryJsonSchema,
      logger,
      {
        zodSchema: positioningQuerySchema,
        payloadStage: "positioning_query_generation",
        seed: GEMINI_SEED,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        thesisMatrix: matrix,
        quiet: true,
      },
    );

    return result;
  } catch (error) {
    logger?.warn("positioning_query_generation_fallback", { error });
    // Safe fallback if LLM query generation fails
    return {
      primaryQuery: matrix.subjectProblem.slice(0, 300),
      substantiveKeywords: [],
    };
  }
}
