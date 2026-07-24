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

  const startTime = performance.now();

  logger?.info("cohere_rerank_start", {
    service: "cohere",
    filePath: "src/lib/services/cohere.ts",
    data: { model, candidateCount: documents.length },
  });

  try {
    const payload = {
      model,
      query,
      documents,
      top_n: Math.min(topN, documents.length),
    };

    const response = await withRetry(
      async () => {
        const res = await fetch(COHERE_RERANK_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

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
              error.message.includes("fetch failed")
            );
          }
          return false;
        },
      },
    );

    const durationMs = performance.now() - startTime;
    const rawResults = response.results ?? [];

    const mapped: CohereRerankResult[] = rawResults.map((r) => ({
      index: r.index,
      relevanceScore: r.relevance_score ?? r.relevanceScore ?? 0,
    }));

    logger?.info("cohere_rerank_success", {
      service: "cohere",
      filePath: "src/lib/services/cohere.ts",
      durationMs,
      data: {
        model,
        candidateCount: documents.length,
        returnedCount: mapped.length,
      },
    });

    return mapped;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    logger?.error("cohere_rerank_failed", {
      service: "cohere",
      filePath: "src/lib/services/cohere.ts",
      durationMs,
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
