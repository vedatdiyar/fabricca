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
 * Computes a Full Jitter delay with exponential backoff, optionally shifted by a Retry-After floor.
 *
 * @param baseDelay - The base delay in milliseconds.
 * @param attempt - The current 1-based retry attempt number.
 * @param maxDelay - The maximum allowed delay in milliseconds.
 * @param retryAfter - A Retry-After floor in milliseconds, or null to ignore.
 * @returns The randomized delay in milliseconds.
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
 * Retries a task up to the configured limit using Full Jitter exponential backoff.
 *
 * @param fn - The async task to retry.
 * @param options - Retry configuration including limits and callbacks.
 * @returns A promise resolving to the task's eventual result.
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
