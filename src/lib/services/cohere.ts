import type { Logger } from "../logger";
import { withRetry } from "../api-utils";

/** Individual rerank result returned from Cohere API. */
export interface CohereRerankResult {
  index: number;
  relevanceScore: number;
}

/** Parameters required for executing a Cohere Rerank API request. */
export interface CohereRerankParams {
  query: string;
  documents: string[];
  topN?: number;
  model?: string;
  logger?: Logger;
}

const DEFAULT_RERANK_MODEL = "rerank-v4.0-pro";
const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";

/**
 * Invokes Cohere Rerank API to compute semantic relevance scores for candidate documents
 * against a target search query.
 *
 * @param params - Configuration object including query, documents, topN, and optional logger.
 * @returns Sorted array of reranked results with index and relevance score.
 */
export async function rerankWithCohere(
  params: CohereRerankParams,
): Promise<CohereRerankResult[]> {
  const {
    query,
    documents,
    topN = 12,
    model = DEFAULT_RERANK_MODEL,
    logger,
  } = params;

  if (documents.length === 0) {
    return [];
  }

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    logger?.warn("cohere_rerank_key_missing", {
      service: "cohere",
      filePath: "src/lib/services/cohere.ts",
      data: {
        message:
          "COHERE_API_KEY is not defined in environment. Returning un-reranked fallback list.",
      },
    });

    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  }

  try {
    const payload = {
      model,
      query,
      documents,
      top_n: Math.min(topN, documents.length),
    };

    const response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        try {
          const res = await fetch(COHERE_RERANK_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new Error(
              `Cohere Rerank API returned status ${res.status}: ${errorText}`,
            );
          }

          return res.json() as Promise<{
            results?: Array<{
              index: number;
              relevance_score?: number;
              relevanceScore?: number;
            }>;
          }>;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        isRetryable: (error) => {
          if (error instanceof Error) {
            return (
              error.message.includes("429") ||
              error.message.includes("503") ||
              error.message.includes("500") ||
              error.message.includes("fetch failed") ||
              error.name === "AbortError"
            );
          }
          return false;
        },
      },
    );

    const rawResults = response.results ?? [];

    const mapped: CohereRerankResult[] = rawResults.map((r) => ({
      index: r.index,
      relevanceScore: r.relevance_score ?? r.relevanceScore ?? 0,
    }));

    return mapped;
  } catch (error) {
    logger?.error("cohere_rerank_failed", {
      service: "cohere",
      filePath: "src/lib/services/cohere.ts",
      error,
      data: { model, candidateCount: documents.length },
    });

    // Fallback: return topN items in their original order
    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  }
}

const COHERE_EMBED_URL = "https://api.cohere.com/v1/embed";
const DEFAULT_EMBED_MODEL = "embed-multilingual-v3.0";

/**
 * Generates 1024-dimensional vector embeddings using Cohere Embed API (`embed-multilingual-v3.0`).
 *
 * @param texts Array of string chunks to embed
 * @param inputType "search_document" for indexing chunks into DB, "search_query" for user search queries
 * @param logger Optional Logger instance
 * @returns Array of 1024-float vector arrays matching input texts order
 */
export async function generateCohereEmbeddings(
  texts: string[],
  inputType: "search_document" | "search_query" = "search_document",
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    logger?.warn("cohere_embed_key_missing", {
      service: "cohere",
      data: { message: "COHERE_API_KEY is not defined in environment." },
    });
    return texts.map(() => new Array(1024).fill(0));
  }

  try {
    const batchSize = 96;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);

      const response = await fetch(COHERE_EMBED_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          texts: batchTexts,
          model: DEFAULT_EMBED_MODEL,
          input_type: inputType,
          embedding_types: ["float"],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(
          `Cohere Embed API returned status ${response.status}: ${errText}`,
        );
      }

      const data = (await response.json()) as {
        embeddings?: { float?: number[][] } | number[][];
      };

      const floatEmbeddings =
        (data.embeddings && "float" in data.embeddings
          ? data.embeddings.float
          : (data.embeddings as number[][])) || [];

      allEmbeddings.push(...floatEmbeddings);
    }

    return allEmbeddings;
  } catch (error) {
    logger?.error("cohere_embed_failed", {
      service: "cohere",
      error,
      data: { textCount: texts.length },
    });

    return texts.map(() => new Array(1024).fill(0));
  }
}
