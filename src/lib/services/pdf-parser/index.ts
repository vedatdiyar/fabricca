import { GoogleGenAI } from "@google/genai";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { Logger } from "@/lib/logger";
import { sanitizeAndParseJson } from "@/lib/services/gemini";
import { GEMINI_SEED } from "@/lib/constants";
import { buildChunksFromPageAnalysis } from "@/lib/services/pdf/chunker";
import type { DocumentChunk } from "@/lib/services/pdf/chunker";
import { PDF_PARSER_SYSTEM_INSTRUCTION } from "@/lib/prompts";
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
/**
 * All batches are fired concurrently up to this limit.
 * 429 responses carry a `retryDelay` that pauses the entire gate, so we can
 * safely use the full RPM headroom without a conservative fixed concurrency.
 */
const PDF_PARSE_CONCURRENCY = 15;

/**
 * A shared pause gate used by all concurrent batch workers for a single PDF parse run.
 * When any worker encounters a 429, it sets the gate so every other worker waits
 * for the server-specified `retryDelay` before dispatching the next request.
 */
interface PauseGate {
  /** Resolves immediately when no pause is active; blocks while a 429 pause is in effect. */
  wait(): Promise<void>;
  /** Activates a pause for `ms` milliseconds. Subsequent calls extend the pause if longer. */
  pause(ms: number): void;
}

/**
 * Creates a shared pause gate for coordinating 429 backoff across concurrent workers.
 *
 * @returns A PauseGate instance.
 */
function createPauseGate(): PauseGate {
  let pauseUntil = 0;
  let gatePromise: Promise<void> | null = null;

  return {
    wait(): Promise<void> {
      if (gatePromise) return gatePromise;
      const remaining = pauseUntil - Date.now();
      if (remaining > 0) {
        gatePromise = new Promise((resolve) =>
          setTimeout(() => {
            gatePromise = null;
            resolve();
          }, remaining),
        );
        return gatePromise;
      }
      return Promise.resolve();
    },

    pause(ms: number): void {
      const until = Date.now() + ms;
      if (until > pauseUntil) {
        pauseUntil = until;
        gatePromise = null; // reset so next wait() re-reads the updated pauseUntil
      }
    },
  };
}

/**
 * Parses Gemini's `retryDelay` from a 429 error response body.
 * The value is embedded in `error.details[]` under `type.googleapis.com/google.rpc.RetryInfo`
 * as a string like `"42s"`.
 *
 * @param error - The caught error from the Gemini SDK.
 * @returns Delay in milliseconds, or null when not present.
 */
function parseRetryDelayMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;

  // The SDK surfaces the raw JSON body in error.message for 429s.
  // Attempt to extract retryDelay from the structured details array.
  try {
    const bodyMatch = error.message.match(/\{[\s\S]*\}/);
    if (!bodyMatch) return null;
    const body = JSON.parse(bodyMatch[0]) as {
      error?: {
        details?: Array<Record<string, unknown>>;
      };
    };
    const details = body?.error?.details ?? [];
    for (const detail of details) {
      if (
        detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo" &&
        typeof detail["retryDelay"] === "string"
      ) {
        const match = (detail["retryDelay"] as string).match(/^(\d+)s$/);
        if (match) return parseInt(match[1], 10) * 1000;
      }
    }
  } catch {
    // Body was not JSON — fall through
  }

  return null;
}

/** Per-batch parse diagnostics collected for tuning and observability. */
export interface PdfBatchMetric {
  /** 1-based inclusive start page of the batch. */
  startPage: number;
  /** 1-based inclusive end page of the batch. */
  endPage: number;
  /** Wall-clock latency of the batch, in milliseconds. */
  durationMs: number;
  /** Total number of Gemini attempts (1 + retries) for the batch. */
  attempts: number;
  /** Prompt (input) token count reported by the model, when available. */
  inputTokens?: number;
  /** Candidate (output) token count reported by the model, when available. */
  outputTokens?: number;
  /** Total token count reported by the model, when available. */
  totalTokens?: number;
  /** Raw finishReason reported by the model, when available. */
  finishReason?: string;
}

