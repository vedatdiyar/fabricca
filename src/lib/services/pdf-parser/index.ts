import {
  processPdf as processPdfInspector,
  extractPagesMarkdown as extractPdfInspectorPages,
} from "@firecrawl/pdf-inspector";
import type { Logger } from "@/lib/logger";
import { buildChunksFromPageAnalysis } from "@/lib/services/pdf/chunker";
import { normalizeAcademicText } from "@/lib/services/pdf/normalizer";
import { type DocumentAnalysisResult, type PageAnalysis } from "./schema";
import type { PdfParseOptions, PdfChunkParseResult } from "./types";
import { runMistralOcr } from "./mistral-driver";
import {
  extractDocumentMetadata,
  extractDocumentReferences,
} from "./llm-driver";

export type { DocumentAnalysisResult, PageAnalysis };
export { DocumentAnalysisSchema, ReferencesOnlySchema } from "./schema";
export type { PdfParseOptions, PdfChunkParseResult };

/**
 * Number of bibliography pages grouped into a single Gemini reference-extraction call.
 * Batching 4 pages per call was benchmarked as the fastest reliable configuration.
 */
const REFERENCES_BATCH_SIZE = 4 as const;

/**
 * Groups bibliography pages into fixed-size batches and joins each batch into a
 * single page-marked text block, so each group shares one Gemini reference call
 * instead of firing a request per page.
 *
 * @param pages - Bibliography pages to process.
 * @param toPageText - Converts one page into its page-marked text block.
 * @param batchSize - Pages per batch (defaults to REFERENCES_BATCH_SIZE).
 * @returns Combined batch texts, one per reference-extraction call.
 */
function buildReferenceBatches<T>(
  pages: T[],
  toPageText: (page: T) => string,
  batchSize = REFERENCES_BATCH_SIZE,
): string[] {
  const batches: string[] = [];
  for (let i = 0; i < pages.length; i += batchSize) {
    batches.push(
      pages
        .slice(i, i + batchSize)
        .map(toPageText)
        .join("\n\n"),
    );
  }
  return batches;
}

/**
 * Flattens per-batch reference results and removes duplicates keyed by raw text.
 *
 * @param results - Reference arrays returned by each batch extraction call.
 * @returns Unique references preserving first-seen order.
 */
function dedupeReferences(
  results: DocumentAnalysisResult["references"][],
): DocumentAnalysisResult["references"] {
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
}

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references.
 *
 * - **Scanned PDF:** Markdown extracted via Mistral OCR (R2 presigned URL → server-to-server fetch).
 *   Metadata and references are then extracted via Gemini Flash-Lite.
 * - **Born-digital PDF:** Text extracted locally via pdf-inspector (<100 ms).
 *   Metadata and references are extracted in parallel via Gemini Flash-Lite.
 *
 * @param pdfBuffer - Raw PDF file content buffer.
 * @param fileName - Original file name (used for logging and fallback title).
 * @param r2Key - R2 object key of the PDF. Required for scanned PDFs (Mistral OCR fetches from R2).
 *   Ignored for born-digital PDFs.
 * @param options - Optional driver settings (page range).
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult with metadata, pages, and references.
 */
