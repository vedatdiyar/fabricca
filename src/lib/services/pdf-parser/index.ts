import { GoogleGenAI } from "@google/genai";
import { withRetry, HttpError } from "@/lib/api-utils";
import type { Logger } from "@/lib/logger";
import { sanitizeAndParseJson } from "@/lib/services/gemini";
import { buildChunksFromPageAnalysis } from "@/lib/services/pdf/chunker";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import {
  loadPdfSource,
  getPdfPageCount,
  extractBatchFromDoc,
} from "./splitter";
import {
  DocumentAnalysisSchema,
  type DocumentAnalysisResult,
  type PageAnalysis,
} from "./schema";

export type { DocumentAnalysisResult, PageAnalysis };
export { DocumentAnalysisSchema } from "./schema";
export {
  loadPdfSource,
  getPdfPageCount,
  extractBatchFromDoc,
} from "./splitter";

const PDF_PARSER_MODEL = "gemini-3.1-flash-lite" as const;
const BATCH_SIZE = 5;

const SYSTEM_INSTRUCTION = `You are an expert academic PDF parser. Analyze the provided PDF pages and return structured output.

RULES:
1. METADATA: Extract title, authors, publication year, publisher, and DOI from the first pages.
2. MARKDOWN: Convert each page to clean markdown. Preserve:
   - Heading hierarchy: H1 (#), H2 (##), H3 (###)
   - If a page starts with a sub-heading and the parent heading was on the previous page,
     maintain its semantic level (## or ###) — do not reset to #.
   - Numbered/bulleted lists, tables (pipe-delimited), inline emphasis.
   - Mathematical notation in standard text.
3. FOOTNOTES: Inline footnotes at the end of the relevant paragraph as [^n].
4. REFERENCES: Parse the bibliography section. Each reference as a separate object with raw text, and optionally extracted title, authors, year.
5. Do NOT hallucinate content. Return in the SAME LANGUAGE as the source.
6. Strip running headers, footers, standalone page numbers.`;

let pdfParserClient: GoogleGenAI | null = null;

/**
 * Returns a lazily-initialized GoogleGenAI client for the PDF parser using a dedicated API key.
 *
 * @returns The shared PDF parser GoogleGenAI instance.
 */
function getPdfParserClient(): GoogleGenAI {
  if (!pdfParserClient) {
    const apiKey = process.env.PDF_PARSER_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PDF_PARSER_GEMINI_API_KEY environment variable is not defined.",
      );
    }
    pdfParserClient = new GoogleGenAI({ apiKey });
  }
  return pdfParserClient;
}

/**
 * Parses a batch of PDF pages via Gemini structured output.
 *
 * @param base64Data - Base64-encoded mini-PDF string for the batch.
 * @param startPage - 1-based start page number of this batch in the original document.
 * @param batchPageCount - Number of pages in this batch.
 * @param isLastBatch - Whether this is the final batch (used to request metadata + references only once).
 * @param logger - Optional logger instance.
 * @returns Parsed batch result with pages, and optionally metadata and references.
 */
async function parseBatch(
  base64Data: string,
  startPage: number,
  batchPageCount: number,
  isLastBatch: boolean,
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const endPage = startPage + batchPageCount - 1;
  const prompt = `Analyze pages ${startPage} to ${endPage} of the provided PDF document.${isLastBatch ? " Return metadata, page analyses, and all references found in the document." : " Return page analyses and any references found on these pages."}`;

  const payload = {
    model: PDF_PARSER_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: DocumentAnalysisSchema,
      temperature: 0,
    },
  };

  const response = await withRetry(
    async () => {
      const res = await getPdfParserClient().models.generateContent(payload);
      return res;
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      isRetryable: (error) => {
        if (error instanceof HttpError) {
          return error.status === 429 || error.status >= 500;
        }
        if (error instanceof Error) {
          return (
            error.message.includes("429") ||
            error.message.includes("503") ||
            error.message.includes("UNAVAILABLE")
          );
        }
        return false;
      },
      onRetry: (attempt, delay, error) => {
        const status =
          error instanceof HttpError ? `${error.status}` : "unknown";
        logger?.info("pdf_parser_gemini_retry", {
          service: "pdf-parser",
          data: {
            attempt,
            delayMs: Math.round(delay),
            status,
            pages: `${startPage}-${endPage}`,
          },
        });
      },
    },
  );

  const text = response.text;
  if (!text) {
    throw new Error(
      `Gemini boş yanıt döndürdü. Sayfa aralığı: ${startPage}-${endPage}`,
    );
  }

  const parsed = sanitizeAndParseJson<DocumentAnalysisResult>(text);
  return parsed;
}

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references via Gemini batch processing.
 *
 * @param pdfBuffer - The raw PDF file content.
 * @param fileName - Original file name (used for logging).
 * @param startPage - 1-based inclusive start page (default: 1).
 * @param endPage - 1-based inclusive end page (default: last page).
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult with metadata from first batch, all pages, and all references.
 */
