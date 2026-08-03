import type { Logger } from "@/lib/logger";
import { getPdfFromR2 } from "@/lib/services/r2";
import { parsePdfToChunks } from "@/lib/services/pdf-parser";
import type { DocumentAnalysisResult } from "@/lib/services/pdf-parser/schema";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import type { ParsedReference } from "@/db/schema";

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
 * Shared PDF ingestion prologue: fetches the uploaded file from its temporary R2 key, parses it via the Gemini PDF parser, and extracts structured metadata and references.
 *
 * @param tempKey - Temporary R2 key where the client uploaded the PDF.
 * @param originalFileName - Original file name.
 * @param log - Logger instance.
 * @returns The PDF buffer, parsed chunks, parsed references, and extracted metadata.
 */
export async function fetchAndExtractPdf(
  tempKey: string,
  originalFileName: string,
  log: Logger,
): Promise<ExtractedPdfContent> {
  log.info("pdf_fetch_from_r2_start", {
    service: "library",
    data: { summary: "R2'den PDF alınıyor", tempKey },
  });
  const buffer = await getPdfFromR2(tempKey);
  log.info("pdf_fetch_from_r2_success", {
    service: "library",
    data: { tempKey, size: buffer.length },
  });

  const { chunks, references, metadata } = await parsePdfToChunks(
    buffer,
    originalFileName,
    log,
  );

  const parsedReferences: ParsedReference[] = references.map((ref) => ({
    raw: ref.raw,
    title: ref.title ?? null,
    authors: ref.authors ?? [],
    year: ref.year ?? null,
    journal: null,
    resolved: Boolean(ref.title),
  }));

  return { buffer, chunks, parsedReferences, metadata };
}
