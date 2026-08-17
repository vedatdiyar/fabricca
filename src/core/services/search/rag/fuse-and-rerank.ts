import { rerankWithCohere } from "@/core/services/ai/cohere";
import type { Logger } from "@/lib/logger";
import { buildChunkContextPrefix } from "@/core/services/pdf/context-prefix";
import { RAG_CONFIG } from "./config";
import { computeRrf, sortByRrfScore, type RrfScoredCandidate } from "./rrf";
import type { LexicalCandidate } from "./lexical";
import type { DenseCandidate, RankedEntry } from "./types";
import { isZeroVector } from "./dense";

export interface FuseAndRerankParams {
  denseCandidates: DenseCandidate[];
  lexicalCandidates: LexicalCandidate[];
  queryEmbedding: number[] | null;
  rerankQueryText: string;
  logger?: Logger;
}

export interface FuseAndRerankResult {
  candidateMap: Map<number, DenseCandidate | LexicalCandidate>;
  rrfPool: RrfScoredCandidate[];
  rankedPool: RankedEntry[];
  filtered: RankedEntry[];
  filteredOut: RankedEntry[];
}

/**
 * Fuses dense and lexical candidates with Reciprocal Rank Fusion, performs Cohere reranking,
 * and applies the dual-score threshold gate.
 *
 * @param params - Search candidates, embedding vector, reranking query, and logger.
 * @returns Ranked and filtered candidate pools.
 */
export async function fuseAndRerank(
  params: FuseAndRerankParams,
): Promise<FuseAndRerankResult> {
  const {
    denseCandidates,
    lexicalCandidates,
    queryEmbedding,
    rerankQueryText,
    logger,
  } = params;

  const rrfScored = computeRrf(
    denseCandidates.map((candidate) => candidate.id),
    lexicalCandidates.map((candidate) => candidate.id),
    RAG_CONFIG.rrfK,
  );
  const rrfSorted = sortByRrfScore(rrfScored);
  const rrfPool = rrfSorted.slice(0, RAG_CONFIG.rerankCandidatePool);

  const candidateMap = new Map<number, DenseCandidate | LexicalCandidate>();
  for (const candidate of denseCandidates) {
    candidateMap.set(candidate.id, candidate);
  }
  for (const candidate of lexicalCandidates) {
    candidateMap.set(candidate.id, candidate);
  }

  const denseScoreMap = new Map<number, number>();
  if (queryEmbedding && !isZeroVector(queryEmbedding)) {
    for (const candidate of denseCandidates) {
      const score = queryEmbedding.reduce(
        (sum, val, i) => sum + val * (candidate.embedding[i] ?? 0),
        0,
      );
      denseScoreMap.set(candidate.id, score);
    }
  }

  const documentsToRerank = rrfPool.map((entry) => {
    const candidate = candidateMap.get(entry.id)!;
    const prefix = buildChunkContextPrefix(
      candidate.headerHierarchy ?? [],
      candidate.section,
      candidate.printedPageNumber,
    );
    return `[Eser: ${candidate.title}]\n${prefix}${candidate.content}`;
  });

  let rankedPool: RankedEntry[];
  if (process.env.COHERE_API_KEY) {
    try {
      const reranked = await rerankWithCohere({
        query: rerankQueryText,
        documents: documentsToRerank,
        topN: documentsToRerank.length,
        logger,
      });
      rankedPool = reranked.map((result) => ({
        rrf: rrfPool[result.index],
        relevanceScore: result.relevanceScore,
        rerankScore: result.relevanceScore,
        denseScore: denseScoreMap.get(rrfPool[result.index].id) ?? 0,
      }));
    } catch (error) {
      logger?.error("rag_rerank_failed", {
        service: "rag-search",
        error,
      });
      rankedPool = rrfPool.map((entry) => ({
        rrf: entry,
        relevanceScore: entry.rrfScore,
        rerankScore: entry.rrfScore,
        denseScore: denseScoreMap.get(entry.id) ?? 0,
      }));
    }
  } else {
    logger?.info("rag_rerank_fallback_rrf", {
      service: "rag-search",
      data: {
        message: "COHERE_API_KEY missing — preserving RRF ordering.",
      },
    });
    rankedPool = rrfPool.map((entry) => ({
      rrf: entry,
      relevanceScore: entry.rrfScore,
      rerankScore: entry.rrfScore,
      denseScore: denseScoreMap.get(entry.id) ?? 0,
    }));
  }

  const filtered = rankedPool.filter(
    ({ rerankScore, denseScore }) =>
      rerankScore >= RAG_CONFIG.rerankScoreThreshold &&
      denseScore >= RAG_CONFIG.denseScoreThreshold,
  );

  const filteredOut = rankedPool.filter(
    ({ rerankScore, denseScore }) =>
      rerankScore < RAG_CONFIG.rerankScoreThreshold ||
      denseScore < RAG_CONFIG.denseScoreThreshold,
  );

  logger?.info("rag_dual_score_filter", {
    service: "rag-search",
    data: {
      totalCandidates: rankedPool.length,
      passedFilter: filtered.length,
      filteredOut: filteredOut.length,
      kept: filtered.map(({ rrf, rerankScore, denseScore }) => ({
        chunkId: rrf.id,
        section: candidateMap.get(rrf.id)?.section ?? null,
        rerankScore,
        denseScore,
      })),
      dropped: filteredOut.map(({ rrf, rerankScore, denseScore }) => ({
        chunkId: rrf.id,
        section: candidateMap.get(rrf.id)?.section ?? null,
        rerankScore,
        denseScore,
      })),
    },
  });

  return {
    candidateMap,
    rrfPool,
    rankedPool,
    filtered,
    filteredOut,
  };
}
