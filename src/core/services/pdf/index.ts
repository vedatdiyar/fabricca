import { processPdf as processPdfInspector } from "@firecrawl/pdf-inspector";
import type { Logger } from "@/lib/logger";
import { buildChunksFromPageAnalysis } from "./chunker";
import { type DocumentAnalysisResult, type PageAnalysis } from "./schema";
import type { PdfParseOptions, PdfChunkParseResult } from "./types";
import { parseScannedPdf } from "./scanned-parser";
import { parseBornDigitalPdf } from "./born-digital-parser";

export type { DocumentAnalysisResult, PageAnalysis };
export { DocumentAnalysisSchema, ReferencesOnlySchema } from "./schema";
export type { PdfParseOptions, PdfChunkParseResult };
export {
  detectPrintedPageNumbers,
  resolveAnchorChain,
  isYear,
  MAX_BACKWARD_EXTRAP_PAGES,
  type PrintedPageDetection,
  type PositionedTextItemInput,
} from "./page-detection-born-digital";
export {
  parseRunningHeadNumber,
  resolveMistralPrintedPages,
  type MistralOcrPage,
} from "./page-detection-ocr";

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

  if (isScanned) {
    return parseScannedPdf(fileName, r2Key, options, logger);
  }

  return parseBornDigitalPdf(pdfBuffer, fileName, options, logger);
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
