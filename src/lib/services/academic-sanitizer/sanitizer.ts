import { z } from "zod";
import { generateStructuredContent } from "../cerebras";
import { Logger } from "../../logger";
import { CEREBRAS_MODEL } from "../../constants";
import { LITERATURE_SANITIZE_SYSTEM_INSTRUCTION } from "../../prompts";

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
