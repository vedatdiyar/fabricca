import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import type { DocumentAnalysisResult } from "./schema";

/** Tunable options for the PDF parsing driver. */
export interface PdfParseOptions {
  /** 1-based inclusive start page (default: 1). */
  startPage?: number;
  /** 1-based inclusive end page (default: last page). */
  endPage?: number;
}

/** Result shape for the high-level parsePdfToChunks adapter. */
export interface PdfChunkParseResult {
  chunks: DocumentChunk[];
  references: DocumentAnalysisResult["references"];
  metadata: DocumentAnalysisResult["metadata"];
}