/** Tunable options for the PDF parsing driver. All fields are optional and fall back to production defaults. */
export interface PdfParseOptions {
  /** 1-based inclusive start page (default: 1). */
  startPage?: number;
  /** 1-based inclusive end page (default: last page). */
  endPage?: number;
  /** Number of pages submitted per Gemini request (default: BATCH_SIZE). */
  batchSize?: number;
  /** Maximum concurrent in-flight Gemini requests (default: PDF_PARSE_CONCURRENCY). */
  concurrency?: number;
  /** When provided, the driver appends one entry per completed batch. */
  metrics?: PdfBatchMetric[];
}

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
 * On 429, activates the shared pause gate for the server-specified `retryDelay`
 * so all concurrent sibling batches also wait before their next dispatch.
 *
 * @param base64Data - Base64-encoded mini-PDF string for the batch.
 * @param startPage - 1-based start page number of this batch in the original document.
 * @param batchPageCount - Number of pages in this batch.
 * @param isFirstBatch - Whether this is the first batch of the document (metadata is requested only here).
 * @param gate - Shared pause gate coordinating 429 backoff across all concurrent batches.
 * @param onMetric - Callback invoked with per-batch diagnostics.
 * @param logger - Optional logger instance.
 * @returns Parsed batch result with pages, and references found on these pages.
 */
async function parseBatch(
  base64Data: string,
  startPage: number,
  batchPageCount: number,
  isFirstBatch: boolean,
  gate: PauseGate,
  onMetric: (m: Omit<PdfBatchMetric, "startPage" | "endPage">) => void,
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const endPage = startPage + batchPageCount - 1;
  const batchStart = performance.now();
  const metadataClause = isFirstBatch
    ? "Fill the metadata object with the document's title and authors (plus optional publicationYear, publisher, and DOI). "
    : "";
  const prompt = `The provided PDF contains ${batchPageCount} pages (original document pages ${startPage}-${endPage}). Analyze every page without skipping any. ${metadataClause}Return one page analysis per page, in reading order, with pageNumber starting at 1 for the first page of the provided PDF. Return every bibliography (references) entry that appears on these pages.`;

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
      systemInstruction: PDF_PARSER_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: DocumentAnalysisSchema,
      seed: GEMINI_SEED,
    },
  };

  const MAX_ATTEMPTS = 5;
  let attempts = 0;

  while (true) {
    // Honour any active global pause before dispatching.
    await gate.wait();

    attempts++;
    try {
      const response =
        await getPdfParserClient().models.generateContent(payload);

      const text = response.text;
      if (!text) {
        throw new Error(
          `Gemini boş yanıt döndürdü. Sayfa aralığı: ${startPage}-${endPage}`,
        );
      }

      const usageMetadata = (
        response as unknown as {
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }
      )?.usageMetadata;

      const finishReason =
        (
          response as unknown as {
            candidates?: Array<{ finishReason?: string }>;
          }
        )?.candidates?.[0]?.finishReason ?? undefined;

      onMetric({
        durationMs: Math.round(performance.now() - batchStart),
        attempts,
        inputTokens: usageMetadata?.promptTokenCount,
        outputTokens: usageMetadata?.candidatesTokenCount,
        totalTokens: usageMetadata?.totalTokenCount,
        finishReason,
      });

      return sanitizeAndParseJson<DocumentAnalysisResult>(text);
    } catch (error) {
      const is429 =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("RESOURCE_EXHAUSTED"));
      const is5xx =
        error instanceof Error &&
        (error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("500"));

      if ((is429 || is5xx) && attempts < MAX_ATTEMPTS) {
        if (is429) {
          // Parse Gemini's server-side retryDelay and pause all workers for exactly that long.
          const retryDelayMs = parseRetryDelayMs(error) ?? 30_000;
          gate.pause(retryDelayMs);
          logger?.info("pdf_parser_gemini_rate_limit", {
            service: "pdf-parser",
            data: {
              pages: `${startPage}-${endPage}`,
              attempt: attempts,
              pauseMs: retryDelayMs,
            },
          });
        } else {
          // 5xx: short fixed wait without touching the global gate.
          await new Promise((r) => setTimeout(r, 2_000 * attempts));
        }
        continue;
      }

      throw error;
    }
  }
}

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references via Gemini batch processing.
 *
 * Metadata is requested only from the first batch; every batch extracts only the bibliography entries on its own
 * pages. Batches are submitted with bounded concurrency (see `PDF_PARSE_CONCURRENCY`). Page numbers are re-mapped
 * from batch-relative (1..N) back to original document pages, duplicates are dropped, and a coverage guard throws
 * if any page in the requested range is missing. References are deduplicated by raw text and sorted alphabetically,
 * so the result order stays deterministic regardless of batch completion order.
 *
 * @param pdfBuffer - The raw PDF file content.
 * @param fileName - Original file name (used for logging).
 * @param options - Optional driver settings (page range, batch size, concurrency, metric collector).
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult with metadata from the first valid batch, all pages, and deduplicated references.
 */
