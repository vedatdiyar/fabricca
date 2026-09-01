import { z } from "zod";
import { ThinkingLevel } from "@google/genai";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/core/services/ai";
import { FLASH_LITE_35 } from "@/lib/constants";
import type { Logger } from "@/lib/logger";
import { buildHyDePromptPayload } from "./prompts/hyde.prompt";

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

const JSON_SCHEMA_SPEC: JsonSchema = {
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
 * Expands and translates a user query using Gemini Flash Lite 3.5 for bidirectional cross-lingual HyDE retrieval.
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

  const payload = buildHyDePromptPayload(trimmed);

  try {
    const result = await generateGeminiStructuredContent<HyDeExpansionResult>(
      FLASH_LITE_35,
      payload.systemInstruction,
      payload.userPrompt,
      JSON_SCHEMA_SPEC,
      logger,
      {
        payloadStage: "rag_hyde_expansion",
        zodSchema: HyDeExpansionSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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
