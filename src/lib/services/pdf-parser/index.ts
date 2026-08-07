import {
  processPdf as processPdfInspector,
  extractPagesMarkdown as extractPdfInspectorPages,
} from "@firecrawl/pdf-inspector";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { Logger } from "@/lib/logger";
import { buildChunksFromPageAnalysis } from "@/lib/services/pdf/chunker";
import {
  loadPdfSource,
  getPdfPageCount,
  extractBatchFromDoc,
} from "./splitter";
import { type DocumentAnalysisResult, type PageAnalysis } from "./schema";
import type {
  PdfBatchMetric,
  PdfParseOptions,
  PdfChunkParseResult,
} from "./types";
import { getPdfParserKeyPool } from "./key-pool";
import {
  parseBatchVision,
  extractDocumentMetadata,
  extractDocumentReferences,
} from "./gemini-driver";

export type { DocumentAnalysisResult, PageAnalysis };
export { DocumentAnalysisSchema, ReferencesOnlySchema } from "./schema";
export {
  loadPdfSource,
  getPdfPageCount,
  extractBatchFromDoc,
} from "./splitter";
export type { PdfBatchMetric, PdfParseOptions, PdfChunkParseResult };

const BATCH_SIZE = 5;

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references via Gemini 3.1 Flash-Lite.
 *
 * @param pdfBuffer - Raw PDF file content buffer.
 * @param fileName - Original file name (used for logging and fallback title).
 * @param options - Optional driver settings (page range, batch size, concurrency).
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult with metadata, pages, and references.
 */
