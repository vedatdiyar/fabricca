export const CONTACT_EMAIL = "iletisim@fabricca.com";

export const CROSSREF_USER_AGENT = `FabriccaAcademicAssistant/1.0 (mailto:${CONTACT_EMAIL})`;

export const DEFAULT_MAX_DELAY = 30000;

/**
 * Structured HTTP error that carries status code and an optional
 * `Retry-After` header value so retry logic can use it as a floor.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly retryAfter: number | null;
  public readonly responseBody: string;

  constructor(status: number, responseBody: string, retryAfter: number | null) {
    const msg = `HTTP ${status}: ${responseBody.slice(0, 200)}`;
    super(msg);
    this.name = "HttpError";
    this.status = status;
    this.responseBody = responseBody;
    this.retryAfter = retryAfter;
  }
}

/**
 * Full Jitter — uniformly random between 0 and the exponential cap
 * (`min(maxDelay, baseDelay × 2^(attempt-1))`).
 *
 * When a `retryAfter` floor is present the window shifts:
 *   `[retryAfter, min(maxDelay, retryAfter + cap)]`
 * preventing the herd from retrying in lockstep even when every client
 * receives the same Retry-After value.
 */
export function fullJitterDelay(
  baseDelay: number,
  attempt: number,
  maxDelay: number,
  retryAfter: number | null,
): number {
  const cap = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));

  if (retryAfter != null && retryAfter > 0) {
    const window = Math.min(maxDelay - retryAfter, cap);
    return retryAfter + Math.random() * Math.max(0, window);
  }

  return Math.random() * cap;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  getRetryAfter?: (error: unknown) => number | null;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  isRetryable?: (error: unknown, attempt: number) => boolean;
}

/**
 * Retries `fn` up to `maxRetries` times using Full Jitter exponential backoff.
 *
 * - Errors are passed to `isRetryable` (default: retry everything).
 * - When `getRetryAfter` extracts a positive number the delay is
 *   `retryAfter + random(0, cap)` so the herd spreads.
 * - The total time budget is roughly `baseDelay × 2^maxRetries` or `maxDelay`,
 *   whichever is hit first.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay = DEFAULT_MAX_DELAY,
    isRetryable,
    onRetry,
    getRetryAfter,
  } = options;
  const shouldRetry = isRetryable ?? (() => true);
  let attempt = 0;
  let lastError: unknown;

  while (++attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error, attempt)) throw error;
      if (attempt >= maxRetries) break;
      const retryAfter = getRetryAfter?.(error) ?? null;
      const delay = fullJitterDelay(baseDelay, attempt, maxDelay, retryAfter);
      onRetry?.(attempt, delay, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
