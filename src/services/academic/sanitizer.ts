import { z } from "zod";
import { ThinkingLevel, HarmCategory, HarmBlockThreshold } from "@google/genai";
import {
  generateGeminiStructuredContent,
  type JsonSchema,
} from "@/services/ai";
import { Logger } from "@/lib/logger";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { LITERATURE_SANITIZE_SYSTEM_INSTRUCTION } from "@/lib/prompts";

const SANITIZE_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
        },
        required: ["title", "author"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const sanitizeResponseSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      author: z.string(),
    }),
  ),
});

type SanitizeResponse = z.infer<typeof sanitizeResponseSchema>;

type AcademicItem = { title: string; author: string };

/**
 * Sanitizes academic items (title and author) in a single LLM call.
 *
 * @param items - Academic items to sanitize.
 * @param logger - Optional logger for observability.
 * @returns Sanitized academic items.
 */
export async function sanitizeAcademicDataBulk(
  items: AcademicItem[],
  logger?: Logger,
): Promise<AcademicItem[]> {
  if (items.length === 0) return items;

  const result = await generateGeminiStructuredContent<SanitizeResponse>(
    FLASH_LITE_35,
    LITERATURE_SANITIZE_SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      zodSchema: sanitizeResponseSchema,
      seed: GEMINI_SEED,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      payloadStage: "literature_bulk_sanitization",
    },
  );

  return result.items;
}

/**
 * Lightweight sanitization for a small set of final articles.
 *
 * @param items - Academic items to sanitize.
 * @param logger - Optional logger for observability.
 * @returns Sanitized academic items.
 */
export async function sanitizeTargetedArticles(
  items: AcademicItem[],
  logger?: Logger,
): Promise<AcademicItem[]> {
  if (items.length === 0) return items;

  const result = await generateGeminiStructuredContent<SanitizeResponse>(
    FLASH_LITE_35,
    LITERATURE_SANITIZE_SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      zodSchema: sanitizeResponseSchema,
      seed: GEMINI_SEED,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      payloadStage: "literature_targeted_sanitization",
    },
  );

  return result.items;
}
