import { eq } from "drizzle-orm";
import { db } from "@/db";
import { libraryResources, resourceEmbeddings } from "@/db/schema";
import { uploadPdfToR2 } from "@/lib/services/r2";
import { parsePdfWithHybridRouter } from "@/lib/services/pdf-parser";
import type { UnstructuredChunk } from "@/lib/services/unstructured";
import { generateVectorEmbeddings } from "@/lib/services/cloudflare-ai";
import type { Logger } from "@/lib/logger";

interface ProcessPdfPipelineOptions {
  resourceId: number;
  fileName: string;
  buffer: Buffer;
  log: Logger;
  precomputedChunks?: UnstructuredChunk[];
}

/**
 * Service Helper: Shared PDF RAG Ingestion Pipeline.
 *
 * Uses the smart hybrid PDF router:
 * - Single-column / plain text → fast local pdfjs-dist extraction (milliseconds)
 * - Multi-column / scanned / complex layout → Unstructured API fallback
 *
 * Then uploads to R2 storage, generates Cloudflare Workers AI vector embeddings,
 * batch-inserts into Neon pgvector, and updates resource DB status.
 *
 * @param options - Resource ID, target filename, PDF file buffer, Logger instance, optional precomputed chunks.
 * @returns Object containing r2Url, finalFileName, chunkCount, and maxPage.
 */
export async function processResourcePdfPipeline(
  options: ProcessPdfPipelineOptions,
) {
  const { resourceId, fileName, log, buffer } = options;

  // ── 1. PDF Parsing via Hybrid Router ──
  let chunks: UnstructuredChunk[];
  if (options.precomputedChunks && options.precomputedChunks.length > 0) {
    chunks = options.precomputedChunks;
    log.info("pdf_parse_skipped_using_precomputed_chunks", {
      service: "library",
      data: { resourceId, chunkCount: chunks.length },
    });
  } else {
    chunks = await parsePdfWithHybridRouter(buffer, fileName, log);
  }

  // ── 2 & 3. Upload to R2 and Generate Cloudflare Vector Embeddings in Parallel ──
  const chunkTexts = chunks.map((c) => c.content);
  log.info("pdf_r2_and_embed_parallel_start", {
    service: "library",
    data: { resourceId, chunkCount: chunkTexts.length },
  });

  const [{ r2Url }, embeddings] = await Promise.all([
    uploadPdfToR2(buffer, resourceId, fileName),
    generateVectorEmbeddings(chunkTexts, "search_document", log),
  ]);

  // ── 4. Batch Insert into pgvector (300 rows per query in parallel) ──
  await db
    .delete(resourceEmbeddings)
    .where(eq(resourceEmbeddings.libraryResourceId, resourceId));

  if (chunks.length > 0) {
    const recordsToInsert = chunks.map((chunk, index) => ({
      libraryResourceId: resourceId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[index] || new Array(1024).fill(0),
    }));

    const batchSize = 300;
    const insertPromises = [];
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);
      insertPromises.push(db.insert(resourceEmbeddings).values(batch));
    }
    await Promise.all(insertPromises);
  }

  // ── 5. Update Resource Status ──
  await db
    .update(libraryResources)
    .set({
      pdfUrl: r2Url,
      pdfFileName: fileName,
      pdfFileSize: buffer.length,
      pdfStatus: "READY",
    })
    .where(eq(libraryResources.id, resourceId));

  return {
    r2Url,
    finalFileName: fileName,
    finalSize: buffer.length,
    chunkCount: chunks.length,
  };
}