export async function parsePdfToDocumentAnalysis(
  pdfBuffer: Buffer,
  fileName: string,
  options: PdfParseOptions = {},
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const pool = getPdfParserKeyPool();
  const inspection = processPdfInspector(pdfBuffer);
  const isScanned = inspection.pdfType === "Scanned";

  if (isScanned) {
    // Scanned fallback: Vision base64 PDF batching via Gemini 3.1 Flash-Lite
    const loadedDoc = await loadPdfSource(pdfBuffer);
    const totalPages = getPdfPageCount(loadedDoc);
    const firstStart = Math.max(1, options.startPage ?? 1);
    const safeEnd = options.endPage ?? totalPages;
    const batchSize = options.batchSize ?? BATCH_SIZE;
    const totalBatches = Math.ceil((safeEnd - firstStart + 1) / batchSize);
    const limiter = createConcurrencyLimiter(2);

    const batches = Array.from({ length: totalBatches }, (_, batchIndex) => {
      const currentStart = firstStart + batchIndex * batchSize;
      const currentEnd = Math.min(currentStart + batchSize - 1, safeEnd);
      return {
        startPage: currentStart,
        endPage: currentEnd,
        batchPageCount: currentEnd - currentStart + 1,
        isFirstBatch: batchIndex === 0,
      };
    });

    const batchResults = await Promise.all(
      batches.map((batch, batchIndex) =>
        limiter.exec(async () => {
          const batchBuffer = await extractBatchFromDoc(
            loadedDoc,
            batch.startPage,
            batch.endPage,
          );
          const base64Data = batchBuffer.toString("base64");

          return parseBatchVision(
            base64Data,
            batch.startPage,
            batch.batchPageCount,
            batchIndex,
            batchIndex % pool.length,
            batch.isFirstBatch,
            pool,
            () => {},
            logger,
          );
        }),
      ),
    );

    const pageMap = new Map<number, PageAnalysis>();
    let metadata: DocumentAnalysisResult["metadata"] | null = null;
    const referenceMap = new Map<
      string,
      DocumentAnalysisResult["references"][number]
    >();

    for (const bResult of batchResults) {
      if (!metadata && bResult.metadata?.title) metadata = bResult.metadata;
      for (const p of bResult.pages) pageMap.set(p.pageNumber, p);
      for (const r of bResult.references ?? []) {
        if (!referenceMap.has(r.raw)) referenceMap.set(r.raw, r);
      }
    }

    return {
      metadata: metadata ?? {
        title: fileName.replace(/\.pdf$/i, ""),
        authors: [],
      },
      pages: Array.from(pageMap.values()).sort(
        (a, b) => a.pageNumber - b.pageNumber,
      ),
      references: Array.from(referenceMap.values()),
    };
  }

  // Born-digital PDF: Ultra-fast local text extraction via pdf-inspector (<100ms)
  const extracted = extractPdfInspectorPages(pdfBuffer);
  const totalPages = extracted.pages.length;
  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? totalPages;

  const targetPages = extracted.pages.slice(firstStart - 1, safeEnd);

  // Step 1: Instant page mapping from local markdown
  const pages: PageAnalysis[] = targetPages.map((p) => ({
    pageNumber: p.page + 1,
    markdownContent: p.markdown,
  }));

  // Step 2: Prepare Text for Metadata & Bibliography
  const first5PagesText = targetPages
    .slice(0, 5)
    .map((p) => `=== PAGE ${p.page + 1} ===\n${p.markdown}`)
    .join("\n\n");

  let bibStartPageIndex = -1;
  const searchStart = Math.floor(targetPages.length * 0.6);
  const bibHeadingRegex =
    /(^|\n)(#+\s*|\b)(Kaynakça|Kaynaklar|Kaynak\s+Dizini|Yararlanılan\s+Kaynaklar|Başvurulan\s+Kaynaklar|Referanslar|Atıfta\s+Bulunulan\s+Kaynaklar|Kaynak\s+Listesi|References(\s+and\s+Notes)?|Reference\s+List|Bibliography|Works\s+Cited|Works\s+Consulted|Literature\s+Cited|Cited\s+Literature|Selected\s+(Bibliography|References)|Literaturverzeichnis|Literatur|Références|Bibliographie|Referencias|Bibliografía)\b/i;

  for (let i = searchStart; i < targetPages.length; i++) {
    if (bibHeadingRegex.test(targetPages[i].markdown)) {
      bibStartPageIndex = i;
      break;
    }
  }

  if (bibStartPageIndex === -1) {
    for (let i = searchStart; i < targetPages.length; i++) {
      if (
        /(references|bibliography|kaynakça|kaynaklar|referanslar|works\s+cited)/i.test(
          targetPages[i].markdown,
        )
      ) {
        bibStartPageIndex = i;
        break;
      }
    }
  }

  let bibEndPageIndex = targetPages.length;
  if (bibStartPageIndex !== -1) {
    const anyNextHeadingRegex = /(^|\n)#{1,4}\s+\S+/;

    for (let i = bibStartPageIndex + 1; i < targetPages.length; i++) {
      if (anyNextHeadingRegex.test(targetPages[i].markdown)) {
        bibEndPageIndex = i;
        break;
      }
    }
  }

  const bibPages =
    bibStartPageIndex !== -1
      ? targetPages.slice(
          bibStartPageIndex,
          Math.min(bibEndPageIndex, bibStartPageIndex + 30),
        )
      : [];

  // Step 3: Parallel Gemini 3.1 Flash-Lite Extraction (Metadata + 1-Page Chunked References)
  const metadataPromise = extractDocumentMetadata(
    first5PagesText,
    pool,
    logger,
  );

  let referencesPromise: Promise<DocumentAnalysisResult["references"]> =
    Promise.resolve([]);

  if (bibPages.length > 0) {
    const chunkPromises = bibPages.map((p) => {
      const pageText = `=== PAGE ${p.page + 1} ===\n${p.markdown}`;
      return extractDocumentReferences(pageText, pool, logger);
    });

    referencesPromise = Promise.all(chunkPromises).then((results) => {
      const merged = results.flat();
      const refMap = new Map<
        string,
        DocumentAnalysisResult["references"][number]
      >();
      for (const r of merged) {
        if (r.raw && !refMap.has(r.raw)) {
          refMap.set(r.raw, r);
        }
      }
      return Array.from(refMap.values());
    });
  }

  const [extractedMetadata, extractedReferences] = await Promise.all([
    metadataPromise,
    referencesPromise,
  ]);

  const finalMetadata: DocumentAnalysisResult["metadata"] = {
    title: extractedMetadata.title?.trim() || fileName.replace(/\.pdf$/i, ""),
    authors: extractedMetadata.authors ?? [],
    publicationYear: extractedMetadata.publicationYear,
    publisher: extractedMetadata.publisher,
    doi: extractedMetadata.doi,
  };

  return {
    metadata: finalMetadata,
    pages,
    references: extractedReferences,
  };
}

/**
 * Parses a PDF via Gemini 3.1 Flash-Lite, building RAG chunks with header tracking.
 *
 * @param pdfBuffer - Raw PDF file content buffer.
 * @param fileName - Original file name (used for logging).
 * @param logger - Optional logger instance.
 * @returns Chunks, parsed references, and extracted metadata.
 */
export async function parsePdfToChunks(
  pdfBuffer: Buffer,
  fileName: string,
  logger?: Logger,
): Promise<PdfChunkParseResult> {
  logger?.info("pdf_parse_to_chunks_start", {
    service: "pdf-parser",
    data: { fileName },
  });

  const analysis = await parsePdfToDocumentAnalysis(
    pdfBuffer,
    fileName,
    {},
    logger,
  );

  const chunks = await buildChunksFromPageAnalysis(analysis.pages);

  logger?.info("pdf_parse_to_chunks_success", {
    service: "pdf-parser",
    data: {
      fileName,
      pagesParsed: analysis.pages.length,
      chunkCount: chunks.length,
      referencesCount: analysis.references.length,
      metadataTitle: analysis.metadata.title,
    },
  });

  return {
    chunks,
    references: analysis.references,
    metadata: analysis.metadata,
  };
}
