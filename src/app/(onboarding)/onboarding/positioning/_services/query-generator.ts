import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { buildQueryGenerationPromptPayload } from "../_prompts/query-generator.prompt";
import type { Logger } from "@/lib/logger";
import type { PositioningMatrixInput } from "./validation";

/** Zod schema for generated dense multi-aspect empirical semantic search queries. */
export const positioningQuerySchema = z.object({
  primaryEmpiricalQuery: z
    .string()
    .describe(
      "Vektör arama motoru için araştırmanın temel ampirik sorunsalını ve olgusunu hedefleyen 20-25 kelimelik yoğun semantik sorgu.",
    ),
  actorsAndSourcesQuery: z
    .string()
    .describe(
      "Araştırmanın incelediği somut aktörleri, kurumları, partileri veya birincil yayın/veri kaynaklarını hedefleyen semantik sorgu.",
    ),
  periodAndContextQuery: z
    .string()
    .describe(
      "Araştırmanın odaklandığı tarihsel dönemi, dönemsel kırılmaları veya somut coğrafi/mekânsal bağlamı hedefleyen semantik sorgu.",
    ),
  substantiveKeywords: z
    .array(z.string())
    .describe(
      "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik olgu, aktör ve dönem kavramı.",
    ),
});

export type PositioningQuery = z.infer<typeof positioningQuerySchema>;

/** Vanilla JSON schema for Gemini structured output. */
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
        "Araştırmanın incelediği somut aktörleri, kurumları, partileri veya birincil yayın/veri kaynaklarını hedefleyen semantik sorgu.",
    },
    periodAndContextQuery: {
      type: "string",
      description:
        "Araştırmanın odaklandığı tarihsel dönemi, dönemsel kırılmaları veya somut coğrafi/mekânsal bağlamı hedefleyen semantik sorgu.",
    },
    substantiveKeywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Literatür eşleştirmesinde ve yeniden sıralamada kullanılacak 4-6 adet spesifik akademik olgu, aktör ve dönem kavramı.",
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
 * Generates dense, multi-aspect empirical semantic search queries purely from the subjectProblem
 * using FLASH_LITE_31 and HIGH thinking.
 *
 * @param matrix - The positioning matrix containing subjectProblem.
 * @param logger - Optional logger for observability.
 * @returns The structured multi-aspect positioning query output.
 */
export async function generatePositioningQuery(
  matrix: PositioningMatrixInput | { subjectProblem: string },
  logger?: Logger,
): Promise<PositioningQuery> {
  const payload = buildQueryGenerationPromptPayload(matrix.subjectProblem);

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
    const fallbackSlice = matrix.subjectProblem.slice(0, 250);
    return {
      primaryEmpiricalQuery: fallbackSlice,
      actorsAndSourcesQuery: fallbackSlice,
      periodAndContextQuery: fallbackSlice,
      substantiveKeywords: [],
    };
  }
}
