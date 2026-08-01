import "@/lib/polyfills/math-sum-precise";
import { getDocumentProxy } from "unpdf";
import type { Logger } from "@/lib/logger";
import type { DocumentChunk } from "@/lib/services/llamaparse";
import { buildLocalChunks } from "./chunker";

/**
 * Extracts raw text from a PDF buffer without layout analysis or font dependencies.
 * Used as a fast local fallback when layout analysis fails or crashes.
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

  const freshData = new Uint8Array(buffer);
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  let pageCount = 0;

  try {
    doc = await getDocumentProxy(freshData);
    pageCount = doc.numPages;
  } catch (err) {
    log.error("pdf_fast_fallback_local_doc_open_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName },
    });
    throw new Error(
      `Fast local fallback: PDF cannot be opened — ${(err as Error).message}`,
    );
  }

  const rawTexts: string[] = [];
  let failCount = 0;

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const rawPageItems: string[] = [];
      for (const it of textContent.items) {
        const maybe = it as Record<string, unknown>;
        if (typeof maybe.str === "string") {
          const s = (maybe.str as string).trim();
          if (s) rawPageItems.push(s);
        }
      }
      rawTexts.push(rawPageItems.join(" "));
    } catch {
      failCount++;
      rawTexts.push("");
    }
  }

  try {
    await (doc as unknown as { destroy: () => Promise<void> }).destroy();
  } catch {
    /* ignore */
  }

  const fullText = rawTexts.join("\n\n");
  const chunks = await buildLocalChunks(fullText);
  const totalDuration = performance.now() - fallbackStart;
  const totalTokens = chunks.reduce((s, c) => s + c.tokenCount, 0);

  log.info("pdf_fast_fallback_local_raw_extraction_success", {
    service: "pdf-parser",
    data: {
      fileName,
      pageCount,
      chunkCount: chunks.length,
      totalTokens,
      failedPages: failCount,
      durationMs: Math.round(totalDuration),
      source: "fast-local-fallback",
    },
  });

  return chunks;
}
