import { GoogleGenAI } from "@google/genai";

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Checks if the error thrown by the Gemini API is a transient error that warrants a retry.
 */
function isTransientError(error: any): boolean {
  const errMsg = error?.message || String(error);

  // Check if it's a JSON string containing the typical API error response
  try {
    const parsed = JSON.parse(errMsg);
    const code = parsed?.error?.code || parsed?.code;
    const status = parsed?.error?.status || parsed?.status;
    if (code === 503 || code === 429 || code === 500 || code === 504) {
      return true;
    }
    if (
      status === "UNAVAILABLE" ||
      status === "RESOURCE_EXHAUSTED" ||
      status === "INTERNAL"
    ) {
      return true;
    }
  } catch (e) {
    // Parsing failed, proceed to substring analysis
  }

  const lowercaseMsg = errMsg.toLowerCase();
  return (
    lowercaseMsg.includes("503") ||
    lowercaseMsg.includes("429") ||
    lowercaseMsg.includes("500") ||
    lowercaseMsg.includes("504") ||
    lowercaseMsg.includes("unavailable") ||
    lowercaseMsg.includes("resource_exhausted") ||
    lowercaseMsg.includes("high demand") ||
    lowercaseMsg.includes("try again later") ||
    lowercaseMsg.includes("rate limit") ||
    lowercaseMsg.includes("quota exceeded") ||
    lowercaseMsg.includes("overloaded")
  );
}

/**
 * Wrapper for ai.models.generateContent that implements exponential backoff with full jitter.
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  options: RetryOptions = {},
): Promise<ReturnType<GoogleGenAI["models"]["generateContent"]>> {
  const {
    maxRetries = 4,
    initialDelayMs = 1000,
    maxDelayMs = 8000,
    backoffFactor = 2,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      const isTransient = isTransientError(error);

      if (!isTransient || attempt > maxRetries) {
        console.error(
          `[Gemini Retry] Call failed permanently after ${attempt} attempt(s) (Transient: ${isTransient}):`,
          error,
        );
        throw error;
      }

      // Calculate exponential delay
      const delay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
      );
      // Full Jitter: randomize delay between 50% and 100% of the calculated backoff delay
      const jitteredDelay = delay / 2 + Math.random() * (delay / 2);

      console.warn(
        `[Gemini Retry] Transient error encountered (Attempt ${attempt}/${maxRetries}). ` +
          `Retrying in ${Math.round(jitteredDelay)}ms... Error: ${
            error?.message || String(error)
          }`,
      );

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
    }
  }
}
