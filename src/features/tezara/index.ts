import { QdrantClient } from "@qdrant/js-client-rest";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import { DEFAULT_MAX_DELAY, HttpError, withRetry } from "@/lib/api-utils";

const QDRANT_URL = process.env.QDRANT_URL ?? "";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? "";
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY ?? "";

const HF_EMBEDDING_ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-base/pipeline/feature-extraction";

/** Maximum number of retry attempts for transient API/network failures. */
const MAX_RETRIES = 3;

/** Global singleton Qdrant client instance. */
let qdrantClient: QdrantClient | null = null;

/**
 * Returns the singleton Qdrant client connected to the Qdrant Cloud cluster.
 *
 * @throws Error when QDRANT_URL is missing.
 * @returns Qdrant client instance.
 */
function getQdrantClient(): QdrantClient {
  if (qdrantClient) {
    return qdrantClient;
  }

  if (!QDRANT_URL) {
    throw new Error("QDRANT_URL environment variable is not defined.");
  }

  qdrantClient = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY || undefined,
  });

  return qdrantClient;
}

/**
 * Generates a 768-dimensional embedding vector for a query using
 * `intfloat/multilingual-e5-base` via Hugging Face Serverless Inference API.
 *
 * @param query - Raw query text.
 * @param logger - Optional logger for observability.
 * @returns 768-dimensional dense vector array.
 */
export async function getE5QueryEmbedding(
  query: string,
  logger?: Logger,
): Promise<number[]> {
  if (!HF_API_KEY) {
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
              Authorization: `Bearer ${HF_API_KEY}`,
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
          logger?.info("hf_embedding_retry", {
            service: "tezara",
            filePath: "src/features/tezara/index.ts",
            step: "get_query_embedding",
            data: {
              attempt,
              delayMs: Math.round(delayMs),
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          });
        },
      },
    );

    const durationMs = performance.now() - startTime;
    logger?.info("hf_embedding_success", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "get_query_embedding",
      durationMs,
      data: { query: trimmed, dimensions: vector.length },
    });

    return vector;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("hf_embedding_failed", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "get_query_embedding",
      durationMs,
      data: { query: trimmed },
      error: err,
    });
    throw err;
  }
}

/**
 * Extracts the most reliable abstract text from a raw thesis payload.
 *
 * @param payload - Raw thesis payload dictionary.
 * @returns Abstract string, preferring original over translated text.
 */
function extractAbstract(payload: Record<string, unknown>): string {
  let abstract = String(
    payload.abstract_original ?? payload.abstract ?? "",
  ).trim();
  if (!abstract || abstract.length < 10 || /^özet yok\.?$/i.test(abstract)) {
    abstract = String(payload.abstract_translated ?? "").trim();
  }
  return abstract;
}

/**
 * Maps a Qdrant point payload to TezaraThesisDetails.
 *
 * @param id - Point ID.
 * @param payload - Raw payload from Qdrant.
 * @returns Standardized thesis details object.
 */
function mapPayloadToDetails(
  id: number,
  payload: Record<string, unknown>,
): TezaraThesisDetails {
  const titleOriginal = String(
    payload.title_original ?? payload.title ?? "",
  ).trim();
  const titleTranslated = String(payload.title_translated ?? "").trim();
  const title =
    titleTranslated && titleTranslated !== titleOriginal
      ? `${titleOriginal} / ${titleTranslated}`
      : titleOriginal;

  return {
    id,
    title,
    author: String(payload.author ?? "N/A"),
    university: String(payload.university ?? "N/A"),
    year: parseInt(String(payload.year ?? "0"), 10) || 0,
    thesisType: String(payload.thesis_type ?? payload.thesisType ?? "N/A"),
    department: String(payload.department ?? "N/A"),
    language: payload.language ? String(payload.language) : undefined,
    abstract: extractAbstract(payload),
    yokPdfUrl: payload.pdf_url ? String(payload.pdf_url) : undefined,
  };
}

/** Search options for precision tuning. */
export interface TezaraSearchOptions {
  limit?: number;
  rankingScoreThreshold?: number;
  filter?: string;
  attributesToSearchOn?: string[];
}

/**
 * Searches the thesis database via Qdrant Vector Index (Cosine Similarity)
 * using `multilingual-e5-base` 768-dimensional embeddings.
 *
 * @param query - Search query string.
 * @param logger - Optional logger for observability.
 * @param options - Optional search parameters (limit, etc.).
 * @returns Matching thesis details.
 * @throws Error if embedding generation or vector search fails.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  options?: TezaraSearchOptions,
): Promise<TezaraThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 100;
  const client = getQdrantClient();

  try {
    const embedding = await getE5QueryEmbedding(query, logger);
    const queryStart = performance.now();

    const searchRes = await client.query("theses", {
      query: embedding,
      limit,
      with_payload: true,
    });

    const qdrantDurationMs = performance.now() - queryStart;
    const totalDurationMs = performance.now() - startTime;

    const results: TezaraThesisDetails[] = [];
    for (const point of searchRes.points) {
      if (!point.id) continue;
      const payload = (point.payload ?? {}) as Record<string, unknown>;
      results.push(mapPayloadToDetails(Number(point.id), payload));
    }

    logger?.info("qdrant_vector_search_success", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "search_qdrant_vector",
      durationMs: totalDurationMs,
      data: {
        query,
        resultCount: results.length,
        qdrantDurationMs: Math.round(qdrantDurationMs),
        limit,
      },
    });

    return results;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("qdrant_vector_search_failed", {
      service: "tezara",
      filePath: "src/features/tezara/index.ts",
      step: "search_failed",
      durationMs,
      data: { query },
      error: err,
    });
    throw err;
  }
}
