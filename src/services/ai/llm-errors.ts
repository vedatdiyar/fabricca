import { z } from "zod";
import { AiProviderError } from "@/lib/errors/app-error";

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

/**
 * Extracts the recommended retry delay in milliseconds from a Google RPC RetryInfo error or message.
 *
 * @param error - The thrown error to inspect.
 * @returns The extracted delay in milliseconds, or null if not found.
 */
export function extractRetryDelayMs(error: unknown): number | null {
  if (!error) return null;

  if (error instanceof Error) {
    // Check parsed RPC details if present on error object
    const errObj = error as unknown as Record<string, unknown>;
    if (Array.isArray(errObj.details)) {
      const retryInfo = errObj.details.find((d: Record<string, unknown>) =>
        d?.["@type"]?.toString().includes("RetryInfo"),
      );
      if (retryInfo && typeof retryInfo.retryDelay === "string") {
        const seconds = parseFloat(retryInfo.retryDelay.replace(/s$/, ""));
        if (!isNaN(seconds) && seconds > 0) {
          return Math.round(seconds * 1000);
        }
      }
    }

    // Check JSON in message
    if (typeof error.message === "string") {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.details && Array.isArray(parsed.error.details)) {
          const retryInfo = parsed.error.details.find(
            (d: Record<string, unknown>) =>
              d?.["@type"]?.toString().includes("RetryInfo"),
          );
          if (retryInfo && typeof retryInfo.retryDelay === "string") {
            const seconds = parseFloat(retryInfo.retryDelay.replace(/s$/, ""));
            if (!isNaN(seconds) && seconds > 0) {
              return Math.round(seconds * 1000);
            }
          }
        }
      } catch {
        // message is plain text
      }

      const match = error.message.match(
        /(?:please retry in|retry after|retry in)\s+([\d.]+)\s*s/i,
      );
      if (match && match[1]) {
        const seconds = parseFloat(match[1]);
        if (!isNaN(seconds) && seconds > 0) {
          return Math.round(seconds * 1000);
        }
      }
    }
  }

  return null;
}

export interface QuotaViolationDetails {
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string;
  quotaDimensions?: Record<string, string>;
  retryDelay?: string;
  message?: string;
}

/**
 * Extracts structured QuotaFailure and RetryInfo metadata from a Google RPC error.
 *
 * @param error - The thrown error to inspect.
 * @returns Structured quota violation details or null when absent.
 */
export function extractQuotaDetails(
  error: unknown,
): QuotaViolationDetails | null {
  if (!error) return null;

  let errorObj: Record<string, unknown> | null = null;

  if (error instanceof Error) {
    if (typeof error.message === "string") {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error) {
          errorObj = parsed.error;
        }
      } catch {
        // not json
      }
    }
    if (!errorObj && typeof error === "object") {
      errorObj = error as unknown as Record<string, unknown>;
    }
  }

  if (!errorObj) return null;

  const details = Array.isArray(errorObj.details) ? errorObj.details : [];
  const quotaFailure = details.find((d: Record<string, unknown>) =>
    d?.["@type"]?.toString().includes("QuotaFailure"),
  );
  const retryInfo = details.find((d: Record<string, unknown>) =>
    d?.["@type"]?.toString().includes("RetryInfo"),
  );
  const violation = (
    quotaFailure as { violations?: Array<Record<string, unknown>> }
  )?.violations?.[0];

  if (!quotaFailure && !retryInfo && !errorObj.message) return null;

  return {
    quotaMetric:
      typeof violation?.quotaMetric === "string"
        ? violation.quotaMetric
        : undefined,
    quotaId:
      typeof violation?.quotaId === "string" ? violation.quotaId : undefined,
    quotaValue:
      typeof violation?.quotaValue === "string"
        ? violation.quotaValue
        : undefined,
    quotaDimensions:
      (violation?.quotaDimensions as Record<string, string>) ?? undefined,
    retryDelay:
      typeof retryInfo?.retryDelay === "string"
        ? retryInfo.retryDelay
        : undefined,
    message:
      typeof errorObj.message === "string" ? errorObj.message : undefined,
  };
}

const TURKISH_ERROR_BY_SCENARIO: Record<ErrorScenario, string> = {
  quota:
    "Yapay zeka hizmetinin anlık kullanım limitine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
  network:
    "Yapay zeka hizmetine bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  system:
    "Yapay zeka hizmeti şu anda yanıt veremiyor. Lütfen daha sonra tekrar deneyin.",
};

/**
 * Wraps any thrown AI provider failure into an `AiProviderError` with a Turkish
 * scenario-based user message, preserving the original error as the cause.
 *
 * @param error - The raw thrown error from the provider call.
 * @param provider - The provider name used for technical diagnostics.
 * @returns An `AiProviderError` instance ready to cross the server boundary.
 */
export function toAiProviderError(
  error: unknown,
  provider: string,
): AiProviderError {
  if (error instanceof AiProviderError) return error;

  const scenario = classifyError(error);

  return new AiProviderError({
    cause: error,
    technicalDetails: {
      provider,
      scenario,
      httpStatus: extractHttpStatus(error),
    },
    userMessage: TURKISH_ERROR_BY_SCENARIO[scenario],
  });
}
