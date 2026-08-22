import type { Logger } from "@/lib/logger";
import { runMistralOcr } from "./mistral-driver";
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

/**
 * Parses a scanned PDF document using Mistral OCR and Gemini Flash-Lite.
 *
 * @param fileName - Original file name.
 * @param r2Key - R2 key of the PDF file.
 * @param options - Parser options (startPage, endPage).
 * @param logger - Optional logger.
 * @returns DocumentAnalysisResult.
 */
export async function parseScannedPdf(
  fileName: string,
  r2Key: string,
  options: PdfParseOptions = {},
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  logger?.info("pdf_parser_scanned_mistral_start", {
    service: "pdf-parser",
    data: { fileName, r2Key },
    hidden: true,
  });

  const pageMarkdowns = await runMistralOcr(r2Key, logger);

  const pdfParseContentStart = performance.now();
  logger?.info("pdf_parse_content_start", {
    service: "pdf-parser",
    data: { fileName },
  });

  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? pageMarkdowns.length;

  const pages: PageAnalysis[] = pageMarkdowns
    .slice(firstStart - 1, safeEnd)
    .map((page) => ({
      pageNumber: page.index + 1,
      printedPageNumber: page.printedPageNumber,
      markdownContent: page.markdown,
    }));

  // First 5 pages text for metadata extraction
  const first5PagesText = pages
    .slice(0, 5)
    .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.markdownContent}`)
    .join("\n\n");

  // Bibliography detection
  const bibPages = findBibliographyPages(pages, (p) => p.markdownContent);

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

  logger?.info("pdf_parse_content_success", {
    service: "pdf-parser",
    durationMs: Math.round(performance.now() - pdfParseContentStart),
    data: { fileName, referenceCount: extractedReferences.length },
  });

  logger?.info("pdf_parser_scanned_mistral_success", {
    service: "pdf-parser",
    data: { fileName, pageCount: pages.length },
    hidden: true,
  });

  return {
    metadata: {
      title: extractedMetadata.title?.trim() || fileName.replace(/\.pdf$/i, ""),
      authors: extractedMetadata.authors ?? [],
      publicationYear: extractedMetadata.publicationYear,
      publisher: extractedMetadata.publisher,
      doi: extractedMetadata.doi,
    },
    pages,
    references: extractedReferences,
  };
}
