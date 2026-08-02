import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources, chunks as chunkRows } from "@/db/schema";
import type { NewChunk } from "@/db/schema";
import { uploadPdfToR2 } from "@/lib/services/r2";
import { parsePdfDocument } from "@/lib/services/pdf-parser";
import { parseAndSaveReferences } from "@/lib/services/pdf/reference-parser";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import { generateVectorEmbeddings } from "@/lib/services/cloudflare-ai";
import type { Logger } from "@/lib/logger";

interface ProcessPdfOptions {
  resourceId: number;
  fileName: string;
  buffer: Buffer;
  log: Logger;
  precomputedChunks?: DocumentChunk[];
  precomputedReferences?: string | null;
}

/**
 * Shared PDF RAG ingestion pipeline: parses via Unstructured Transform API, uploads to R2, generates embeddings, batch-inserts chunks into pgvector, extracts raw references and updates resource metadata.
 *
 * @param options - The pipeline options.
 * @returns The R2 URL, final file name, final size, and chunk count.
 */
export async function processResourcePdfPipeline(options: ProcessPdfOptions) {
  const { resourceId, fileName, log, buffer } = options;

  let chunks: DocumentChunk[];
  let rawReferences: string | null = options.precomputedReferences ?? null;

  if (options.precomputedChunks && options.precomputedChunks.length > 0) {
    chunks = options.precomputedChunks;
  } else {
    const parsed = await parsePdfDocument(buffer, fileName, log);
    chunks = parsed.chunks;
    rawReferences = parsed.rawReferences;
  }

  // Embed only the raw content — metadata prefixes are excluded from the
  // embedding text to preserve semantic fidelity in the vector space.
  const embeddingTexts = chunks.map((c) => c.content);

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

      for (const { batchChunks, batchEmbeddings } of batches) {
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
            content: c.content,
            parentContent: c.parentContent || c.content,
            section: c.section ?? null,
            pageStart: c.pageStart ?? null,
            pageEnd: c.pageEnd ?? null,
            contentHash: c.contentHash,
            metadata: c.metadata,
            tokenCount: c.tokenCount ?? 0,
            embedding: emb,
          };
        });

        await tx.insert(chunkRows).values(rows);
      }
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
      rawReferences: rawReferences,
    })
    .where(eq(sources.id, resourceId));

  log.info("pdf_db_status_update_success", {
    service: "library",
    data: {
      resourceId,
      durationMs: Math.round(performance.now() - updateStart),
    },
  });

  log.info("pdf_references_parse_start", {
    service: "library",
    data: { resourceId, hasReferences: rawReferences !== null },
  });

  if (rawReferences) {
    await parseAndSaveReferences(resourceId, rawReferences, log);
  }

  return {
    r2Url,
    finalFileName: fileName,
    finalSize: buffer.length,
    chunkCount: chunks.length,
  };
}
