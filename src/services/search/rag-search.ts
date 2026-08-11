import { sql, eq, innerProduct, asc, and } from "drizzle-orm";
import { db } from "@/db";
import { chunks, sources, boxes } from "@/db/schema";
import { generateVectorEmbeddings } from "@/services/ai/cloudflare-ai";
import { rerankWithCohere } from "@/services/ai/cohere";
import type { Logger } from "@/lib/logger";
import { RAG_CONFIG } from "@/services/search/rag/config";
import {
  computeRrf,
  sortByRrfScore,
  type RrfScoredCandidate,
} from "@/services/search/rag/rrf";
import {
  buildLexicalTsQuery,
  searchLexical,
  type LexicalCandidate,
} from "@/services/search/rag/lexical";
import { buildChunkContextPrefix } from "@/services/pdf/chunker";
import { expandAndTranslateQuery } from "@/services/search/rag/hyde";
import { formatResourceAuthors } from "@/lib/academic/author-formatter";

/** Per-candidate retrieval debug metadata (only exposed when `debug: true`). */
export interface RagSearchDebug {
  denseRank?: number;
  lexicalRank?: number;
  rrfScore: number;
  rerankScore: number;
  denseScore: number;
}

/** Final RAG result item with source metadata, content, and parent-child context. */
export interface RagSearchResultItem {
  resourceId: number;
  resourceTitle: string;
  resourceAuthors: string[];
  resourceYear: number | null;
  chunkIndex: number;
  printedPageNumber: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionTitle: string | null;
  content: string;
  parentContent: string;
  relevanceScore: number;
  denseScore: number;
  /** When true, this chunk did not pass the dual-score gate but was included as the closest partial match (0-chunk fallback). */
  isPartialMatch: boolean;
  /** Retrieval provenance — only present when `options.debug` is enabled. */
  debug?: RagSearchDebug;
}

/** Hybrid RAG search options: query, optional resource filter, topK, and debug provenance. */
export interface RagSearchOptions {
  query: string;
  resourceIds?: number[];
  topK?: number;
  logger?: Logger;
  /** When true, attaches per-candidate retrieval provenance (`denseRank`, `lexicalRank`, `rrfScore`, `rerankScore`). */
  debug?: boolean;
}

/** Dense branch candidate merged with the source metadata needed for assembly. */
interface DenseCandidate {
  id: number;
  resourceId: number;
  chunkIndex: number;
  content: string;
  parentContent: string | null;
  section: string | null;
  headerHierarchy: string[] | null;
  pageStart: number | null;
  pageEnd: number | null;
  printedPageNumber: string | null;
  title: string;
  authors: string[] | null;
  publicationYear: number | null;
  embedding: number[];
}

/**
 * Returns whether a vector is the all-zero fallback produced on API failure.
 *
 * @param vector - Embedding vector to inspect.
 * @returns True when every element is zero.
 */
function isZeroVector(vector: number[]): boolean {
  return vector.every((value) => value === 0);
}

