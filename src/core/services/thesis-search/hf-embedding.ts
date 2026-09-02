import type { Logger } from "@/lib/logger";
import {
  DEFAULT_MAX_DELAY,
  HttpError,
  withRetry,
} from "@/core/services/ai/llm-retry";
import { getHfEmbeddingEndpoint } from "@/core/config/endpoints";

const MAX_RETRIES = 3;

/** Non-retryable HF endpoint deprecation signals — old `api-inference.huggingface.co` path gone. */
export const HF_DEPRECATED_STATUSES = [404, 410] as const;
export const HF_DEPRECATED_ERROR = "HF_DEPRECATED_ENDPOINT" as const;

export class HfDeprecatedEndpointError extends Error {
  public readonly status: number;
  constructor(status: number, body: string) {
    super(`${HF_DEPRECATED_ERROR}: HTTP ${status} — HF embedding endpoint unavailable: ${body.slice(0, 200)}`);
    this.name = "HfDeprecatedEndpointError";
    this.status = status;
  }
}

function isDeprecatedStatus(status: number): boolean {
  return (HF_DEPRECATED_STATUSES as readonly number[]).includes(status);
}

/**
 * L2-normalizes a vector to unit length for Cosine distance.
 * Returns the raw vector and logs a warning when norm is zero or non-finite
 * (zero-vector guard — Qdrant Cosine expects unit vectors).
 *
 * @param vector - Raw embedding vector from HF.
 * @param logger - Optional logger for the zero-norm warning.
 * @returns Unit-length vector (or raw vector when norm is 0).
 */
function normalizeL2(vector: number[], logger?: Logger): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0 || !Number.isFinite(norm)) {
    logger?.warn("hf_embedding_zero_norm", {
      service: "thesis-search",
      filePath: "src/core/services/thesis-search/hf-embedding.ts",
      data: { message: "Zero or non-finite L2 norm — returning raw vector.", dimensions: vector.length },
    });
    return vector;
  }
  return vector.map((v) => v / norm);
}

/**
 * Generates a 768-dimensional embedding vector for a query using
 * `intfloat/multilingual-e5-base` via Hugging Face Serverless Inference API.
 *
 * @param query - Raw query text.
 * @param logger - Optional logger for observability.
 * @param silent - When true, suppresses the start/success log pair for flat pipelines.
 * @returns 768-dimensional dense vector array.
 */
export async function getE5QueryEmbedding(
  query: string,
  logger?: Logger,
  silent = false,
  externalSignal?: AbortSignal,
): Promise<number[]> {
  const hfApiKey = process.env.HUGGINGFACE_API_KEY ?? "";

  if (!hfApiKey) {
    throw new Error("HUGGINGFACE_API_KEY environment variable is not defined.");
  }

  const trimmed = query.trim();
  const inputWithPrefix = trimmed.startsWith("query: ")
    ? trimmed
    : `query: ${trimmed}`;

  const startTime = performance.now();

  try {
    const endpoint = getHfEmbeddingEndpoint();
    const vector = await withRetry(
      async (): Promise<number[]> => {
        if (externalSignal?.aborted) throw new DOMException("Aborted", "AbortError");
        const internalController = new AbortController();
        const timeoutId = setTimeout(() => internalController.abort(), 20_000);
        const onExternalAbort = () => internalController.abort();
        externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

        try {
          // Prefer external signal when available; combine via `any` if possible
          const fetchSignal: AbortSignal =
            externalSignal &&
            typeof (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any ===
              "function"
              ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([
                  externalSignal,
                  internalController.signal,
                ])
              : externalSignal ?? internalController.signal;

          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hfApiKey}`,
            },
            body: JSON.stringify({ inputs: [inputWithPrefix] }),
            signal: fetchSignal,
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            if (isDeprecatedStatus(res.status)) {
              logger?.error("hf_endpoint_deprecated", {
                service: "thesis-search",
                filePath: "src/core/services/thesis-search/hf-embedding.ts",
                data: {
                  message: `HF embedding endpoint ${res.status} — router path may be deprecated. Check HF_EMBEDDING_ENDPOINT / HF_E5_ENDPOINT.`,
                  status: res.status,
                  endpoint,
                  bodyPreview: errText.slice(0, 200),
                },
              });
              throw new HfDeprecatedEndpointError(res.status, errText);
            }
            throw new HttpError(res.status, errText, null);
          }

          const data = (await res.json()) as unknown;

          if (Array.isArray(data) && Array.isArray(data[0])) {
            return normalizeL2(data[0] as number[], logger);
          }

          if (Array.isArray(data) && typeof data[0] === "number") {
            return normalizeL2(data as number[], logger);
          }

          throw new Error(
            "Unexpected embedding response structure from Hugging Face.",
          );
        } finally {
          clearTimeout(timeoutId);
          externalSignal?.removeEventListener("abort", onExternalAbort);
        }
      },
      {
        maxRetries: MAX_RETRIES,
        baseDelay: 500,
        maxDelay: DEFAULT_MAX_DELAY,
        isRetryable: (error) => {
          if (error instanceof HfDeprecatedEndpointError) return false;
          if (error instanceof HttpError) {
            if (isDeprecatedStatus(error.status)) return false;
            return (
              error.status === 429 ||
              error.status >= 500 ||
              error.status === 503
            );
          }
          return true;
        },
        onRetry: (attempt, delayMs, error) => {
          logger?.retry("hf_embedding", {
            service: "thesis-search",
            filePath: "src/core/services/thesis-search/hf-embedding.ts",
            durationMs: delayMs,
            error,
            data: {
              summary: `(attempt ${attempt}/${MAX_RETRIES})`,
              attempt,
              delayMs: Math.round(delayMs),
            },
          });
        },
      },
    );

    const durationMs = performance.now() - startTime;
    if (!silent) {
      logger?.success("hf_embedding", {
        service: "thesis-search",
        filePath: "src/core/services/thesis-search/hf-embedding.ts",
        step: "get_query_embedding",
        durationMs,
        data: { query: trimmed, dimensions: vector.length },
      });
    }

    return vector;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.failed("hf_embedding", {
      service: "thesis-search",
      filePath: "src/core/services/thesis-search/hf-embedding.ts",
      durationMs,
      error: err,
    });
    throw err;
  }
}
