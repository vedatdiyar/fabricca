import { z } from "zod";

export type ErrorScenario = "quota" | "network" | "system";

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

/**
 * Determines whether a thrown provider error is a rate-limit (RPM/RPD/quota) failure.
 *
 * @param error - The thrown error to inspect.
 * @returns True when the error indicates the active key exhausted its rate limit.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as unknown as Record<string, unknown>;
  const status = typeof err.status === "string" ? err.status : "";
  const code = typeof err.code === "number" ? err.code : 0;
  if (status === "RESOURCE_EXHAUSTED" || code === 429) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("rpd") ||
    message.includes("rpm")
  );
}

/**
 * Determines whether a thrown provider error is a server-side overload (503 / UNAVAILABLE)
 * that affects all keys and is best handled with a long backoff rather than key rotation.
 *
 * @param error - The thrown error to inspect.
 * @returns True when the error indicates a server-side overload.
 */
export function isServerOverloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as unknown as Record<string, unknown>;
  const status = typeof err.status === "string" ? err.status : "";
  const code = typeof err.code === "number" ? err.code : 0;
  if (code === 503 || status === "UNAVAILABLE") return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

/**
 * Classifies any error into a user-facing scenario (quota, network, or system).
 *
 * @param error - The error value to classify.
 * @returns The matched error scenario.
 */
export function classifyError(error: unknown): ErrorScenario {
  const message = extractMessage(error);
  if (!message) return "system";

  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("quota")
  ) {
    return "quota";
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("eai_again") ||
    lower.includes("econnreset")
  ) {
    return "network";
  }

  return "system";
}
