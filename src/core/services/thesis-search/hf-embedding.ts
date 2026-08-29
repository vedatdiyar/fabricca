import type { Logger } from "@/lib/logger";
import {
  DEFAULT_MAX_DELAY,
  HttpError,
  withRetry,
} from "@/core/services/ai/llm-retry";

const HF_EMBEDDING_ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-base/pipeline/feature-extraction";

const MAX_RETRIES = 3;

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
    const vector = await withRetry(
      async (): Promise<number[]> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20_000);

        try {
          const res = await fetch(HF_EMBEDDING_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hfApiKey}`,
            },
            body: JSON.stringify({ inputs: [inputWithPrefix] }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new HttpError(res.status, errText, null);
          }

          const data = (await res.json()) as unknown;

          if (Array.isArray(data) && Array.isArray(data[0])) {
            return data[0] as number[];
          }

          if (Array.isArray(data) && typeof data[0] === "number") {
            return data as number[];
          }

          throw new Error(
            "Unexpected embedding response structure from Hugging Face.",
          );
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        maxRetries: MAX_RETRIES,
        baseDelay: 500,
        maxDelay: DEFAULT_MAX_DELAY,
        isRetryable: (error) => {
          if (error instanceof HttpError) {
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
