import { z } from "zod";
import { generateStructuredContent } from "../cerebras";
import { Logger } from "../../logger";
import { CEREBRAS_MODEL } from "../../constants";
import { LITERATURE_SANITIZE_SYSTEM_INSTRUCTION } from "../../prompts";

// ============================================================================
// Vanilla JSON Schema — LLM_INTEGRATION.md Rule 7
// ============================================================================

const SANITIZE_RESPONSE_SCHEMA = {
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
 * Sanitize an array of academic items (title + author) in a single
 * LLM call. Performs APA Title Case normalisation, author name
 * proper-casing, acronym preservation, and Turkish character repair.
 *
 * @param items - Array of academic items with raw title and author fields
 * @param logger - Optional Logger instance for structured LLM call logging
 * @returns Array with sanitised title and author fields in the same order
 */
export async function sanitizeAcademicDataBulk(
  items: AcademicItem[],
  logger?: Logger,
): Promise<AcademicItem[]> {
  if (items.length === 0) return items;

  const result = await generateStructuredContent<SanitizeResponse>(
    CEREBRAS_MODEL,
    LITERATURE_SANITIZE_SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      zodSchema: sanitizeResponseSchema,
      payloadStage: "literature_bulk_sanitization",
    },
  );

  return result.items;
}

/**
 * Lightweight targeted sanitization for the final selected ~12 articles.
 * Uses thinkingBudget: 0 for maximum speed — no deep reasoning needed for
 * Title Case normalisation and Turkish character repair.
 *
 * @param items - Array of academic items with raw title and author fields
 * @param logger - Optional Logger instance
 * @returns Array with sanitised title and author fields in the same order
 */
export async function sanitizeTargetedArticles(
  items: AcademicItem[],
  logger?: Logger,
): Promise<AcademicItem[]> {
  if (items.length === 0) return items;

  const result = await generateStructuredContent<SanitizeResponse>(
    CEREBRAS_MODEL,
    LITERATURE_SANITIZE_SYSTEM_INSTRUCTION,
    JSON.stringify(items),
    SANITIZE_RESPONSE_SCHEMA,
    logger,
    {
      zodSchema: sanitizeResponseSchema,
      payloadStage: "literature_targeted_sanitization",
    },
  );

  return result.items;
}
