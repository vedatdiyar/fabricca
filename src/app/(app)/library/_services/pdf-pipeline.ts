import { eq } from "drizzle-orm";
import { db } from "@/db";
import { libraryResources, resourceEmbeddings } from "@/db/schema";
import { uploadPdfToR2 } from "@/lib/services/r2";
import {
  compressPdfWithILovePdf,
  DEFAULT_PDF_COMPRESS_THRESHOLD_BYTES,
} from "@/lib/services/ilovepdf";
import { parsePdfWithUnstructured } from "@/lib/services/unstructured";
import type { UnstructuredChunk } from "@/lib/services/unstructured";
import { generateCohereEmbeddings } from "@/lib/services/cohere";
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
 * Handles iLovePDF compression, R2 storage upload, Unstructured PDF chunking (unless precomputedChunks provided),
 * Cohere vector embeddings generation, Neon pgvector batch insertion, and resource DB status update.
 *
 * @param options - Resource ID, target filename, PDF file buffer, Logger instance, and optional precomputed chunks.
 * @returns Object containing r2Url, finalFileName, chunkCount, and maxPage.
 */
export async function processResourcePdfPipeline(
  options: ProcessPdfPipelineOptions,
) {
  const { resourceId, fileName, log } = options;
  let buffer = options.buffer;
  const initialSize = buffer.length;

  // 1. Check size threshold for iLovePDF compression
  const thresholdBytes = process.env.PDF_COMPRESS_THRESHOLD_BYTES
    ? parseInt(process.env.PDF_COMPRESS_THRESHOLD_BYTES, 10)
    : DEFAULT_PDF_COMPRESS_THRESHOLD_BYTES;

  if (initialSize > thresholdBytes) {
    log.info("pdf_compression_threshold_exceeded", {
      service: "library",
      data: { resourceId, initialSize, thresholdBytes },
    });

    const compressResult = await compressPdfWithILovePdf(buffer, fileName);
    buffer = Buffer.from(compressResult.buffer);
  }

  // 2. Upload PDF file directly to Cloudflare R2 Bucket
  const { r2Url } = await uploadPdfToR2(buffer, resourceId, fileName);

  // 3. Parse and chunk PDF using Unstructured API (or use precomputed chunks)
  let chunks: UnstructuredChunk[];
  if (options.precomputedChunks && options.precomputedChunks.length > 0) {
    chunks = options.precomputedChunks;
    log.info("pdf_unstructured_parse_skipped", {
      service: "library",
      data: { resourceId, chunkCount: chunks.length },
    });
  } else {
    log.info("pdf_unstructured_parse_start", {
      service: "library",
      data: { resourceId },
    });
    chunks = await parsePdfWithUnstructured(buffer, fileName);
  }

  // 4. Extract text content for Cohere embeddings vectorization
  const chunkTexts = chunks.map((c) => c.content);
  log.info("pdf_cohere_embed_start", {
    service: "library",
    data: { resourceId, chunkCount: chunkTexts.length },
  });
  const embeddings = await generateCohereEmbeddings(
    chunkTexts,
    "search_document",
    log,
  );

  // 5. Clear any previous embeddings for this resource ID
  await db
    .delete(resourceEmbeddings)
    .where(eq(resourceEmbeddings.libraryResourceId, resourceId));

  // 6. Batch insert chunks & vector embeddings into Neon PostgreSQL pgvector
  if (chunks.length > 0) {
    const recordsToInsert = chunks.map((chunk, index) => ({
      libraryResourceId: resourceId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[index] || new Array(1024).fill(0),
    }));

    // Insert in batches of 50 records
    const batchSize = 50;
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);
      await db.insert(resourceEmbeddings).values(batch);
    }
  }

  // 7. Determine max page number from parsed chunks
  const pageNumbers = chunks
    .map((c) => c.pageNumber)
    .filter((p): p is number => p !== null);
  const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;

  // 8. Update resource PDF metadata and set status READY
  await db
    .update(libraryResources)
    .set({
      pdfUrl: r2Url,
      pdfFileName: fileName,
      pdfFileSize: buffer.length,
      pdfStatus: "READY",
      pageCount: maxPage,
    })
    .where(eq(libraryResources.id, resourceId));

  return {
    r2Url,
    finalFileName: fileName,
    finalSize: buffer.length,
    chunkCount: chunks.length,
    maxPage,
  };
}
