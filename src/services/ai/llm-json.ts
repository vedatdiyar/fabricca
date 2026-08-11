import { z } from "zod";
import { SchemaValidationError } from "./llm-errors";

/**
 * Strips markdown code fences from a raw text response and parses it as JSON.
 *
 * @param text - The raw model response text.
 * @returns The parsed JSON value cast to type T.
 */
export function sanitizeAndParseJson<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }
  return JSON.parse(cleaned) as T;
}

/**
 * Validates parsed structured output against an optional Zod schema.
 *
 * Throws a SchemaValidationError when validation fails so providers can log
 * tailored events while keeping the shared validation logic in a single place.
 *
 * @param data - The parsed structured output to validate.
 * @param zodSchema - Optional Zod schema used to validate the response.
 */
export function validateStructuredOutput<T>(
  data: unknown,
  zodSchema?: z.ZodType<T>,
): void {
  if (!zodSchema) return;
  const validationResult = zodSchema.safeParse(data);
  if (!validationResult.success) {
    throw new SchemaValidationError(validationResult.error);
  }
}
