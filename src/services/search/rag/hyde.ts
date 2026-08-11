import { z } from "zod";
import { generateStructuredContent } from "@/lib/services/cerebras";
import { CEREBRAS_MODEL } from "@/lib/constants";
import type { Logger } from "@/lib/logger";
import { buildHyDeSystemInstruction } from "@/lib/prompts";

/** Structured schema for cross-lingual query expansion and HyDE snippet generation. */
export const HyDeExpansionSchema = z.object({
  detectedLanguage: z
    .enum(["tr", "en", "other"])
    .describe("The detected language of the user query."),
  targetTranslation: z
    .string()
    .describe(
      "Academic translation of the query into the complementary language (TR -> EN, EN -> TR).",
    ),
  targetKeywords: z
    .array(z.string())
    .describe("Key academic terminology in the target language."),
  hypotheticalSnippet: z
    .string()
    .describe(
      "A 2-3 sentence hypothetical academic document snippet in the target language matching the expected literature style.",
    ),
});

export type HyDeExpansionResult = z.infer<typeof HyDeExpansionSchema>;

const JSON_SCHEMA_SPEC = {
  type: "object",
  properties: {
    detectedLanguage: {
      type: "string",
      enum: ["tr", "en", "other"],
      description: "The detected language of the user query.",
    },
    targetTranslation: {
      type: "string",
      description:
        "Academic translation of the query into the complementary language (TR -> EN, EN -> TR).",
    },
    targetKeywords: {
      type: "array",
      items: { type: "string" },
      description: "Key academic terminology in the target language.",
    },
    hypotheticalSnippet: {
      type: "string",
      description:
        "A 2-3 sentence hypothetical academic document snippet in the target language matching the expected literature style.",
    },
  },
  required: [
    "detectedLanguage",
    "targetTranslation",
    "targetKeywords",
    "hypotheticalSnippet",
  ],
  additionalProperties: false,
};

/**
 * Expands and translates a user query using Cerebras Gemma 4 (31B) for bidirectional cross-lingual HyDE retrieval.
 *
 * @param query - The raw user search query.
 * @param logger - Optional logger for structured event tracking.
 * @returns The structured expansion result, or null when expansion fails or API is unavailable.
 */
export async function expandAndTranslateQuery(
  query: string,
  logger?: Logger,
): Promise<HyDeExpansionResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const result = await generateStructuredContent<HyDeExpansionResult>(
      CEREBRAS_MODEL,
      buildHyDeSystemInstruction(),
      trimmed,
      JSON_SCHEMA_SPEC,
      logger,
      {
        payloadStage: "rag_hyde_expansion",
        zodSchema: HyDeExpansionSchema,
      },
    );
    return result;
  } catch (error) {
    logger?.error("rag_hyde_expansion_failed", {
      service: "rag-search",
      error,
      data: { queryLength: trimmed.length },
    });
    return null;
  }
}
