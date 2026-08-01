import "@/lib/polyfills/math-sum-precise";
import pdf2md from "@opendocsg/pdf2md";
import type { Logger } from "@/lib/logger";
import type { DocumentChunk } from "@/lib/services/llamaparse";
import { buildLocalChunks } from "./chunker";
import { normalizeTurkishText } from "./turkish-normalizer";

/**
 * Extracts rich Markdown text from a PDF buffer using pdf2md + Turkish character normalization.
 * Used for local single-column text extraction and fast fallback when LlamaParse is not required.
 *
 * @param buffer - Raw PDF file buffer
 * @param fileName - Original PDF file name (for logging)
 * @param log - Logger instance for structured logging
 * @returns Array of structured document chunks
 */
export async function extractRawTextFast(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<DocumentChunk[]> {
  log.info("pdf_fast_fallback_local_raw_extraction_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length },
  });

  const fallbackStart = performance.now();
  let markdownText = "";

  try {
    const rawMd = await pdf2md(new Uint8Array(buffer));
    markdownText = normalizeTurkishText(rawMd);
  } catch (err) {
    log.error("pdf_fast_fallback_pdf2md_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName },
    });
    throw new Error(`Fast local extraction failed: ${(err as Error).message}`);
  }

  const chunks = await buildLocalChunks(markdownText);
  const totalDuration = performance.now() - fallbackStart;
  const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0);

  log.info("pdf_fast_fallback_local_raw_extraction_success", {
    service: "pdf-parser",
    data: {
      fileName,
      chunkCount: chunks.length,
      totalTokens,
      durationMs: Math.round(totalDuration),
      source: "fast-local-pdf2md",
    },
  });

  return chunks;
}
