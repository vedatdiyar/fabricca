import type { Logger } from "@/lib/logger";
import { getPdfFromR2 } from "@/core/services/storage/r2";
import { parsePdfToChunks } from "@/core/services/pdf";
import type { DocumentAnalysisResult } from "@/core/services/pdf/schema";
import type { DocumentChunk } from "@/core/services/pdf/chunker";
import type { ParsedReference } from "@/core/db/schema";

/** Extracted PDF content shared by all upload completion flows. */
export interface ExtractedPdfContent {
  /** Raw PDF bytes fetched from the temporary R2 key. */
  buffer: Buffer;
  /** Parsed text chunks produced by the Gemini PDF parser. */
  chunks: DocumentChunk[];
  /** Parsed references extracted by Gemini. */
  parsedReferences: ParsedReference[];
  /** Extracted bibliographic metadata. */
  metadata: DocumentAnalysisResult["metadata"];
}

/**
 * Shared PDF ingestion prologue: fetches the uploaded file from its temporary R2 key,
 * parses it via pdf-inspector (born-digital) or Mistral OCR (scanned), and extracts
 * structured metadata and references.
 *
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name.
 * @param log - Logger instance.
 * @param preloadedBuffer - Optional pre-fetched PDF buffer (skips R2 read when provided).
 * @returns The PDF buffer, parsed chunks, parsed references, and extracted metadata.
 */
export async function fetchAndExtractPdf(
  tempKey: string,
  originalFileName: string,
  log: Logger,
  preloadedBuffer?: Buffer,
): Promise<ExtractedPdfContent> {
  let buffer: Buffer;

  if (preloadedBuffer) {
    buffer = preloadedBuffer;
    log.info("pdf_buffer_preloaded_skip_r2_fetch", {
      service: "library",
      data: { tempKey, size: buffer.length },
    });
  } else {
    log.info("pdf_fetch_from_r2_start", {
      service: "library",
      data: { tempKey },
    });
    buffer = await getPdfFromR2(tempKey);
    log.info("pdf_fetch_from_r2_success", {
      service: "library",
      data: { tempKey, size: buffer.length },
    });
  }

  // tempKey is always used for Mistral OCR presigned URL (file is in R2 regardless of read path).
  const { chunks, references, metadata } = await parsePdfToChunks(
    buffer,
    originalFileName,
    tempKey,
    log,
  );

  const parsedReferences: ParsedReference[] = references.map((ref) => ({
    raw: ref.raw,
    documentType: ref.documentType ?? null,
    title: ref.title ?? null,
    containerTitle: ref.containerTitle ?? null,
    authors: ref.authors ?? [],
    year: ref.year ?? null,
    publisher: ref.publisher ?? null,
    publisherPlace: ref.publisherPlace ?? null,
    resolved: Boolean(ref.title ?? ref.year ?? ref.containerTitle),
  }));

  return { buffer, chunks, parsedReferences, metadata };
}
