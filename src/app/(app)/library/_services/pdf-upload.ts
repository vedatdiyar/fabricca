import type { Logger } from "@/lib/logger";
import { getPdfFromR2 } from "@/lib/services/r2";
import { extractPdfMetadata } from "@/lib/services/pdf-metadata";
import type { PdfMetadataResult } from "@/lib/services/pdf-metadata";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { parsePdfDocument } from "@/lib/services/pdf-parser";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";

/** Extracted PDF content shared by all upload completion flows. */
export interface ExtractedPdfContent {
  /** Raw PDF bytes fetched from the temporary R2 key. */
  buffer: Buffer;
  /** Parsed text chunks produced by LlamaParse v2. */
  chunks: DocumentChunk[];
  /** Optional raw references section text. */
  rawReferences: string | null;
  /** Extracted (and sanitized) bibliographic metadata. */
  metadata: PdfMetadataResult;
}

/**
 * Shared PDF ingestion prologue: fetches the uploaded file from its temporary R2 key, parses it via LlamaParse v2 cloud API, extracts bibliographic metadata and sanitizes it.
 *
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name.
 * @param log - Logger instance.
 * @returns The PDF buffer, parsed chunks, rawReferences, and sanitized metadata.
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

  const { chunks, rawReferences } = await parsePdfDocument(
    buffer,
    originalFileName,
    log,
  );

  const metadata = await extractPdfMetadata(chunks, originalFileName, log);

  if (metadata.source !== "cerebras") {
    const [sanitizedMeta] = await sanitizeAcademicDataBulk(
      [{ title: metadata.title, author: metadata.authors.join(", ") }],
      log,
    );
    metadata.title = sanitizedMeta.title;
    metadata.authors = sanitizedMeta.author.split(", ").filter(Boolean);
  }

  return { buffer, chunks, rawReferences, metadata };
}
