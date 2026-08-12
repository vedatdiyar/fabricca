import { Logger } from "@/lib/logger";
import { withRetry, HttpError, DEFAULT_MAX_DELAY } from "@/lib/api-utils";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { toAiProviderError } from "./llm-errors";

const BGE_M3_MODEL = "@cf/baai/bge-m3";
const MAX_EMBEDDING_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Parses the `Retry-After` header from a Cloudflare API response into milliseconds.
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

/**
 * Generates 1024-d embeddings via Cloudflare Workers AI (`@cf/baai/bge-m3`), batching with concurrency 5 and exponential backoff retry.
 *
 * @param texts - The texts to embed.
 * @param logger - Optional logger for embedding events.
 * @returns A 1024-dimensional embedding vector per input text.
 */
export async function generateCloudflareEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    logger?.error("cloudflare_embed_key_missing", {
      service: "cloudflare",
      data: {
        message: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing.",
      },
    });
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables are not defined.",
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${BGE_M3_MODEL}`;
  const MAX_BATCH_TOKENS = 15000;
  const MAX_BATCH_TEXT_COUNT = 50;
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentBatchTokens = 0;

  for (const text of texts) {
    const estimatedTokens = Math.ceil(text.length / 4);
    if (
      currentBatch.length > 0 &&
      (currentBatchTokens + estimatedTokens > MAX_BATCH_TOKENS ||
        currentBatch.length >= MAX_BATCH_TEXT_COUNT)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchTokens = 0;
    }
    currentBatch.push(text);
    currentBatchTokens += estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const batchResults: number[][][] = [];
  const maxConcurrency = 5;
  const embeddingQueue = createConcurrencyLimiter(maxConcurrency);

  const queuedBatches = batches.map((batchTexts, batchIndex) =>
    embeddingQueue.exec(() =>
      withRetry(
        async () => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: batchTexts,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new HttpError(
              response.status,
              errText,
              parseRetryAfterHeader(response),
            );
          }

          const data = (await response.json()) as {
            result?: { data?: number[][] };
            success?: boolean;
          };

          if (!data.success || !data.result?.data) {
            throw new Error(
              `Cloudflare AI response invalid: ${JSON.stringify(data)}`,
            );
          }

          return data.result.data;
        },
        {
          maxRetries: MAX_EMBEDDING_RETRIES,
          baseDelay: RETRY_BASE_DELAY_MS,
          maxDelay: DEFAULT_MAX_DELAY,
          isRetryable: (error) => {
            if (error instanceof HttpError) {
              return error.status === 429 || error.status >= 500;
            }
            return true;
          },
          getRetryAfter: (error) =>
            error instanceof HttpError ? error.retryAfter : null,
          onRetry: (attempt, delayMs, error) => {
            const status =
              error instanceof HttpError ? error.status : undefined;
            logger?.info("cloudflare_embed_retry", {
              service: "cloudflare",
              data: {
                batchIndex,
                attempt,
                delayMs: Math.round(delayMs),
                status,
                message: error instanceof Error ? error.message : String(error),
              },
            });
          },
        },
      ),
    ),
  );

  try {
    batchResults.push(...(await Promise.all(queuedBatches)));
  } catch (error) {
    throw toAiProviderError(error, "cloudflare");
  }

  return batchResults.flat();
}

/**
 * Single-source 1024-d embedding engine backed by Cloudflare Workers AI.
 *
 * @param texts - The texts to embed.
 * @param logger - Optional logger for embedding events.
 * @returns A 1024-dimensional embedding vector per input text.
 */
export async function generateVectorEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return generateCloudflareEmbeddings(texts, logger);
}
