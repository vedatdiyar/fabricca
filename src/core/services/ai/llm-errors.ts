import { z } from "zod";
import {
  type ErrorScenario,
  isRateLimitError,
  isRpdError,
  isServerOverloadError,
  classifyError,
} from "./error-classifier";
import {
  extractRetryDelayMs,
  extractQuotaDetails,
  type QuotaViolationDetails,
} from "./quota-parser";
import {
  TURKISH_ERROR_BY_SCENARIO,
  toAiProviderError,
} from "./error-localization";

export type { ErrorScenario, QuotaViolationDetails };
export {
  isRateLimitError,
  isRpdError,
  isServerOverloadError,
  classifyError,
  extractRetryDelayMs,
  extractQuotaDetails,
  TURKISH_ERROR_BY_SCENARIO,
  toAiProviderError,
};

/** Error thrown when structured LLM output fails Zod schema validation. */
export class SchemaValidationError extends Error {
  public readonly zodError: z.ZodError;

  /**
   * Creates a schema validation error carrying the underlying Zod error for diagnostics.
   *
   * @param zodError - The Zod error produced by the failed validation.
   */
  constructor(zodError: z.ZodError) {
    super("Structured output failed Zod schema validation.");
    this.name = "SchemaValidationError";
    this.zodError = zodError;
  }
}

/**
 * Extracts a readable string message from any error value.
 *
 * @param error - The error value to extract a message from.
 * @returns The extracted message, or an empty string.
 */
export function extractMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {}
  }

  return "";
}

/**
 * Extracts a human-readable HTTP status label from a thrown provider error.
 *
 * @param error - The thrown error to inspect.
 * @returns The formatted HTTP status string, or "unknown" when it cannot be determined.
 */
export function extractHttpStatus(error: unknown): string {
  if (error instanceof Error) {
    const err = error as unknown as Record<string, unknown>;
    const status = typeof err.status === "string" ? err.status : "";
    const code = typeof err.code === "number" ? err.code : 0;

    if (code === 429 || status === "RESOURCE_EXHAUSTED")
      return "429 (RESOURCE_EXHAUSTED)";
    if (code === 503 || status === "UNAVAILABLE") return "503 (UNAVAILABLE)";
    if (status) return `${code} (${status})`;
    if (code) return `${code}`;

    if (error.message.includes("429") || error.message.includes("quota"))
      return "429 (RESOURCE_EXHAUSTED)";
    if (error.message.includes("503") || error.message.includes("UNAVAILABLE"))
      return "503 (UNAVAILABLE)";
  }
  return "unknown";
}
