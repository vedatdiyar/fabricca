import {
  extractPagesMarkdown as extractPdfInspectorPages,
  extractTextWithPositions as extractPdfInspectorTextPositions,
} from "@firecrawl/pdf-inspector";
import type { Logger } from "@/lib/logger";
import { normalizeAcademicText } from "./normalizer";
import { detectPrintedPageNumbers } from "./page-detection-born-digital";
import { createPrintedPageResolver } from "./page-resolution";
import {
  findBibliographyPages,
  buildReferenceBatches,
  dedupeReferences,
} from "./bibliography";
import {
  extractDocumentMetadata,
  extractDocumentReferences,
} from "./llm-driver";
import type { DocumentAnalysisResult, PageAnalysis } from "./schema";
import type { PdfParseOptions } from "./types";

import type { PositionedTextItemInput } from "./page-detection-born-digital";

/**
 * Parses a born-digital PDF document using local pdf-inspector extraction and Gemini Flash-Lite.
 *
 * @param pdfBuffer - Raw PDF buffer.
 * @param fileName - Original file name.
 * @param options - Parser options (startPage, endPage).
 * @param logger - Optional logger.
 * @param preloadedPositionedItems - Optional pre-extracted text items with coordinates.
 * @returns DocumentAnalysisResult.
 */
export async function parseBornDigitalPdf(
  pdfBuffer: Buffer,
  fileName: string,
  options: PdfParseOptions = {},
  logger?: Logger,
  preloadedPositionedItems?: PositionedTextItemInput[],
): Promise<DocumentAnalysisResult> {
  const extracted = extractPdfInspectorPages(pdfBuffer);
  const totalPages = extracted.pages.length;
  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? totalPages;

  const targetPages = extracted.pages.slice(firstStart - 1, safeEnd);

  // Printed page number detection: position-based Page-Association + font
  // filter + 3-page anchor on the full buffer, then backward extrapolation
  // for cover/front pages that precede the confirmed chain.
  const positionedItems =
    preloadedPositionedItems ?? extractPdfInspectorTextPositions(pdfBuffer);
  const pageDetection = positionedItems.some((it) => it.text.trim().length > 0)
    ? detectPrintedPageNumbers(positionedItems)
    : null;

  const resolvePrinted = createPrintedPageResolver(pageDetection);

  // Step 1: Instant page mapping from local markdown
  const pages: PageAnalysis[] = targetPages.map((p) => ({
    pageNumber: p.page + 1,
    printedPageNumber: resolvePrinted(p.page),
    markdownContent: normalizeAcademicText(p.markdown),
  }));

  logger?.info("pdf_parse_printed_page_detection", {
    service: "pdf-parser",
    hidden: true,
    data: {
      fileName,
      detectedPages: pageDetection?.printedByPage.size ?? 0,
      offset: pageDetection?.offset ?? null,
    },
  });

  // Step 2: Prepare Text for Metadata & Bibliography
  const first5PagesText = targetPages
    .slice(0, 5)
    .map((p) => `=== PAGE ${p.page + 1} ===\n${p.markdown}`)
    .join("\n\n");

  // Bibliography detection (shared with scanned path)
  const bibPages = findBibliographyPages(targetPages, (p) => p.markdown);

  // Step 3: Parallel Gemini Flash-Lite extraction (Metadata + 1-Page Chunked References)
  const pdfParseContentStart = performance.now();
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

  logger?.info("pdf_parse_content_success", {
    service: "pdf-parser",
    durationMs: Math.round(performance.now() - pdfParseContentStart),
    data: { fileName, referenceCount: extractedReferences.length },
  });

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
