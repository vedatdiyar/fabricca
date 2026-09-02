import type { Logger } from "@/lib/logger";
import type { ThesisDetails } from "@/lib/types";
import { getQdrantClient } from "./qdrant-client";
import {
  getE5QueryEmbedding,
  HfDeprecatedEndpointError,
} from "./hf-embedding";
import { mapPayloadToDetails } from "./thesis-mapper";

export { getE5QueryEmbedding };

/** Benchmark-derived dynamic thresholds (see scripts/benchmark-thesis-thresholds.ts). */
export const THESIS_TR_THRESHOLD = 0.84;
export const THESIS_EN_THRESHOLD = 0.82;
export const THESIS_FALLBACK_THRESHOLD = 0.83;

const TURKISH_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/;

/**
 * Resolves the Qdrant `score_threshold` based on query language.
 * Explicit `rankingScoreThreshold` always wins; otherwise Turkish chars → 0.84,
 * pure Latin/English → 0.82, empty/ambiguous → 0.83 fallback.
 *
 * @param query - Raw search query.
 * @param explicitThreshold - Optional caller-provided threshold.
 * @returns The threshold to pass to Qdrant.
 */
export function resolveThesisThreshold(
  query: string,
  explicitThreshold?: number,
): number {
  if (
    typeof explicitThreshold === "number" &&
    Number.isFinite(explicitThreshold)
  ) {
    return explicitThreshold;
  }
  if (TURKISH_CHAR_RE.test(query)) return THESIS_TR_THRESHOLD;
  if (query.trim().length > 0) return THESIS_EN_THRESHOLD;
  return THESIS_FALLBACK_THRESHOLD;
}

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
  externalSignal?: AbortSignal,
): Promise<ThesisDetails[]> {
  const startTime = performance.now();
  const limit = options?.limit ?? 100;
  const silent = options?.silent ?? false;
  const client = getQdrantClient();

  try {
    if (externalSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    const embedding = await getE5QueryEmbedding(query, logger, silent, externalSignal);
    const queryStart = performance.now();
    const effectiveThreshold = resolveThesisThreshold(
      query,
      options?.rankingScoreThreshold,
    );

    const searchRes = await client.query("theses", {
      query: embedding,
      limit,
      score_threshold: effectiveThreshold,
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
      logger?.success("qdrant_vector_search", {
        service: "thesis-search",
        filePath: "src/core/services/thesis-search/index.ts",
        step: "search_qdrant_vector",
        durationMs: totalDurationMs,
        data: {
          summary: `(${results.length} theses)`,
          query,
          resultCount: results.length,
          qdrantDurationMs: Math.round(qdrantDurationMs),
          limit,
        },
      });
    }

    return results;
  } catch (err) {
    // Graceful degradation: HF endpoint gone (404/410) must not crash the pipeline —
    // thesis channel returns [] so OpenAlex/Semantic Scholar can still populate.
    if (err instanceof HfDeprecatedEndpointError) {
      logger?.error("thesis_search_degraded_no_theses", {
        service: "thesis-search",
        filePath: "src/core/services/thesis-search/index.ts",
        step: "hf_deprecated_fallback",
        data: { query, status: err.status },
        error: err,
      });
      return [];
    }
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