export async function parsePdfToDocumentAnalysis(
  pdfBuffer: Buffer,
  fileName: string,
  options: PdfParseOptions = {},
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const pipelineStart = performance.now();
  const {
    batchSize = BATCH_SIZE,
    concurrency = PDF_PARSE_CONCURRENCY,
    metrics,
  } = options;

  const loadedDoc = await loadPdfSource(pdfBuffer);
  const totalPages = getPdfPageCount(loadedDoc);
  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? totalPages;
  const totalBatches = Math.ceil((safeEnd - firstStart + 1) / batchSize);

  logger?.info("pdf_parser_gemini_start", {
    service: "pdf-parser",
    data: {
      summary: `${totalBatches} batch, ${totalPages} sayfa`,
      totalPages,
      startPage: firstStart,
      endPage: safeEnd,
      batchSize,
      concurrency,
      bufferSize: pdfBuffer.length,
    },
  });

  const batches = Array.from({ length: totalBatches }, (_, batchIndex) => {
    const currentStart = firstStart + batchIndex * batchSize;
    const currentEnd = Math.min(currentStart + batchSize - 1, safeEnd);
    return {
      startPage: currentStart,
      endPage: currentEnd,
      batchPageCount: currentEnd - currentStart + 1,
      isFirstBatch: batchIndex === 0,
    };
  });

  const limiter = createConcurrencyLimiter(concurrency);
  const gate = createPauseGate();

  const batchResults = await Promise.all(
    batches.map((batch) =>
      limiter.exec(async () => {
        const batchBuffer = await extractBatchFromDoc(
          loadedDoc,
          batch.startPage,
          batch.endPage,
        );
        const base64Data = batchBuffer.toString("base64");

        const result = await parseBatch(
          base64Data,
          batch.startPage,
          batch.batchPageCount,
          batch.isFirstBatch,
          gate,
          (metric) => {
            metrics?.push({
              startPage: batch.startPage,
              endPage: batch.endPage,
              ...metric,
            });
          },
          logger,
        );

        return result;
      }),
    ),
  );

  let metadata: DocumentAnalysisResult["metadata"] | null = null;
  const pageMap = new Map<number, PageAnalysis>();
  const referenceMap = new Map<
    string,
    DocumentAnalysisResult["references"][number]
  >();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchResult = batchResults[batchIndex];

    // Metadata is guaranteed to come only from the first batch that provides a valid one.
    if (!metadata && batchResult.metadata?.title) {
      metadata = batchResult.metadata;
    }

    if (batchResult.pages.length !== batch.batchPageCount) {
      logger?.info("pdf_parser_batch_page_count_mismatch", {
        service: "pdf-parser",
        data: {
          expectedPages: batch.batchPageCount,
          returnedPages: batchResult.pages.length,
          pages: `${batch.startPage}-${batch.endPage}`,
        },
      });
    }

    // Re-map batch-relative page numbers (1..N inside the mini-PDF) back to original document pages.
    for (const page of batchResult.pages) {
      const originalPage = batch.startPage + page.pageNumber - 1;
      if (!pageMap.has(originalPage)) {
        pageMap.set(originalPage, { ...page, pageNumber: originalPage });
      }
    }

    for (const ref of batchResult.references ?? []) {
      const key = ref.raw.trim();
      if (key && !referenceMap.has(key)) {
        referenceMap.set(key, ref);
      }
    }
  }

  // Page-loss guard: every page in the requested range must have been analyzed exactly once.
  const expectedPages = Array.from(
    { length: safeEnd - firstStart + 1 },
    (_, i) => firstStart + i,
  );
  const missingPages = expectedPages.filter((page) => !pageMap.has(page));
  if (missingPages.length > 0) {
    logger?.info("pdf_parser_missing_pages", {
      service: "pdf-parser",
      data: { missingPages, startPage: firstStart, endPage: safeEnd },
    });
    throw new Error(
      `PDF parsing dropped ${missingPages.length} page(s): ${missingPages.join(", ")}.`,
    );
  }

  const allPages = Array.from(pageMap.values()).sort(
    (a, b) => a.pageNumber - b.pageNumber,
  );
  const allReferences = Array.from(referenceMap.values()).sort((a, b) =>
    a.raw.localeCompare(b.raw),
  );

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
  logger?.info("pdf_parse_to_chunks_start", {
    service: "pdf-parser",
    data: { fileName },
  });

  const analysis = await parsePdfToDocumentAnalysis(
    pdfBuffer,
    fileName,
    {},
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
