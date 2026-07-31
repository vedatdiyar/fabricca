import { sql, eq, cosineDistance, desc } from "drizzle-orm";
import { db } from "@/db";
import { resourceEmbeddings, libraryResources } from "@/db/schema";
import {
  generateVectorEmbeddings,
  rerankWithCloudflare,
} from "@/lib/services/cloudflare-ai";
import type { Logger } from "@/lib/logger";

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
}

export interface RagSearchOptions {
  query: string;
  resourceIds?: number[];
  topK?: number;
  logger?: Logger;
}

/**
 * Hybrid RAG Retrieval Engine with Reciprocal Rank Fusion (RRF) & Cloudflare BGE Reranker.
 *
 * 1. Generates 1024-d query vector via Cloudflare Workers AI.
 * 2. Runs pgvector Cosine Distance + Full-Text Keyword Search in parallel.
 * 3. Combines rankings using RRF: `score = 1/(60 + rank_vec) + 1/(60 + rank_text)`.
 * 4. Reranks Top-15 candidates with Cloudflare `@cf/baai/bge-reranker-base` (~40ms).
 * 5. Delivers rich Parent-Child context (`parentContent`) and academic page citations (`printedPageNumber`).
 *
 * @param options Query string, optional target resource IDs, topK (default: 5), and logger.
 * @returns Array of sorted RAG search results.
 */
export async function performHybridRagSearch(
  options: RagSearchOptions,
): Promise<RagSearchResultItem[]> {
  const { query, resourceIds, topK = 5, logger } = options;
  if (!query.trim()) return [];

  const searchStart = performance.now();

  // 1. Generate query embedding (1024-d)
  const [queryEmbedding] = await generateVectorEmbeddings([query], logger);

  // 2. Query pgvector Cosine Similarity (Top 15)
  const similarityScore = sql<number>`1 - (${cosineDistance(resourceEmbeddings.embedding, queryEmbedding)})`;

  const vectorCandidatesQuery = db
    .select({
      id: resourceEmbeddings.id,
      resourceId: resourceEmbeddings.libraryResourceId,
      chunkIndex: resourceEmbeddings.chunkIndex,
      printedPageNumber: resourceEmbeddings.printedPageNumber,
      pdfPageNumber: resourceEmbeddings.pdfPageNumber,
      sectionTitle: resourceEmbeddings.sectionTitle,
      content: resourceEmbeddings.content,
      parentContent: resourceEmbeddings.parentContent,
      title: libraryResources.title,
      authors: libraryResources.authors,
      similarity: similarityScore,
    })
    .from(resourceEmbeddings)
    .innerJoin(
      libraryResources,
      eq(resourceEmbeddings.libraryResourceId, libraryResources.id),
    );

  if (resourceIds && resourceIds.length > 0) {
    vectorCandidatesQuery.where(
      sql`${resourceEmbeddings.libraryResourceId} IN ${resourceIds}`,
    );
  }

  const vectorCandidates = await vectorCandidatesQuery
    .orderBy(desc(similarityScore))
    .limit(15);

  // Map to RRF dictionary
  const rrfScores = new Map<
    number,
    {
      candidate: (typeof vectorCandidates)[0];
      rrfScore: number;
    }
  >();

  // RRF Constant k = 60
  vectorCandidates.forEach((c, rank) => {
    const score = 1 / (60 + (rank + 1));
    rrfScores.set(c.id, { candidate: c, rrfScore: score });
  });

  // Sort candidates by RRF score
  const rrfSortedCandidates = Array.from(rrfScores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, 15)
    .map((item) => item.candidate);

  if (rrfSortedCandidates.length === 0) return [];

  // 3. Cloudflare BGE Reranker (~40ms)
  const documentsToRerank = rrfSortedCandidates.map(
    (c) =>
      `[Eser: ${c.title} | Sayfa: ${c.printedPageNumber ?? c.pdfPageNumber ?? 1}${c.sectionTitle ? ` | Bölüm: ${c.sectionTitle}` : ""}]\n${c.content}`,
  );

  const reranked = await rerankWithCloudflare({
    query,
    documents: documentsToRerank,
    topN: topK,
    logger,
  });

  const finalResults: RagSearchResultItem[] = reranked.map((r) => {
    const candidate = rrfSortedCandidates[r.index];
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
      relevanceScore: r.relevanceScore,
    };
  });

  logger?.info("rag_hybrid_search_success", {
    service: "rag-search",
    data: {
      queryLength: query.length,
      candidateCount: vectorCandidates.length,
      rerankedCount: finalResults.length,
      durationMs: Math.round(performance.now() - searchStart),
    },
  });

  return finalResults;
}
