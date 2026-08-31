import { extractMessage } from "./llm-errors";
import { extractQuotaDetails } from "./quota-parser";

export type ErrorScenario = "quota" | "network" | "system";

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
 * Determines whether a thrown provider error is specifically a daily quota (RPD / per-day) exhaustion.
 *
 * @param error - The thrown error to inspect.
 * @returns True when the error indicates the active key exhausted its daily quota.
 */
export function isRpdError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  if (
    message.includes("per day") ||
    message.includes("requests per day") ||
    message.includes("daily") ||
    message.includes("perday") ||
    message.includes("rpd") ||
    message.includes("free_tier_requests_per_day") ||
    message.includes("requests_per_day")
  ) {
    return true;
  }
  const quotaDetails = extractQuotaDetails(error);
  const metric = quotaDetails?.quotaMetric?.toLowerCase() ?? "";
  const qId = quotaDetails?.quotaId?.toLowerCase() ?? "";
  if (metric.includes("day") || qId.includes("day")) {
    return true;
  }
  return false;
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
 * Determines whether an error was caused by a client-side or gateway timeout.
 *
 * @param error - The error to inspect.
 * @returns True when the error indicates a timeout.
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError") return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("deadline exceeded")
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