export async function parsePdfToDocumentAnalysis(
  pdfBuffer: Buffer,
  fileName: string,
  startPage: number = 1,
  endPage?: number,
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const pipelineStart = performance.now();

  const loadedDoc = await loadPdfSource(pdfBuffer);
  const totalPages = getPdfPageCount(loadedDoc);
  const safeEnd = endPage ?? totalPages;

  logger?.info("pdf_parser_gemini_start", {
    service: "pdf-parser",
    data: {
      totalPages,
      startPage,
      endPage: safeEnd,
      bufferSize: pdfBuffer.length,
    },
  });

  let metadata: DocumentAnalysisResult["metadata"] | null = null;
  const allPages: PageAnalysis[] = [];
  const allReferences: DocumentAnalysisResult["references"] = [];

  let currentStart = Math.max(1, startPage);
  let batchIndex = 0;
  const totalBatches = Math.ceil((safeEnd - currentStart + 1) / BATCH_SIZE);

  while (currentStart <= safeEnd) {
    const currentEnd = Math.min(currentStart + BATCH_SIZE - 1, safeEnd);
    const batchPageCount = currentEnd - currentStart + 1;
    const isLastBatch = batchIndex === totalBatches - 1;

    logger?.info("pdf_parser_batch_start", {
      service: "pdf-parser",
      data: {
        batchStart: currentStart,
        batchEnd: currentEnd,
        batchPageCount,
      },
    });

    let batchBuffer: Buffer | null = await extractBatchFromDoc(
      loadedDoc,
      currentStart,
      currentEnd,
    );
    let base64Data = batchBuffer.toString("base64");
    batchBuffer = null;

    const batchResult = await parseBatch(
      base64Data,
      currentStart,
      batchPageCount,
      isLastBatch,
      logger,
    );
    base64Data = "";

    // Merge metadata from the first batch that provides it
    if (!metadata && batchResult.metadata) {
      metadata = batchResult.metadata;
    }

    // Merge pages
    allPages.push(...batchResult.pages);

    // Merge references from all batches
    if (batchResult.references?.length) {
      allReferences.push(...batchResult.references);
    }

    logger?.info("pdf_parser_batch_success", {
      service: "pdf-parser",
      data: {
        batchStart: currentStart,
        batchEnd: currentEnd,
        pagesReturned: batchResult.pages.length,
        referencesReturned: batchResult.references?.length ?? 0,
      },
    });

    currentStart = currentEnd + 1;
    batchIndex++;
  }

  allPages.sort((a, b) => a.pageNumber - b.pageNumber);

  // Fallback metadata if Gemini didn't extract it
  if (!metadata) {
    metadata = {
      title: fileName.replace(/\.pdf$/i, ""),
      authors: [],
    };
  }

  const totalDurationMs = Math.round(performance.now() - pipelineStart);

  logger?.info("pdf_parser_gemini_success", {
    service: "pdf-parser",
    durationMs: totalDurationMs,
    data: {
      totalPages,
      pagesParsed: allPages.length,
      referencesParsed: allReferences.length,
      metadataTitle: metadata.title,
    },
  });

  return {
    metadata,
    pages: allPages,
    references: allReferences,
  };
}

/** Result shape for the high-level parsePdfToChunks adapter. */
export interface PdfChunkParseResult {
  chunks: DocumentChunk[];
  references: DocumentAnalysisResult["references"];
  metadata: DocumentAnalysisResult["metadata"];
}

/**
 * Higher-level adapter: parses a PDF via Gemini, builds RAG chunks with stateful header tracking.
 *
 * @param pdfBuffer - The raw PDF file content.
 * @param fileName - Original file name (used for logging).
 * @param logger - Optional logger instance.
 * @returns Chunks, parsed references, and extracted metadata.
 */
export async function parsePdfToChunks(
  pdfBuffer: Buffer,
  fileName: string,
  logger?: Logger,
): Promise<PdfChunkParseResult> {
  const analysis = await parsePdfToDocumentAnalysis(
    pdfBuffer,
    fileName,
    1,
    undefined,
    logger,
  );

  const chunks = await buildChunksFromPageAnalysis(analysis.pages);

  logger?.info("pdf_parse_to_chunks_success", {
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