export async function parsePdfToDocumentAnalysis(
  pdfBuffer: Buffer,
  fileName: string,
  r2Key: string,
  options: PdfParseOptions = {},
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const inspection = processPdfInspector(pdfBuffer);
  const isScanned = inspection.pdfType === "Scanned";

  // ── Scanned PDF: Mistral OCR ──────────────────────────────────────────────
  if (isScanned) {
    logger?.info("pdf_parser_scanned_mistral_start", {
      service: "pdf-parser",
      data: { fileName, r2Key },
      hidden: true,
    });

    const pageMarkdowns = await runMistralOcr(r2Key, logger);

    logger?.info("pdf_parse_content_start", {
      service: "pdf-parser",
      data: { fileName },
    });

    const firstStart = Math.max(1, options.startPage ?? 1);
    const safeEnd = options.endPage ?? pageMarkdowns.length;

    const pages: PageAnalysis[] = pageMarkdowns
      .slice(firstStart - 1, safeEnd)
      .map((markdown, i) => ({
        pageNumber: firstStart + i,
        markdownContent: markdown,
      }));

    // First 5 pages text for metadata extraction
    const first5PagesText = pages
      .slice(0, 5)
      .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.markdownContent}`)
      .join("\n\n");

    // Bibliography detection (same regex as born-digital path)
    const bibHeadingRegex =
      /(^|\n)(#+\s*|\b)(Kaynakça|Kaynaklar|Kaynak\s+Dizini|Yararlanılan\s+Kaynaklar|Başvurulan\s+Kaynaklar|Referanslar|Atıfta\s+Bulunulan\s+Kaynaklar|Kaynak\s+Listesi|References(\s+and\s+Notes)?|Reference\s+List|Bibliography|Works\s+Cited|Works\s+Consulted|Literature\s+Cited|Cited\s+Literature|Selected\s+(Bibliography|References)|Literaturverzeichnis|Literatur|Références|Bibliographie|Referencias|Bibliografía)\b/i;

    let bibStartPageIndex = -1;
    const searchStart = Math.floor(pages.length * 0.6);

    for (let i = searchStart; i < pages.length; i++) {
      if (bibHeadingRegex.test(pages[i].markdownContent)) {
        bibStartPageIndex = i;
        break;
      }
    }

    if (bibStartPageIndex === -1) {
      for (let i = searchStart; i < pages.length; i++) {
        if (
          /(references|bibliography|kaynakça|kaynaklar|referanslar|works\s+cited)/i.test(
            pages[i].markdownContent,
          )
        ) {
          bibStartPageIndex = i;
          break;
        }
      }
    }

    let bibEndPageIndex = pages.length;
    if (bibStartPageIndex !== -1) {
      for (let i = bibStartPageIndex + 1; i < pages.length; i++) {
        if (/(^|\n)#{1,4}\s+\S+/.test(pages[i].markdownContent)) {
          bibEndPageIndex = i;
          break;
        }
      }
    }

    const bibPages =
      bibStartPageIndex !== -1
        ? pages.slice(
            bibStartPageIndex,
            Math.min(bibEndPageIndex, bibStartPageIndex + 30),
          )
        : [];

    // Parallel: metadata + references extraction via Gemini Flash-Lite
    const metadataPromise = extractDocumentMetadata(first5PagesText, logger);

    let referencesPromise: Promise<DocumentAnalysisResult["references"]> =
      Promise.resolve([]);

    if (bibPages.length > 0) {
      const batches = buildReferenceBatches(
        bibPages,
        (p) => `=== PAGE ${p.pageNumber} ===\n${p.markdownContent}`,
      );
      const chunkPromises = batches.map((batchText) =>
        extractDocumentReferences(batchText, logger),
      );

      referencesPromise = Promise.all(chunkPromises).then((results) =>
        dedupeReferences(results),
      );
    }

    const [extractedMetadata, extractedReferences] = await Promise.all([
      metadataPromise,
      referencesPromise,
    ]);

    logger?.info("pdf_parser_scanned_mistral_success", {
      service: "pdf-parser",
      data: { fileName, pageCount: pages.length },
      hidden: true,
    });

    return {
      metadata: {
        title:
          extractedMetadata.title?.trim() || fileName.replace(/\.pdf$/i, ""),
        authors: extractedMetadata.authors ?? [],
        publicationYear: extractedMetadata.publicationYear,
        publisher: extractedMetadata.publisher,
        doi: extractedMetadata.doi,
      },
      pages,
      references: extractedReferences,
    };
  }

  // ── Born-digital PDF: pdf-inspector ──────────────────────────────────────
  const extracted = extractPdfInspectorPages(pdfBuffer);
  const totalPages = extracted.pages.length;
  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? totalPages;

  const targetPages = extracted.pages.slice(firstStart - 1, safeEnd);

  // Step 1: Instant page mapping from local markdown
  const pages: PageAnalysis[] = targetPages.map((p) => ({
    pageNumber: p.page + 1,
    markdownContent: normalizeAcademicText(p.markdown),
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

  // Step 3: Parallel Gemini Flash-Lite extraction (Metadata + 1-Page Chunked References)
  logger?.info("pdf_parse_content_start", {
    service: "pdf-parser",
    data: { fileName },
  });

  const metadataPromise = extractDocumentMetadata(first5PagesText, logger);

  let referencesPromise: Promise<DocumentAnalysisResult["references"]> =
    Promise.resolve([]);

  if (bibPages.length > 0) {
    const batches = buildReferenceBatches(
      bibPages,
      (p) => `=== PAGE ${p.page + 1} ===\n${p.markdown}`,
    );
    const chunkPromises = batches.map((batchText) =>
      extractDocumentReferences(batchText, logger),
    );

    referencesPromise = Promise.all(chunkPromises).then((results) =>
      dedupeReferences(results),
    );
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
 * Parses a PDF via pdf-inspector or Mistral OCR, building RAG chunks with header tracking.
 *
 * @param pdfBuffer - Raw PDF file content buffer.
 * @param fileName - Original file name (used for logging).
 * @param r2Key - R2 object key of the PDF. Required for scanned PDF processing via Mistral OCR.
 * @param logger - Optional logger instance.
 * @returns Chunks, parsed references, and extracted metadata.
 */
export async function parsePdfToChunks(
  pdfBuffer: Buffer,
  fileName: string,
  r2Key: string,
  logger?: Logger,
): Promise<PdfChunkParseResult> {
  const analysis = await parsePdfToDocumentAnalysis(
    pdfBuffer,
    fileName,
    r2Key,
    {},
    logger,
  );

  const chunks = await buildChunksFromPageAnalysis(analysis.pages);

  logger?.info("pdf_parse_content_success", {
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
