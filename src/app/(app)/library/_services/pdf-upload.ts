import type { Logger } from "@/lib/logger";
import { getPdfFromR2 } from "@/lib/services/r2";
import { extractPdfMetadata } from "@/lib/services/pdf-metadata";
import type { PdfMetadataResult } from "@/lib/services/pdf-metadata";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { parsePdfWithHybridRouter } from "@/lib/services/pdf-parser";
import type { DocumentChunk } from "@/lib/services/llamaparse";

/** Extracted PDF content shared by all upload completion flows. */
export interface ExtractedPdfContent {
  /** Raw PDF bytes fetched from the temporary R2 key. */
  buffer: Buffer;
  /** Parsed text chunks produced by the hybrid router. */
  chunks: DocumentChunk[];
  /** Extracted (and sanitized) bibliographic metadata. */
  metadata: PdfMetadataResult;
}

/**
 * Shared PDF ingestion prologue: fetches the uploaded file from its temporary
 * R2 key, parses it via the hybrid router, extracts bibliographic metadata and
 * sanitizes it (Cerebras output is already clean and is skipped).
 *
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name (used by parser/metadata fallbacks).
 * @param log - Logger instance for the current flow.
 * @returns The PDF buffer, parsed chunks and sanitized metadata.
 */
export async function fetchAndExtractPdf(
  tempKey: string,
  originalFileName: string,
  log: Logger,
): Promise<ExtractedPdfContent> {
  log.info("pdf_fetch_from_r2_start", {
    service: "library",
    data: { tempKey },
  });
  const buffer = await getPdfFromR2(tempKey);
  log.info("pdf_fetch_from_r2_success", {
    service: "library",
    data: { tempKey, size: buffer.length },
  });

  const chunks = await parsePdfWithHybridRouter(buffer, originalFileName, log);

  const metadata = await extractPdfMetadata(chunks, originalFileName, log);

  if (metadata.source !== "cerebras") {
    const [sanitizedMeta] = await sanitizeAcademicDataBulk(
      [{ title: metadata.title, author: metadata.authors.join(", ") }],
      log,
    );
    metadata.title = sanitizedMeta.title;
    metadata.authors = sanitizedMeta.author.split(", ").filter(Boolean);
  }

  return { buffer, chunks, metadata };
}
