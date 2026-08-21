import {
  processPdf as processPdfInspector,
  extractTextWithPositions as extractPdfInspectorTextPositions,
} from "@firecrawl/pdf-inspector";
import type { Logger } from "@/lib/logger";
import { buildChunksFromPageAnalysis } from "./chunker";
import { type DocumentAnalysisResult, type PageAnalysis } from "./schema";
import type { PdfParseOptions, PdfChunkParseResult } from "./types";
import { parseScannedPdf } from "./scanned-parser";
import { parseBornDigitalPdf } from "./born-digital-parser";
import {
  evaluatePdfLayoutAndQuality,
  type LayoutAnalysisResult,
} from "./layout-detector";

export type { DocumentAnalysisResult, PageAnalysis };
export {
  DocumentAnalysisSchema,
  ReferencesOnlySchema,
  MetadataOnlySchema,
} from "./schema";
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
export { evaluatePdfLayoutAndQuality, type LayoutAnalysisResult };

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references.
 *
 * - **Scanned / Image-based PDF:** Markdown extracted via Mistral OCR (R2 presigned URL → server-to-server fetch).
 *   Metadata and references are then extracted via Gemini Flash-Lite.
 * - **Multi-column / Corrupt OCR PDF:** Automatically detected and routed to Mistral OCR to prevent cross-column bleed.
 * - **Born-digital / Mixed PDF:** Text extracted locally via pdf-inspector (<100 ms).
 *   If extracted text is insufficient (<100 chars) and r2Key is present, seamlessly falls back to Mistral OCR.
 *   Metadata and references are extracted in parallel via Gemini Flash-Lite.
 *
 * @param pdfBuffer - Raw PDF file content buffer.
 * @param fileName - Original file name (used for logging and fallback title).
 * @param r2Key - R2 object key of the PDF. Required for scanned PDFs (Mistral OCR fetches from R2).
 *   Ignored for born-digital PDFs unless fallback to OCR is needed.
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
  const isImageOrScanned =
    inspection.pdfType === "Scanned" || inspection.pdfType === "ImageBased";

  if (isImageOrScanned) {
    logger?.info("pdf_parse_scanned_routed", {
      service: "pdf-parser",
      data: { fileName, pdfType: inspection.pdfType },
    });
    return parseScannedPdf(fileName, r2Key, options, logger);
  }

  // Pre-extract positioned text items to evaluate layout complexity and text layer quality.
  const positionedItems = extractPdfInspectorTextPositions(pdfBuffer);
  const layoutEvaluation = evaluatePdfLayoutAndQuality(positionedItems);

  // If the document has a complex multi-column layout (periodical/magazine) or corrupted
  // legacy OCR layer, route to layout-aware Vision OCR (Mistral OCR) to avoid cross-column bleed.
  if (layoutEvaluation.shouldRouteToMistralOcr && r2Key) {
    logger?.info("pdf_parse_complex_layout_routed_to_ocr", {
      service: "pdf-parser",
      data: {
        fileName,
        pdfType: inspection.pdfType,
        maxColumns: layoutEvaluation.metrics.maxColumns,
        multiColumnLineRatio: layoutEvaluation.metrics.multiColumnLineRatio,
        ocrArtifactRatePer1k: layoutEvaluation.metrics.ocrArtifactRatePer1k,
        reasons: layoutEvaluation.reasons,
      },
    });
    return parseScannedPdf(fileName, r2Key, options, logger);
  }

  const bornDigitalResult = await parseBornDigitalPdf(
    pdfBuffer,
    fileName,
    options,
    logger,
    positionedItems,
  );

  // Safety net: If born-digital extraction produced virtually no text (e.g. corrupt font/CMap or hidden scan)
  // and an R2 key is available for Mistral OCR, fall back to scanned OCR processing.
  const totalExtractedChars = bornDigitalResult.pages.reduce(
    (sum, p) => sum + p.markdownContent.trim().length,
    0,
  );

  if (totalExtractedChars < 100 && r2Key) {
    logger?.info("pdf_parse_insufficient_text_fallback_to_ocr", {
      service: "pdf-parser",
      data: {
        fileName,
        pdfType: inspection.pdfType,
        totalExtractedChars,
        pageCount: bornDigitalResult.pages.length,
      },
    });
    return parseScannedPdf(fileName, r2Key, options, logger);
  }

  return bornDigitalResult;
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

  return {
    chunks,
    references: analysis.references,
    metadata: analysis.metadata,
  };
}
