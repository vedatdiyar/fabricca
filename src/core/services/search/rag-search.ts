import { RAG_CONFIG } from "@/core/services/search/rag/config";
import {
  searchLexical,
  type LexicalCandidate,
} from "@/core/services/search/rag/lexical";
import {
  prepareRagQueries,
  type PreparedRagQueries,
} from "@/core/services/search/rag/query-prep";
import { searchDense } from "@/core/services/search/rag/dense";
import { fuseAndRerank } from "@/core/services/search/rag/fuse-and-rerank";
import { assembleRagResults } from "@/core/services/search/rag/result-assembly";
import type { Logger } from "@/lib/logger";
import type {
  BoxTypeFilter,
  RagSearchDebug,
  RagSearchResultItem,
  RagSearchOptions,
} from "@/core/services/search/rag/types";

export type {
  BoxTypeFilter,
  RagSearchDebug,
  RagSearchResultItem,
  RagSearchOptions,
};

interface FilteredBranchInput {
  prepared: PreparedRagQueries;
  resourceIds?: number[];
  topK: number;
  boxTypeFilter?: BoxTypeFilter;
  logger?: Logger;
  debug?: boolean;
}

/**
 * Executes one filtered hybrid retrieval branch (dense + lexical + RRF + rerank + assembly).
 *
 * @param input - Prepared HyDE queries plus branch quota, filter, and logging flags.
 * @returns Ranked RAG result items for the branch.
 */
async function runFilteredBranch(
  input: FilteredBranchInput,
): Promise<RagSearchResultItem[]> {
  const { prepared, resourceIds, topK, boxTypeFilter, logger, debug } = input;
  const { denseQueryText, tsQuery, rerankQueryText } = prepared;

  const densePromise = searchDense(denseQueryText, {
    resourceIds,
    logger,
    boxTypeFilter,
  });

  const lexicalPromise = tsQuery
    ? searchLexical(tsQuery, {
        resourceIds,
        topK: RAG_CONFIG.lexicalTopK,
        boxTypeFilter,
      }).catch((error) => {
        logger?.error("rag_lexical_failed", {
          service: "rag-search",
          error,
          data: { tsQuery, boxTypeFilter },
        });
        return [] as LexicalCandidate[];
      })
    : Promise.resolve([] as LexicalCandidate[]);

  const [{ queryEmbedding, denseCandidates }, lexicalCandidates] =
    await Promise.all([densePromise, lexicalPromise]);

  if (denseCandidates.length === 0 && lexicalCandidates.length === 0) {
    return [];
  }

  const { candidateMap, rankedPool, filtered } = await fuseAndRerank({
    denseCandidates,
    lexicalCandidates,
    queryEmbedding,
    rerankQueryText,
    logger,
  });

  return assembleRagResults({
    candidateMap,
    rankedPool,
    filtered,
    topK,
    debug,
    logger,
  });
}

/**
 * Runs hybrid RAG retrieval by fusing dense (pgvector HNSW) and lexical (tsvector GIN) branches via RRF and reranking with Cohere.
 * Utilizes Gemini Flash Lite 3.5 for bidirectional cross-lingual HyDE query expansion.
 *
 * @param options - Hybrid search options (query, filters, and debug flags).
 * @returns Ranked RAG result items (Top 5 by default).
 */
export async function performHybridRagSearch(
  options: RagSearchOptions,
): Promise<RagSearchResultItem[]> {
  const {
    query,
    resourceIds,
    topK = RAG_CONFIG.finalTopK,
    logger,
    debug,
    boxTypeFilter,
  } = options;
  if (!query.trim()) return [];

  const searchStart = performance.now();

  // Phase 1: Query Preparation & HyDE Expansion
  const prepared = await prepareRagQueries(query, logger);

  // Phase 2-4: Filtered branch retrieval, fusion, rerank & assembly
  const finalResults = await runFilteredBranch({
    prepared,
    resourceIds,
    topK,
    boxTypeFilter,
    logger,
    debug,
  });

  if (finalResults.length === 0) {
    logger?.info("rag_hybrid_search_empty", {
      service: "rag-search",
      data: { queryLength: query.length, boxTypeFilter },
    });
    return [];
  }

  logger?.info("rag_hybrid_search_success", {
    service: "rag-search",
    data: {
      queryLength: query.length,
      boxTypeFilter,
      rerankedCount: finalResults.length,
      durationMs: Math.round(performance.now() - searchStart),
    },
  });

  return finalResults;
}

/**
 * Runs bimodal RAG retrieval with balanced quotas: primary empirical material
 * (PRIMARY_MATERIAL, topK 3) plus secondary academic literature (topK 4).
 * Executes a single HyDE expansion, then both partitions in parallel.
 * Graceful fallback: when the primary branch is empty (or partial), the
 * secondary branch fills the remainder up to the total budget (default 7).
 *
 * @param options - Bimodal search options (query, filters, and debug flags).
 * @returns Primary-first ordered RAG result items (total budget 7 by default).
 */
export async function performBimodalRagSearch(
  options: RagSearchOptions,
): Promise<RagSearchResultItem[]> {
  const {
    query,
    resourceIds,
    topK = RAG_CONFIG.bimodalTotalTopK,
    logger,
    debug,
  } = options;
  if (!query.trim()) return [];

  const searchStart = performance.now();

  // Single HyDE / query expansion shared by both partitions (token efficient).
  const prepared = await prepareRagQueries(query, logger);

  const primaryTopK = Math.min(RAG_CONFIG.bimodalPrimaryTopK, topK);

  const [primaryResults, secondaryPool] = await Promise.all([
    runFilteredBranch({
      prepared,
      resourceIds,
      topK: primaryTopK,
      boxTypeFilter: "PRIMARY_MATERIAL_ONLY",
      logger,
      debug,
    }),
    // Fetch the full total budget on the secondary arm so it can backfill
    // the primary quota when primary material is missing or partial.
    runFilteredBranch({
      prepared,
      resourceIds,
      topK,
      boxTypeFilter: "SECONDARY_LITERATURE_ONLY",
      logger,
      debug,
    }),
  ]);

  const secondaryNeeded = Math.max(topK - primaryResults.length, 0);
  const secondaryResults = secondaryPool.slice(0, secondaryNeeded);
  const combined = [...primaryResults, ...secondaryResults];

  if (combined.length === 0) {
    logger?.info("rag_bimodal_search_empty", {
      service: "rag-search",
      data: { queryLength: query.length },
    });
    return [];
  }

  logger?.info("rag_bimodal_search_success", {
    service: "rag-search",
    data: {
      queryLength: query.length,
      primaryCount: primaryResults.length,
      secondaryCount: secondaryResults.length,
      totalCount: combined.length,
      primaryFallback: primaryResults.length === 0,
      durationMs: Math.round(performance.now() - searchStart),
    },
  });

  return combined;
}