/**
 * Runs hybrid RAG retrieval by fusing dense (pgvector HNSW) and lexical (tsvector GIN) branches via RRF and reranking with Cohere.
 * Utilizes Cerebras Gemma 4 (31B) for bidirectional cross-lingual HyDE query expansion.
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

  const hydeExpansion = await expandAndTranslateQuery(query, logger);

  const lexicalQueryText = hydeExpansion
    ? `${query} ${hydeExpansion.targetTranslation} ${hydeExpansion.targetKeywords.join(" ")}`
    : query;

  const denseQueryText = hydeExpansion
    ? `${query}\n\n${hydeExpansion.targetTranslation}\n\nContext: ${hydeExpansion.hypotheticalSnippet}`
    : query;

  const tsQuery = buildLexicalTsQuery(
    lexicalQueryText,
    RAG_CONFIG.lexicalMaxQueryTokens,
  );

  const embeddingPromise = generateVectorEmbeddings([denseQueryText], logger)
    .then((vectors) => vectors[0])
    .catch((error) => {
      logger?.error("rag_dense_embed_failed", {
        service: "rag-search",
        error,
        data: { queryLength: query.length },
      });
      return null;
    });

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

  const [queryEmbedding, lexicalCandidates] = await Promise.all([
    embeddingPromise,
    lexicalPromise,
  ]);

  let denseCandidates: DenseCandidate[] = [];
  if (queryEmbedding && !isZeroVector(queryEmbedding)) {
    const denseQuery = db
      .select({
        id: chunks.id,
        resourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
        content: chunks.content,
        parentContent: chunks.parentContent,
        section: chunks.section,
        headerHierarchy: chunks.headerHierarchy,
        pageStart: chunks.pageStart,
        pageEnd: chunks.pageEnd,
        printedPageNumber: chunks.printedPageNumber,
        title: sources.title,
        authors: sources.authors,
        publicationYear: sources.publicationYear,
        embedding: chunks.embedding,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id))
      .innerJoin(boxes, eq(sources.boxId, boxes.id));

    const denseConditions = [sql`${boxes.boxType} <> 'RELATED_THESES'`];
    if (resourceIds && resourceIds.length > 0) {
      denseConditions.push(sql`${chunks.sourceId} IN ${resourceIds}`);
    }
    denseQuery.where(and(...denseConditions));

    try {
      const rows = await denseQuery
        .orderBy(asc(innerProduct(chunks.embedding, queryEmbedding)))
        .limit(RAG_CONFIG.denseTopK);
      denseCandidates = rows as DenseCandidate[];
    } catch (error) {
      logger?.error("rag_dense_failed", {
        service: "rag-search",
        error,
      });
    }
  } else {
    logger?.info("rag_dense_skipped", {
      service: "rag-search",
      data: {
        message:
          "Dense branch skipped: embedding unavailable or all-zero fallback.",
      },
    });
  }

  if (denseCandidates.length === 0 && lexicalCandidates.length === 0) {
    logger?.info("rag_hybrid_search_empty", {
      service: "rag-search",
      data: { queryLength: query.length },
    });
    return [];
  }

  const rrfScored = computeRrf(
    denseCandidates.map((candidate) => candidate.id),
    lexicalCandidates.map((candidate) => candidate.id),
    RAG_CONFIG.rrfK,
  );
  const rrfSorted = sortByRrfScore(rrfScored);
  const rrfPool = rrfSorted.slice(0, RAG_CONFIG.rerankCandidatePool);

  const candidateMap = new Map<number, DenseCandidate | LexicalCandidate>();
  for (const candidate of denseCandidates)
    candidateMap.set(candidate.id, candidate);
  for (const candidate of lexicalCandidates)
    candidateMap.set(candidate.id, candidate);

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

  const rerankQueryText = hydeExpansion
    ? `${query}\n\n${hydeExpansion.targetTranslation}`
    : query;

  interface RankedEntry {
    rrf: RrfScoredCandidate;
    relevanceScore: number;
    rerankScore: number;
    denseScore: number;
  }

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

  const toResultItems = (
    entries: RankedEntry[],
    partial: boolean,
  ): RagSearchResultItem[] =>
    entries.map(({ rrf, relevanceScore, rerankScore, denseScore }) => {
      const candidate = candidateMap.get(rrf.id)!;
      const debugMeta: RagSearchDebug | undefined = debug
        ? {
            denseRank: rrf.denseRank,
            lexicalRank: rrf.lexicalRank,
            rrfScore: rrf.rrfScore,
            rerankScore,
            denseScore,
          }
        : undefined;
      return {
        resourceId: candidate.resourceId,
        resourceTitle: candidate.title,
        resourceAuthors: formatResourceAuthors({
          authors: candidate.authors,
        }),
        resourceYear: candidate.publicationYear ?? null,
        chunkIndex: candidate.chunkIndex,
        printedPageNumber: candidate.printedPageNumber,
        pageStart: candidate.pageStart,
        pageEnd: candidate.pageEnd,
        sectionTitle: candidate.section ?? null,
        content: candidate.content,
        parentContent: candidate.parentContent || candidate.content,
        relevanceScore,
        denseScore,
        isPartialMatch: partial,
        ...(debugMeta ? { debug: debugMeta } : {}),
      };
    });

  let finalResults: RagSearchResultItem[];
  if (filtered.length > 0) {
    finalResults = toResultItems(filtered.slice(0, topK), false);
  } else {
    const fallback = rankedPool
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, 2);
    finalResults = toResultItems(fallback, true);
    logger?.info("rag_dual_score_fallback_partial", {
      service: "rag-search",
      data: {
        fallbackCount: finalResults.length,
        topRerankScore: fallback[0]?.rerankScore ?? 0,
      },
    });
  }

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
