import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources, chunks as chunkRows } from "@/db/schema";
import type { NewChunk } from "@/db/schema";
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
 * Shared PDF RAG ingestion pipeline: parses via the hybrid router, uploads to R2, generates embeddings, batch-inserts chunks into pgvector, and updates the resource DB status.
 *
 * @param options - The pipeline options.
 * @param options.resourceId - The ID of the resource being processed.
 * @param options.fileName - The target PDF file name in R2.
 * @param options.buffer - The raw PDF file buffer.
 * @param options.log - The structured logger instance.
 * @param options.precomputedChunks - Optional pre-parsed document chunks to reuse instead of parsing.
 * @returns The R2 URL, final file name, final size, and chunk count.
 */
export async function processResourcePdfPipeline(
  options: ProcessPdfPipelineOptions,
) {
  const { resourceId, fileName, log, buffer } = options;

  let chunks: DocumentChunk[];
  if (options.precomputedChunks && options.precomputedChunks.length > 0) {
    chunks = options.precomputedChunks;
  } else {
    chunks = await parsePdfWithHybridRouter(buffer, fileName, log);
  }

  const resource = await db.query.sources.findFirst({
    where: eq(sources.id, resourceId),
  });

  const resourceTitle = resource?.title || fileName;
  const resourceAuthors = resource?.authors?.join(", ") || "Bilinmeyen Yazar";

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

  log.info("pdf_db_batch_insert_start", {
    service: "library",
    data: { resourceId },
  });

  const dbStart = performance.now();
  await db.transaction(async (tx) => {
    await tx.delete(chunkRows).where(eq(chunkRows.sourceId, resourceId));

    if (chunks.length > 0) {
      const batchSize = 300;
      const batches = [];
      for (let i = 0; i < chunks.length; i += batchSize) {
        batches.push({
          batchChunks: chunks.slice(i, i + batchSize),
          batchEmbeddings: embeddings.slice(i, i + batchSize),
        });
      }

      await Promise.all(
        batches.map(async ({ batchChunks, batchEmbeddings }) => {
          const rows: NewChunk[] = batchChunks.map((c, index) => {
            const emb = batchEmbeddings[index];
            if (!emb) {
              throw new Error(
                `Chunk ${c.chunkIndex} için embedding vektörü üretilemedi.`,
              );
            }
            return {
              sourceId: resourceId,
              chunkIndex: c.chunkIndex,
              printedPageNumber: c.printedPageNumber ?? null,
              pdfPageNumber: c.pdfPageNumber ?? null,
              sectionTitle: c.sectionTitle ?? null,
              content: c.content,
              parentContent: c.parentContent || c.content,
              tokenCount: c.tokenCount ?? 0,
              embedding: emb,
            };
          });

          await tx.insert(chunkRows).values(rows);
        }),
      );
    }
  });

  log.info("pdf_db_batch_insert_success", {
    service: "library",
    data: {
      resourceId,
      chunkCount: chunks.length,
      durationMs: Math.round(performance.now() - dbStart),
    },
  });

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
