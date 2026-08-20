import { RAG_CONFIG } from "@/core/services/search/rag/config";
import {
  searchLexical,
  type LexicalCandidate,
} from "@/core/services/search/rag/lexical";
import { prepareRagQueries } from "@/core/services/search/rag/query-prep";
import { searchDense } from "@/core/services/search/rag/dense";
import { fuseAndRerank } from "@/core/services/search/rag/fuse-and-rerank";
import { assembleRagResults } from "@/core/services/search/rag/result-assembly";
import type {
  RagSearchDebug,
  RagSearchResultItem,
  RagSearchOptions,
} from "@/core/services/search/rag/types";

export type { RagSearchDebug, RagSearchResultItem, RagSearchOptions };

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
  } = options;
  if (!query.trim()) return [];

  const searchStart = performance.now();

  // Phase 1: Query Preparation & HyDE Expansion
  const { denseQueryText, tsQuery, rerankQueryText } = await prepareRagQueries(
    query,
    logger,
  );

  // Phase 2: Parallel Dense & Lexical Branch Retrieval
  const densePromise = searchDense(denseQueryText, { resourceIds, logger });

  const lexicalPromise = tsQuery
    ? searchLexical(tsQuery, {
        resourceIds,
        topK: RAG_CONFIG.lexicalTopK,
      }).catch((error) => {
        logger?.error("rag_lexical_failed", {
          service: "rag-search",
          error,
          data: { tsQuery },
        });
        return [] as LexicalCandidate[];
      })
    : Promise.resolve([] as LexicalCandidate[]);

  const [{ queryEmbedding, denseCandidates }, lexicalCandidates] =
    await Promise.all([densePromise, lexicalPromise]);

  if (denseCandidates.length === 0 && lexicalCandidates.length === 0) {
    logger?.info("rag_hybrid_search_empty", {
      service: "rag-search",
      data: { queryLength: query.length },
    });
    return [];
  }

  // Phase 3: RRF Fusion, Cohere Reranking & Dual-Score Filtering
  const { candidateMap, rrfPool, rankedPool, filtered } = await fuseAndRerank({
    denseCandidates,
    lexicalCandidates,
    queryEmbedding,
    rerankQueryText,
    logger,
  });

  // Phase 4: Result Assembly & DTO Mapping
  const finalResults = assembleRagResults({
    candidateMap,
    rankedPool,
    filtered,
    topK,
    debug,
    logger,
  });

  logger?.info("rag_hybrid_search_success", {
    service: "rag-search",
    data: {
      queryLength: query.length,
      denseCandidateCount: denseCandidates.length,
      lexicalCandidateCount: lexicalCandidates.length,
      fusedCandidateCount: rrfPool.length,
      rerankedCount: finalResults.length,
      durationMs: Math.round(performance.now() - searchStart),
    },
  });

  return finalResults;
}
