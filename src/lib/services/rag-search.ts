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

/** Per-candidate retrieval debug metadata (only exposed when `debug: true`). */
export interface RagSearchDebug {
  denseRank?: number;
  lexicalRank?: number;
  rrfScore: number;
  rerankScore: number;
}

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
  /** Retrieval provenance — only present when `options.debug` is enabled. */
  debug?: RagSearchDebug;
}

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
  printedPageNumber: number | null;
  pdfPageNumber: number | null;
  sectionTitle: string | null;
  content: string;
  parentContent: string | null;
  title: string;
  authors: string[] | null;
}

/**
 * Returns true when an embedding vector is the all-zero fallback produced on API failure.
 */
function isZeroVector(vector: number[]): boolean {
  return vector.every((value) => value === 0);
}

/**
 * Hybrid RAG Retrieval Engine — Dense + Lexical + RRF + Cohere Rerank.
 *
 * 1. Generates the 1024-d query embedding (BGE-M3 via Cloudflare Workers AI).
 * 2. Runs the **dense** branch (pgvector cosine, HNSW) and the **lexical**
 *    branch (PostgreSQL FTS `tsvector` + GIN) as two independent retrievals,
 *    executed in parallel where possible.
 * 3. Fuses the two independent rankings with Reciprocal Rank Fusion:
 *    `rrf = 1/(k + rank_dense) + 1/(k + rank_lexical)`, `k = 60`.
 * 4. Reranks the top `rerankCandidatePool` (default 30) candidates with Cohere
 *    `rerank-v4.0-pro` and returns the final top-K.
 * 5. Delivers rich Parent-Child context (`parentContent`) and academic page
 *    citations (`printedPageNumber`).
 *
 * Branch failures are tolerated independently: if one branch fails, the other
 * branch continues through an RRF-equivalent single-list ranking, and if the
 * reranker is unavailable the RRF ordering is preserved.
 *
 * @param options Query string, optional target resource IDs, topK (default: 5), logger, and optional debug flag.
 * @returns Array of sorted RAG search results.
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

  // ── 1. Safe FTS query body (null → lexical branch skipped, not a failure) ──
  const tsQuery = buildLexicalTsQuery(query, RAG_CONFIG.lexicalMaxQueryTokens);

  // ── 2. Independent branches in parallel: embedding (dense dep) + lexical ──
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

  // ── 3. Dense branch (pgvector HNSW, cosine) ──
  let denseCandidates: DenseCandidate[] = [];
  if (queryEmbedding && !isZeroVector(queryEmbedding)) {
    const similarityScore = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;

    const denseQuery = db
      .select({
        id: chunks.id,
        resourceId: chunks.sourceId,
        chunkIndex: chunks.chunkIndex,
        printedPageNumber: chunks.printedPageNumber,
        pdfPageNumber: chunks.pdfPageNumber,
        sectionTitle: chunks.sectionTitle,
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
      denseCandidates = await denseQuery
        .orderBy(desc(similarityScore))
        .limit(RAG_CONFIG.denseTopK);
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

  // ── 4. Reciprocal Rank Fusion over two independent rankings ──
  const rrfScored = computeRrf(
    denseCandidates.map((candidate) => candidate.id),
    lexicalCandidates.map((candidate) => candidate.id),
    RAG_CONFIG.rrfK,
  );
  const rrfSorted = sortByRrfScore(rrfScored);
  const rrfPool = rrfSorted.slice(0, RAG_CONFIG.rerankCandidatePool);

  // Unified candidate lookup for assembly (dense/lexical share the same chunk rows)
  const candidateMap = new Map<number, DenseCandidate | LexicalCandidate>();
  for (const candidate of denseCandidates)
    candidateMap.set(candidate.id, candidate);
  for (const candidate of lexicalCandidates)
    candidateMap.set(candidate.id, candidate);

  // ── 5. Cohere Rerank (topN = full pool so reordering is complete) ──
  const documentsToRerank = rrfPool.map((entry) => {
    const candidate = candidateMap.get(entry.id)!;
    return `[Eser: ${candidate.title} | Sayfa: ${candidate.printedPageNumber ?? candidate.pdfPageNumber ?? 1}${candidate.sectionTitle ? ` | Bölüm: ${candidate.sectionTitle}` : ""}]\n${candidate.content}`;
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

  // ── 6. Final assembly (top-K) ──
  const finalResults: RagSearchResultItem[] = rankedPool
    .slice(0, topK)
    .map(({ rrf, relevanceScore, rerankScore }) => {
      const candidate = candidateMap.get(rrf.id)!;

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
        printedPageNumber: candidate.printedPageNumber,
        pdfPageNumber: candidate.pdfPageNumber,
        sectionTitle: candidate.sectionTitle,
        content: candidate.content,
        parentContent: candidate.parentContent || candidate.content,
        relevanceScore,
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
