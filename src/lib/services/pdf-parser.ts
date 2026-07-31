import type { Logger } from "@/lib/logger";
import { parsePdfWithLlamaParse, type DocumentChunk } from "./llamaparse";
import { buildLocalChunks } from "./pdf/chunker";
import { extractRawTextFast } from "./pdf/fast-extractor";
import { analyzePdfLayout } from "./pdf/layout-sampling";
import type { PdfLayoutAnalysis } from "./pdf/types";

export type { DocumentChunk };
export type { PdfLayoutAnalysis };

/**
 * Parses a PDF buffer using a smart hybrid router with 20-page sampling for layout analysis:
 *
 * **Layer 1 — 20-Page Layout Sampling:** Samples the first 20 pages (1..min(20, N))
 * to detect single-column vs multi-column/scanned layouts in ~700ms.
 * - Single/Multi-column text → fast local extraction with N-column clustering (<200ms).
 *
 * **Layer 2 — LlamaParse API:** Triggers automatically for:
 * 1) Genuinely scanned / image-based PDFs (avgCharsPerPage < 50).
 * 2) Severely broken/chaotic layouts (scatter ratio > 50%).
 *
 * **Layer 3 — Fast Local Fallback:** If layout analysis fails (font crash, memory issue),
 * extracts raw text locally without layout analysis.
 *
 * @param buffer - Raw PDF file buffer
 * @param fileName - Original PDF file name (for logging / LlamaParse fallback)
 * @param log - Logger instance for structured logging
 * @returns Array of structured document chunks
 */
export async function parsePdfWithHybridRouter(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<DocumentChunk[]> {
  // ── 1. Layout Analysis (20-Page Sampling) ──
  log.info("pdf_hybrid_layout_analysis_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length },
  });

  const analysisStart = performance.now();
  let analysis: PdfLayoutAnalysis;

  try {
    analysis = await analyzePdfLayout(buffer);
  } catch (err) {
    log.error("pdf_hybrid_layout_analysis_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName, bufferSize: buffer.length },
    });

    return extractRawTextFast(buffer, fileName, log);
  }

  const analysisDuration = performance.now() - analysisStart;

  log.info("pdf_hybrid_layout_analysis_success", {
    service: "pdf-parser",
    data: {
      fileName,
      route: analysis.route,
      reason: analysis.reason,
      pageCount: analysis.pageCount,
      sampledPageCount: analysis.sampledPageCount,
      totalChars: analysis.totalChars,
      avgCharsPerPage: Math.round(analysis.avgCharsPerPage),
      isScanned: analysis.isScanned,
      isMultiColumn: analysis.isMultiColumn,
      hasComplexLayout: analysis.hasComplexLayout,
      multiColPageCount: analysis.multiColPageIndices.length,
      multiColPages: analysis.multiColPageIndices,
      scatterPageCount: analysis.scatterPageIndices.length,
      scatterPages: analysis.scatterPageIndices,
      analysisDurationMs: Math.round(analysisDuration),
    },
  });

  // ── 2. Route Decision ──
  if (analysis.route === "unstructured-fallback") {
    try {
      const llamaChunks = await parsePdfWithLlamaParse(buffer, fileName, log);
      return llamaChunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        pdfPageNumber: c.pdfPageNumber,
        printedPageNumber: c.printedPageNumber,
        sectionTitle: c.sectionTitle,
        content: c.content,
        parentContent: c.parentContent,
        tokenCount: c.tokenCount,
      }));
    } catch (llamaErr) {
      log.error("pdf_llamaparse_fallback_failed", {
        service: "pdf-parser",
        error: llamaErr,
        data: { fileName },
      });
      // Fallback to local raw text if LlamaParse fails or has network timeout
      return extractRawTextFast(buffer, fileName, log);
    }
  }

  // ── 3. Local Fast Path ──
  log.info("pdf_local_extraction_start", {
    service: "pdf-parser",
    data: {
      fileName,
      pageCount: analysis.pageCount,
      totalChars: analysis.totalChars,
    },
  });

  const localStart = performance.now();
  const chunks = buildLocalChunks(analysis.fullText);
  const localDuration = performance.now() - localStart;

  log.info("pdf_local_extraction_success", {
    service: "pdf-parser",
    data: {
      fileName,
      route: "local",
      pageCount: analysis.pageCount,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
      extractionDurationMs: Math.round(localDuration),
      analysisDurationMs: Math.round(analysisDuration),
      totalDurationMs: Math.round(analysisDuration + localDuration),
    },
  });

  return chunks;
}
