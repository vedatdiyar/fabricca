import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { sources, chunks as chunkRows } from "@/core/db/schema";
import type { NewChunk } from "@/core/db/schema";
import { uploadPdfToR2 } from "@/core/services/storage/r2";
import { parsePdfToChunks } from "@/core/services/pdf";
import type { DocumentChunk } from "@/core/services/pdf/chunker";
import { buildEmbeddingText } from "@/core/services/pdf/chunker";
import { generateVectorEmbeddings } from "@/core/services/ai/cloudflare-ai";
import type { Logger } from "@/lib/logger";
import type { DocumentAnalysisResult } from "@/core/services/pdf/schema";
import type { ParsedReference } from "@/core/db/schema";

interface ProcessPdfOptions {
  resourceId: number;
  fileName: string;
  buffer: Buffer;
  log: Logger;
  precomputedChunks?: DocumentChunk[];
  precomputedMetadata?: DocumentAnalysisResult["metadata"];
  precomputedReferences?: ParsedReference[];
}

/**
 * Shared PDF RAG ingestion pipeline: embeds chunks, uploads to R2, batch-inserts into pgvector, and updates source metadata in a single transaction.
 *
 * @param options - The pipeline options.
 * @returns The R2 URL, final file name, final size, and chunk count.
 */
export async function processResourcePdfPipeline(options: ProcessPdfOptions) {
  const {
    resourceId,
    fileName,
    log,
    buffer,
    precomputedMetadata,
    precomputedReferences,
  } = options;

  let chunks: DocumentChunk[];

  if (options.precomputedChunks !== undefined) {
    chunks = options.precomputedChunks;
  } else {
    const parsed = await parsePdfToChunks(buffer, fileName, "", log);
    chunks = parsed.chunks;
  }

  // Embed with context prefix — [Bölüm: ...] [Sayfa: ...] + raw content
  const embeddingTexts = chunks.map((c) =>
    buildEmbeddingText(
      c.content,
      c.headerHierarchy,
      c.section,
      c.printedPageNumber,
    ),
  );

  log.info("pdf_r2_and_embed_parallel_start", {
    service: "library",
    data: {
      resourceId,
      chunkCount: embeddingTexts.length,
    },
  });

  const r2AndEmbedStart = performance.now();

  const [r2Result, embeddings] = await Promise.all([
    uploadPdfToR2(buffer, resourceId, fileName),
    generateVectorEmbeddings(embeddingTexts, log),
  ]);

  const { r2Url } = r2Result;

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
              `Failed to generate embedding vector for chunk ${c.chunkIndex}.`,
            );
          }
          const quantizedEmbedding = emb.map((value) =>
            Number(value.toFixed(4)),
          );
          return {
            sourceId: resourceId,
            chunkIndex: c.chunkIndex,
            content: c.content,
            parentContent: c.parentContent || c.content,
            section: c.section ?? null,
            headerHierarchy:
              c.headerHierarchy.length > 0 ? c.headerHierarchy : null,
            pageStart: c.pageStart ?? null,
            pageEnd: c.pageEnd ?? null,
            printedPageNumber: c.printedPageNumber ?? null,
            tokenCount: c.tokenCount ?? 0,
            embedding: quantizedEmbedding,
          };
        });

        await tx.insert(chunkRows).values(rows);
      }
    }

    // Single update: metadata + references + pdf status
    await tx
      .update(sources)
      .set({
        pdfUrl: r2Url,
        pdfFileName: fileName,
        pdfFileSize: buffer.length,
        pdfStatus: "READY",
        parsedReferences: precomputedReferences ?? [],
        ...(precomputedMetadata && {
          title: precomputedMetadata.title,
          authors: precomputedMetadata.authors,
          publisher: precomputedMetadata.publisher ?? null,
          publicationYear: precomputedMetadata.publicationYear ?? null,
          doi: precomputedMetadata.doi ?? null,
        }),
      })
      .where(eq(sources.id, resourceId));
  });

  log.info("pdf_db_batch_insert_success", {
    service: "library",
    data: {
      resourceId,
      chunkCount: chunks.length,
      durationMs: Math.round(performance.now() - dbStart),
    },
  });

  return {
    r2Url,
    finalFileName: fileName,
    finalSize: buffer.length,
    chunkCount: chunks.length,
  };
}
