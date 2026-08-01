import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources, chunks as chunkRows } from "@/db/schema";
import { uploadPdfToR2 } from "@/lib/services/r2";
import { parsePdfWithHybridRouter } from "@/lib/services/pdf-parser";
import type { DocumentChunk } from "@/lib/services/llamaparse";
import { generateVectorEmbeddings } from "@/lib/services/cloudflare-ai";
import type { Logger } from "@/lib/logger";

interface ProcessPdfPipelineOptions {
  resourceId: number;
  fileName: string;
  buffer: Buffer;
  log: Logger;
  precomputedChunks?: DocumentChunk[];
}

/**
 * Service Helper: Shared PDF RAG Ingestion Pipeline.
 *
 * Uses the smart hybrid PDF router:
 * - Single/Multi-column text → fast local unpdf extraction (milliseconds)
 * - Scanned / chaotic layout → LlamaParse API OCR
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
  let chunks: DocumentChunk[];
  if (options.precomputedChunks && options.precomputedChunks.length > 0) {
    chunks = options.precomputedChunks;
  } else {
    chunks = await parsePdfWithHybridRouter(buffer, fileName, log);
  }

  // ── 2 & 3. Fetch Resource Metadata for Header Context ──
  const resource = await db.query.sources.findFirst({
    where: eq(sources.id, resourceId),
  });

  const resourceTitle = resource?.title || fileName;
  const resourceAuthors = resource?.authors?.join(", ") || "Bilinmeyen Yazar";

  // Prepare texts for vector embedding with injected Header Context
  const embeddingTexts = chunks.map((c) => {
    const pageNum = c.printedPageNumber ?? c.pdfPageNumber ?? 1;
    const sectionStr = c.sectionTitle ? ` | Bölüm: ${c.sectionTitle}` : "";
    const headerContext = `[Eser: ${resourceTitle} | Yazar: ${resourceAuthors} | Sayfa: ${pageNum}${sectionStr}]\n`;
    return headerContext + c.content;
  });

  log.info("pdf_r2_and_embed_parallel_start", {
    service: "library",
    data: { resourceId, chunkCount: embeddingTexts.length },
  });

  const r2AndEmbedStart = performance.now();
  const [{ r2Url }, embeddings] = await Promise.all([
    uploadPdfToR2(buffer, resourceId, fileName),
    generateVectorEmbeddings(embeddingTexts, log),
  ]);

  log.info("pdf_r2_and_embed_parallel_success", {
    service: "library",
    data: {
      resourceId,
      chunkCount: embeddingTexts.length,
      durationMs: Math.round(performance.now() - r2AndEmbedStart),
    },
  });

  // ── 4. Batch Insert into pgvector (50 rows per query in parallel) ──
  log.info("pdf_db_batch_insert_start", {
    service: "library",
    data: { resourceId },
  });

  const dbStart = performance.now();
  await db.delete(chunkRows).where(eq(chunkRows.sourceId, resourceId));

  if (chunks.length > 0) {
    const recordsToInsert = chunks.map((chunk, index) => ({
      sourceId: resourceId,
      chunkIndex: chunk.chunkIndex,
      printedPageNumber: chunk.printedPageNumber,
      pdfPageNumber: chunk.pdfPageNumber,
      sectionTitle: chunk.sectionTitle,
      content: chunk.content,
      parentContent: chunk.parentContent || chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[index] || new Array(1024).fill(0),
    }));

    const batchSize = 50;
    const insertPromises = [];
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);
      insertPromises.push(db.insert(chunkRows).values(batch));
    }
    await Promise.all(insertPromises);
  }

  log.info("pdf_db_batch_insert_success", {
    service: "library",
    data: {
      resourceId,
      chunkCount: chunks.length,
      durationMs: Math.round(performance.now() - dbStart),
    },
  });

  // ── 5. Update Resource Status ──
  log.info("pdf_db_status_update_start", {
    service: "library",
    data: { resourceId },
  });

  const updateStart = performance.now();
  await db
    .update(sources)
    .set({
      pdfUrl: r2Url,
      pdfFileName: fileName,
      pdfFileSize: buffer.length,
      pdfStatus: "READY",
    })
    .where(eq(sources.id, resourceId));

  log.info("pdf_db_status_update_success", {
    service: "library",
    data: {
      resourceId,
      durationMs: Math.round(performance.now() - updateStart),
    },
  });

  return {
    r2Url,
    finalFileName: fileName,
    finalSize: buffer.length,
    chunkCount: chunks.length,
  };
}
