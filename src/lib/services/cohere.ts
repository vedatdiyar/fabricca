import { Logger } from "../logger";

/** Multilingual (incl. Turkish) Cohere Rerank model ID — 32,768-token context. */
const COHERE_RERANK_MODEL = "rerank-v4.0-pro";

const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";

/** Hard timeout for a single Cohere Rerank request before it is aborted. */
const COHERE_RERANK_TIMEOUT_MS = 3000;

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
 * Reranks documents against a query via Cohere rerank-v4.0-pro; falls back to input-order scores on missing key, request failure, or a 3-second timeout.
 *
 * @param params - Object containing the query, documents, optional topN limit, and optional logger.
 * @returns The reranked results sorted by descending relevance score.
 */
export async function rerankWithCohere(
  params: RerankParams,
): Promise<RerankResult[]> {
  const { query, documents, topN = 12, logger } = params;

  if (documents.length === 0) return [];

  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    logger?.info("cohere_rerank_key_missing", {
      service: "cohere",
      data: {
        message: "COHERE_API_KEY missing.",
      },
    });

    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    COHERE_RERANK_TIMEOUT_MS,
  );

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
        top_n: topN,
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
    };

    if (!data.results) {
      throw new Error(
        `Cohere Rerank response invalid: ${JSON.stringify(data)}`,
      );
    }

    return data.results
      .map((item) => ({
        index: item.index,
        relevanceScore: item.relevance_score ?? 0,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    logger?.error("cohere_rerank_failed", {
      service: "cohere",
      error,
    });

    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  } finally {
    clearTimeout(timeout);
  }
}
