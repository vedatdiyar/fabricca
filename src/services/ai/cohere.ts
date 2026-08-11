import { Logger } from "@/lib/logger";

/** Multilingual (incl. Turkish) Cohere Rerank model ID — 32,768-token context. */
const COHERE_RERANK_MODEL = "rerank-v4.0-pro";
/** Maximum duration to wait for a Cohere Rerank response before aborting. */
const COHERE_TIMEOUT_MS = 30000;

const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";
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
  const { query, documents, logger } = params;

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

  try {
    const response = await fetch(COHERE_RERANK_URL, {
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

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Cohere Rerank API returned ${response.status}: ${errText}`,
      );
    }

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

    if (results.length !== documents.length) {
      logger?.info("cohere_rerank_partial_scores", {
        service: "cohere",
        data: {
          returned: results.length,
          expected: documents.length,
        },
      });
    }

    return results;
  } catch (error) {
    logger?.error("cohere_rerank_failed", {
      service: "cohere",
      error,
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
