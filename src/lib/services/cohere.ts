import { Logger } from "../logger";

/** Cohere Rerank model ID — multilingual (100+ dil, Türkçe dahil), 32.768 token context. */
const COHERE_RERANK_MODEL = "rerank-v4.0-pro";

/** Cohere Rerank v2 REST endpoint. */
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
 * Invokes Cohere Rerank API (`rerank-v4.0-pro`) to compute semantic relevance
 * scores for candidate documents against a search query. The model is
 * multilingual (Turkish included) and natively supports structured YAML
 * documents, so callers can pass either plain text or YAML-formatted strings.
 *
 * On missing API key or request failure, a degraded fallback preserving the
 * input order with descending synthetic scores is returned so downstream
 * pipelines can continue without crashing.
 *
 * @param params - Configuration object including query, documents, topN, and optional logger.
 * @returns Sorted array (descending by relevance) of reranked results with index and score.
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
  }
}
