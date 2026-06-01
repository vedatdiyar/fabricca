/**
 * Custom fetch wrapper for the Neon HTTP driver.
 *
 * Handles transient Neon Control Plane failures (cold-start, scale-to-zero
 * resume, regional hiccups) with:
 *   - Exponential backoff + jitter (1s, 2s, 4s, 8s, 8s+jitter)
 *   - Respect for HTTP `Retry-After` (Neon sends it on 429/503)
 *   - Coverage of 500, 503, 429 status codes
 *   - A retry budget of 5 attempts (total ~15-16s wait) that fits inside
 *     the Vercel Serverless function timeout for proxy/layout hot paths
 */

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

function isRetryableStatus(status: number): boolean {
  return status === 500 || status === 503 || status === 429;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  // Retry-After can be either a delta-seconds value or an HTTP-date.
  // Neon uses delta-seconds, so we just parse it as an integer.
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_DELAY_MS);
  }
  return null;
}

function detectRetryableBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return true; // unknown body → retry
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message : "";
  if (
    message.includes("Control plane request failed") ||
    message.includes("control plane")
  ) {
    return true;
  }
  if (b["neon:retryable"] === true) return true;
  return false;
}

function computeBackoffDelay(
  attempt: number,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs !== null) return retryAfterMs;
  // Exponential: 1s, 2s, 4s, 8s, 8s
  const exp = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  // Jitter: +/- 25% to avoid thundering herd
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.floor(exp + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function neonFetchRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds query timeout

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      lastResponse = response;

      if (response.ok) return response;

      if (!isRetryableStatus(response.status)) {
        // Non-retryable status: surface immediately to caller
        return response;
      }

      // Clone to safely read body for retryability check
      const clone = response.clone();
      let body: unknown = null;
      try {
        body = await clone.json();
      } catch {
        body = null;
      }

      const retryable = detectRetryableBody(body);
      if (!retryable) {
        return response;
      }

      if (attempt >= MAX_ATTEMPTS) {
        console.error(
          `[Neon DB Retry] Exhausted ${MAX_ATTEMPTS} attempts (last status ${response.status}). Giving up.`,
        );
        return response;
      }

      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const delay = computeBackoffDelay(attempt, retryAfter);
      console.warn(
        `[Neon DB Retry] Attempt ${attempt}/${MAX_ATTEMPTS} failed (HTTP ${response.status}). ` +
          `Retrying in ${delay}ms${retryAfter !== null ? " (Retry-After)" : ""}.`,
      );
      await sleep(delay);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) {
        console.error(
          `[Neon DB Retry] Exhausted ${MAX_ATTEMPTS} attempts (network/throw/timeout). Giving up.`,
          error,
        );
        throw error;
      }
      const delay = computeBackoffDelay(attempt, null);
      console.warn(
        `[Neon DB Retry] Attempt ${attempt}/${MAX_ATTEMPTS} threw: ${
          error instanceof Error ? error.message : String(error)
        }. Retrying in ${delay}ms.`,
      );
      await sleep(delay);
    }
  }

  // Unreachable, but TypeScript likes an explicit return path
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("[Neon DB Retry] Unknown failure");
}
