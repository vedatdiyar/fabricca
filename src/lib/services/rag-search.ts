import { sql, eq, cosineDistance, desc } from "drizzle-orm";
import { db } from "@/db";
import { chunks, sources } from "@/db/schema";
import { generateVectorEmbeddings } from "@/lib/services/cloudflare-ai";
import { rerankWithCohere } from "@/lib/services/cohere";
import type { Logger } from "@/lib/logger";
import { RAG_CONFIG } from "@/lib/services/rag/config";
import {
  computeRrf,
  sortByRrfScore,
  type RrfScoredCandidate,
} from "@/lib/services/rag/rrf";
import {
  buildLexicalTsQuery,
  searchLexical,
  type LexicalCandidate,
} from "@/lib/services/rag/lexical";
import { buildChunkContextPrefix } from "@/lib/services/pdf/chunker";

/** Per-candidate retrieval debug metadata (only exposed when `debug: true`). */
export interface RagSearchDebug {
  denseRank?: number;
  lexicalRank?: number;
  rrfScore: number;
  rerankScore: number;
}

/** Final RAG result item with source metadata, content, and parent-child context. */
export interface RagSearchResultItem {
  resourceId: number;
  resourceTitle: string;
  resourceAuthors: string[];
  chunkIndex: number;
  printedPageNumber: number | null;
  pdfPageNumber: number | null;
  sectionTitle: string | null;
  content: string;
  parentContent: string;
  relevanceScore: number;
  metadata: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
  content: string;
  parentContent: string | null;
  title: string;
  authors: string[] | null;
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

  const tsQuery = buildLexicalTsQuery(query, RAG_CONFIG.lexicalMaxQueryTokens);

  const embeddingPromise = generateVectorEmbeddings([query], logger)
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
    const similarityScore = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;

    const denseQuery = db
      .select({
        id: chunks.id,
        resourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
        metadata: chunks.metadata,
        content: chunks.content,
        parentContent: chunks.parentContent,
        title: sources.title,
        authors: sources.authors,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.sourceId, sources.id));

    if (resourceIds && resourceIds.length > 0) {
      denseQuery.where(sql`${chunks.sourceId} IN ${resourceIds}`);
    }

    try {
      const rows = await denseQuery
        .orderBy(desc(similarityScore))
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

  const documentsToRerank = rrfPool.map((entry) => {
    const candidate = candidateMap.get(entry.id)!;
    const meta = candidate.metadata || {};
    const prefix = buildChunkContextPrefix(meta);
    return `[Eser: ${candidate.title}]\n${prefix}${candidate.content}`;
  });

  interface RankedEntry {
    rrf: RrfScoredCandidate;
    relevanceScore: number;
    rerankScore: number;
  }

  let rankedPool: RankedEntry[];
  if (process.env.COHERE_API_KEY) {
    try {
      const reranked = await rerankWithCohere({
        query,
        documents: documentsToRerank,
        topN: documentsToRerank.length,
        logger,
      });
      rankedPool = reranked.map((result) => ({
        rrf: rrfPool[result.index],
        relevanceScore: result.relevanceScore,
        rerankScore: result.relevanceScore,
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
    }));
  }

  const finalResults: RagSearchResultItem[] = rankedPool
    .slice(0, topK)
    .map(({ rrf, relevanceScore, rerankScore }) => {
      const candidate = candidateMap.get(rrf.id)!;
      const meta = candidate.metadata || {};

      const pageNum =
        typeof meta.pageNumber === "number" ? meta.pageNumber : null;
      const printedNum =
        typeof meta.printedPageNumber === "number"
          ? meta.printedPageNumber
          : pageNum;
      const secTitle =
        typeof meta.sectionTitle === "string" ? meta.sectionTitle : null;

      const debugMeta: RagSearchDebug | undefined = debug
        ? {
            denseRank: rrf.denseRank,
            lexicalRank: rrf.lexicalRank,
            rrfScore: rrf.rrfScore,
            rerankScore,
          }
        : undefined;

      return {
        resourceId: candidate.resourceId,
        resourceTitle: candidate.title,
        resourceAuthors: candidate.authors || ["Bilinmeyen Yazar"],
        chunkIndex: candidate.chunkIndex,
        printedPageNumber: printedNum,
        pdfPageNumber: pageNum,
        sectionTitle: secTitle,
        content: candidate.content,
        parentContent: candidate.parentContent || candidate.content,
        relevanceScore,
        metadata: meta,
        ...(debugMeta ? { debug: debugMeta } : {}),
      };
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
