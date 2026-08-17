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
