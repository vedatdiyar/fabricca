import { sql, eq, innerProduct, asc, and } from "drizzle-orm";
import { db } from "@/db";
import { chunks, sources, boxes } from "@/db/schema";
import { generateVectorEmbeddings } from "@/services/ai/cloudflare-ai";
import type { Logger } from "@/lib/logger";
import { RAG_CONFIG } from "./config";
import type { DenseCandidate } from "./types";

/**
 * Returns whether a vector is the all-zero fallback produced on API failure.
 *
 * @param vector - Embedding vector to inspect.
 * @returns True when every element is zero.
 */
export function isZeroVector(vector: number[]): boolean {
  return vector.every((value) => value === 0);
}

export interface DenseSearchResult {
  queryEmbedding: number[] | null;
  denseCandidates: DenseCandidate[];
}

/**
 * Executes vector embedding generation and pgvector similarity search over chunks.
 *
 * @param denseQueryText - The prepared dense query text.
 * @param options - Resource ID filters and logger.
 * @returns Generated embedding and retrieved dense candidates.
 */
export async function searchDense(
  denseQueryText: string,
  options: { resourceIds?: number[]; logger?: Logger } = {},
): Promise<DenseSearchResult> {
  const { resourceIds, logger } = options;

  let queryEmbedding: number[] | null = null;
  try {
    const vectors = await generateVectorEmbeddings([denseQueryText], logger);
    queryEmbedding = vectors[0] ?? null;
  } catch (error) {
    logger?.error("rag_dense_embed_failed", {
      service: "rag-search",
      error,
      data: { queryLength: denseQueryText.length },
    });
    return { queryEmbedding: null, denseCandidates: [] };
  }

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

  return { queryEmbedding, denseCandidates };
}
