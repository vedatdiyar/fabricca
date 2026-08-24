import type { Logger } from "@/lib/logger";
import type { ThesisDetails } from "@/lib/types";
import { getQdrantClient } from "./qdrant-client";
import { getE5QueryEmbedding } from "./hf-embedding";
import { mapPayloadToDetails } from "./thesis-mapper";

export { getE5QueryEmbedding };

/** Search options for precision tuning. */
export interface ThesisSearchOptions {
  limit?: number;
  rankingScoreThreshold?: number;
  filter?: string;
  attributesToSearchOn?: string[];
  /** When true, suppresses the start/success log pair for flat pipelines. */
  silent?: boolean;
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
export async function searchTheses(
  query: string,
  logger?: Logger,
  options?: ThesisSearchOptions,
): Promise<ThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 100;
  const silent = options?.silent ?? false;
  const client = getQdrantClient();

  try {
    const embedding = await getE5QueryEmbedding(query, logger, silent);
    const queryStart = performance.now();

    const searchRes = await client.query("theses", {
      query: embedding,
      limit,
      score_threshold: options?.rankingScoreThreshold ?? 0.8,
      with_payload: true,
    });

    const qdrantDurationMs = performance.now() - queryStart;
    const totalDurationMs = performance.now() - startTime;

    const results: ThesisDetails[] = [];
    for (const point of searchRes.points) {
      if (!point.id) continue;
      const payload = (point.payload ?? {}) as Record<string, unknown>;
      results.push(mapPayloadToDetails(Number(point.id), payload));
    }

    if (!silent) {
      logger?.info("qdrant_vector_search_success", {
        service: "thesis-search",
        filePath: "src/core/services/thesis-search/index.ts",
        step: "search_qdrant_vector",
        durationMs: totalDurationMs,
        data: {
          query,
          resultCount: results.length,
          qdrantDurationMs: Math.round(qdrantDurationMs),
          limit,
        },
      });
    }

    return results;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("qdrant_vector_search_failed", {
      service: "thesis-search",
      filePath: "src/core/services/thesis-search/index.ts",
      step: "search_failed",
      durationMs,
      data: { query },
      error: err,
    });
    throw err;
  }
}
