import { Logger } from "../logger";

/** Multilingual (incl. Turkish) Cohere Rerank primary model ID — 32,768-token context. */
const COHERE_RERANK_MODEL = "rerank-v4.0-pro";
/** Fast multilingual fallback model ID if primary model times out or fails. */
const COHERE_RERANK_FALLBACK_MODEL = "rerank-v4.0-fast";
/** Maximum duration to wait for a Cohere Rerank response before aborting. */
const COHERE_TIMEOUT_MS = 8000;

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
 * Reranks documents against a query via Cohere rerank-v4.0-pro; falls back to rerank-v4.0-fast (8s timeout) or input-order scores on failure.
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

  const tryRerank = async (model: string): Promise<RerankResult[] | null> => {
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
          model,
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
        message?: string;
      };

      if (!data.results) {
        throw new Error(
          `Cohere Rerank response missing results: ${data.message || JSON.stringify(data)}`,
        );
      }

      return data.results
        .map((item) => ({
          index: item.index,
          relevanceScore: item.relevance_score ?? 0,
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      logger?.error("cohere_rerank_attempt_failed", {
        service: "cohere",
        error,
        data: { model },
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Try primary model (rerank-v4.0-pro)
  const primaryResult = await tryRerank(COHERE_RERANK_MODEL);
  if (primaryResult) return primaryResult;

  // Fallback to secondary model (rerank-v4.0-fast)
  logger?.info("cohere_rerank_switching_to_fallback", {
    service: "cohere",
    data: {
      message: `Primary model ${COHERE_RERANK_MODEL} failed or timed out — trying ${COHERE_RERANK_FALLBACK_MODEL}.`,
    },
  });
  const fallbackResult = await tryRerank(COHERE_RERANK_FALLBACK_MODEL);
  if (fallbackResult) return fallbackResult;

  // Final fallback to input order if all models fail or time out
  logger?.info("cohere_rerank_fallback_input_order", {
    service: "cohere",
    data: {
      message: "Both Cohere models failed or timed out — using input order.",
    },
  });

  return documents.slice(0, topN).map((_, index) => ({
    index,
    relevanceScore: 1 - index * 0.01,
  }));
}
