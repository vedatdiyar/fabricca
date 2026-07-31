import { Logger } from "../logger";

const BGE_M3_MODEL = "@cf/baai/bge-m3";

/**
 * Generates 1024-dimensional vector embeddings using Cloudflare Workers AI (`@cf/baai/bge-m3`).
 * 100% Vercel compatible, 1024-d output matching Neon DB pgvector schema.
 * Free tier includes 100,000 requests/day.
 *
 * @param texts Array of string chunks to embed
 * @param logger Optional Logger instance
 * @returns Array of 1024-float vector arrays matching input texts order
 */
export async function generateCloudflareEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    logger?.info("cloudflare_embed_key_missing", {
      service: "cloudflare",
      data: {
        message: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing.",
      },
    });
    return texts.map(() => new Array(1024).fill(0));
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${BGE_M3_MODEL}`;
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);

    try {
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
        throw new Error(
          `Cloudflare AI API returned ${response.status}: ${errText}`,
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

      allEmbeddings.push(...data.result.data);
    } catch (error) {
      logger?.error("cloudflare_embed_batch_failed", {
        service: "cloudflare",
        error,
        data: { batchIndex: i, textCount: batchTexts.length },
      });
      // Fill fallback 1024-zero vectors for failed batch
      allEmbeddings.push(...batchTexts.map(() => new Array(1024).fill(0)));
    }
  }

  return allEmbeddings;
}

/** Individual rerank result returned from Cloudflare Workers AI. */
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
 * Invokes Cloudflare Workers AI Rerank API (`@cf/baai/bge-reranker-base`) to compute
 * semantic relevance scores for candidate documents against a search query.
 *
 * @param params - Configuration object including query, documents, topN, and optional logger.
 * @returns Sorted array of reranked results with index and relevance score.
 */
export async function rerankWithCloudflare(
  params: RerankParams,
): Promise<RerankResult[]> {
  const { query, documents, topN = 12, logger } = params;

  if (documents.length === 0) return [];

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    logger?.info("cloudflare_rerank_key_missing", {
      service: "cloudflare",
      data: {
        message: "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing.",
      },
    });

    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-reranker-base`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        contexts: documents.map((doc) => ({ text: doc })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Cloudflare Rerank API returned ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as {
      result?: { response?: Array<{ id?: number; score?: number }> };
      success?: boolean;
    };

    if (!data.success || !data.result?.response) {
      throw new Error(
        `Cloudflare Rerank response invalid: ${JSON.stringify(data)}`,
      );
    }

    const reranked = data.result.response
      .map((item, idx) => ({
        index: typeof item.id === "number" ? item.id : idx,
        relevanceScore: item.score ?? 0,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return reranked.slice(0, topN);
  } catch (error) {
    logger?.error("cloudflare_rerank_failed", {
      service: "cloudflare",
      error,
    });

    return documents.slice(0, topN).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }));
  }
}

/**
 * Single Source Vector Embedding Engine (1024-d):
 * Always uses Cloudflare Workers AI (`@cf/baai/bge-m3`) for 100k free daily requests.
 * No Cohere or secondary fallbacks.
 *
 * @param texts Array of string chunks to embed
 * @param _inputType Unused (kept for API signature compatibility)
 * @param logger Optional Logger instance
 * @returns Array of 1024-float vector arrays
 */
export async function generateVectorEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return generateCloudflareEmbeddings(texts, logger);
}
