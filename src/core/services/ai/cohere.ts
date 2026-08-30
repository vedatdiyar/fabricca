import { Logger } from "@/lib/logger";
import {
  HttpError,
  withRetry,
  DEFAULT_MAX_DELAY,
} from "@/core/services/ai/llm-retry";
import { createRateLimiter } from "@/lib/rate-limiter";
import { COHERE_LIMITS } from "@/core/config/rate-limits";
import { COHERE_RERANK_URL } from "@/core/config/endpoints";
import { toAiProviderError } from "./llm-errors";

/** Multilingual (incl. Turkish) Cohere Rerank model ID — 32,768-token context. */
export const COHERE_RERANK_MODEL = "rerank-v4.0-pro";
/** Maximum duration to wait for a Cohere Rerank response before aborting. */
const COHERE_TIMEOUT_MS = 30000;
/** Maximum retry attempts for transient Cohere failures (429/5xx). */
const COHERE_MAX_RETRIES = 3;



/**
 * Global Cohere Rerank limiter (trial key: 10 req/min). All parallel pipeline
 * consumers (RAG search, positioning sifting, literature expansion) queue on the
 * same limiter so combined traffic never exceeds the trial-rate ceiling.
 */
const cohereRequestQueue = createRateLimiter(COHERE_LIMITS);

/**
 * Parses the `Retry-After` header from a Cohere API response into milliseconds.
 *
 * @param response - The HTTP response to inspect.
 * @returns The retry delay in milliseconds, or null when absent or unparseable.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  return null;
}

/** Individual rerank result returned from Cohere Rerank. */
export interface RerankResult {
  index: number;
  relevanceScore: number;
}

/** Parameters required for executing a Rerank request. */
export interface RerankParams {
  query: string;
  documents: string[];
  topN?: number;
  logger?: Logger;
  silent?: boolean;
}

/**
 * Reranks all documents against a query via Cohere rerank-v4.0-pro, returning the full
 * score list so the caller applies its own deterministic cutoff. No fallback models or
 * synthetic scores are used; any failure aborts the pipeline with a thrown error.
 *
 * @param params - Object containing the query, documents, optional topN limit, and optional logger.
 * @returns The reranked results sorted by descending relevance score.
 */
export async function rerankWithCohere(
  params: RerankParams,
): Promise<RerankResult[]> {
  const { query, documents, logger, silent } = params;

  if (documents.length === 0) return [];

  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    const error = new Error("COHERE_API_KEY is not defined; cannot rerank.");
    logger?.error("cohere_rerank_key_missing", {
      service: "cohere",
      error,
    });
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COHERE_TIMEOUT_MS);

  const rerankStart = performance.now();

  try {
    const response = await cohereRequestQueue.exec(() =>
      withRetry(
        async (): Promise<Response> => {
          const res = await fetch(COHERE_RERANK_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: COHERE_RERANK_MODEL,
              query,
              documents,
              top_n: documents.length,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new HttpError(
              res.status,
              errText,
              parseRetryAfterHeader(res),
            );
          }

          return res;
        },
        {
          maxRetries: COHERE_MAX_RETRIES,
          baseDelay: 1000,
          maxDelay: DEFAULT_MAX_DELAY,
          isRetryable: (error) => {
            if (error instanceof HttpError) {
              return error.status === 429 || error.status >= 500;
            }
            return false;
          },
          getRetryAfter: (error) =>
            error instanceof HttpError ? error.retryAfter : null,
          onRetry: (attempt, delayMs, error) => {
            logger?.retry("cohere_rerank", {
              service: "cohere",
              durationMs: delayMs,
              error,
              data: {
                summary: `(attempt ${attempt}/${COHERE_MAX_RETRIES})`,
                attempt,
                delayMs: Math.round(delayMs),
              },
            });
          },
        },
      ),
    );

    const data = (await response.json()) as {
      results?: Array<{ index: number; relevance_score?: number }>;
      message?: string;
    };

    if (!data.results || data.results.length === 0) {
      throw new Error(
        `Cohere Rerank response missing results: ${data.message || JSON.stringify(data)}`,
      );
    }

    const results = data.results
      .map((item) => ({
        index: item.index,
        relevanceScore: item.relevance_score ?? 0,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const durationMs = Math.round(performance.now() - rerankStart);
    if (!silent) {
      logger?.success("cohere_rerank", {
        service: "cohere",
        durationMs,
        data: {
          summary: `(${documents.length} docs)`,
          returned: results.length,
          expected: documents.length,
        },
      });
    }

    return results;
  } catch (error) {
    const durationMs = Math.round(performance.now() - rerankStart);
    logger?.failed("cohere_rerank", {
      service: "cohere",
      durationMs,
      error,
    });
    throw toAiProviderError(error, "cohere");
  } finally {
    clearTimeout(timer);
  }
}
