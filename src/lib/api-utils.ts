export const CONTACT_EMAIL = "iletisim@fabricca.com";

export const CROSSREF_USER_AGENT = `FabriccaAcademicAssistant/1.0 (mailto:${CONTACT_EMAIL})`;

export const JITTER_FACTOR = 0.3;

export function calculateBackoff(baseDelay: number, attempt: number): number {
  return baseDelay * Math.pow(2, attempt - 1);
}

export function addJitter(
  delay: number,
  jitterPercent = JITTER_FACTOR,
): number {
  return delay + delay * jitterPercent * Math.random();
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
  isRetryable?: (error: unknown, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelay, isRetryable, onRetry } = options;
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
      const backoff = calculateBackoff(baseDelay, attempt);
      const delay = addJitter(backoff);
      onRetry?.(attempt, delay, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
