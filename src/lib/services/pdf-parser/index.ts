import { GoogleGenAI } from "@google/genai";
import {
  processPdf as processPdfInspector,
  extractPagesMarkdown as extractPdfInspectorPages,
} from "@firecrawl/pdf-inspector";
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
 * A shared pause gate used by a worker for Gemini requests.
 * When a worker encounters a 429, it sets the gate so subsequent requests wait
 * for the server-specified `retryDelay` before dispatching.
 */
interface PauseGate {
  /** Resolves immediately when no pause is active; blocks while a 429 pause is in effect. */
  wait(): Promise<void>;
  /** Activates a pause for `ms` milliseconds. Subsequent calls extend the pause if longer. */
  pause(ms: number): void;
  /** Returns true if the gate is currently unpaused and ready. */
  isReady(): boolean;
  /** Returns the timestamp in ms until which this gate is paused. */
  getPauseUntil(): number;
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

    isReady(): boolean {
      return Date.now() >= pauseUntil;
    },

    getPauseUntil(): number {
      return pauseUntil;
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
  /** Maximum concurrent in-flight Gemini requests (default: pool size x 15). */
  concurrency?: number;
  /** When provided, the driver appends one entry per completed batch. */
  metrics?: PdfBatchMetric[];
}

interface KeyWorker {
  keyIndex: number;
  apiKey: string;
  client: GoogleGenAI;
  gate: PauseGate;
}

/**
 * Resolves all configured Gemini API keys for PDF parsing from environment variables.
 * Supports `PDF_PARSER_GEMINI_API_KEY`, `PDF_PARSER_GEMINI_API_KEY_1`, `PDF_PARSER_GEMINI_API_KEY_2`, etc.,
 * as well as comma-separated values.
 *
 * @returns Array of unique non-empty API key strings.
 */
function getPdfParserApiKeys(): string[] {
  const keys: string[] = [];
  const envVarNames = [
    "PDF_PARSER_GEMINI_API_KEY",
    "PDF_PARSER_GEMINI_API_KEY_1",
    "PDF_PARSER_GEMINI_API_KEY_2",
    "PDF_PARSER_GEMINI_API_KEY_3",
    "PDF_PARSER_GEMINI_API_KEY_4",
    "PDF_PARSER_GEMINI_API_KEY_5",
  ];

  for (const name of envVarNames) {
    const val = process.env[name];
    if (val) {
      const parts = val
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      keys.push(...parts);
    }
  }

  const uniqueKeys = Array.from(new Set(keys));
  if (uniqueKeys.length === 0) {
    throw new Error(
      "PDF_PARSER_GEMINI_API_KEY environment variable is not defined.",
    );
  }
  return uniqueKeys;
}

let keyWorkerPool: KeyWorker[] | null = null;

/**
 * Returns the lazily-initialized worker pool containing a GoogleGenAI client and PauseGate for each API key.
 *
 * @returns Array of KeyWorker instances.
 */
function getPdfParserKeyPool(): KeyWorker[] {
  if (!keyWorkerPool) {
    const keys = getPdfParserApiKeys();
    keyWorkerPool = keys.map((apiKey, index) => ({
      keyIndex: index + 1,
      apiKey,
      client: new GoogleGenAI({ apiKey }),
      gate: createPauseGate(),
    }));
  }
  return keyWorkerPool;
}

/**
 * Calculates the preferred key index (0-based) for a batch given total batch count and pool size.
 * When totalBatches > 15, batches are split into equal contiguous partitions across keys
 * (e.g. 20 batches -> 10 to Key 1, 10 to Key 2; 30 batches -> 15 to Key 1, 15 to Key 2).
 * When totalBatches <= 15, batches are assigned via round-robin.
 *
 * @param batchIndex - 0-based index of the current batch.
 * @param totalBatches - Total number of batches in the document.
 * @param poolSize - Number of available API key workers.
 * @returns Preferred 0-based key index.
 */
function getPreferredKeyIndex(
  batchIndex: number,
  totalBatches: number,
  poolSize: number,
): number {
  if (poolSize <= 1) return 0;

  if (totalBatches > 15) {
    const chunkSize = Math.ceil(totalBatches / poolSize);
    const partition = Math.floor(batchIndex / chunkSize);
    return Math.min(partition, poolSize - 1);
  }

  return batchIndex % poolSize;
}

/**
 * Selects the optimal KeyWorker for a batch attempt.
 *
 * 1. Checks if the preferred KeyWorker for this batch is ready (not paused/exhausted).
 *    If ready, returns the preferred worker.
 * 2. If the preferred worker is paused/exhausted (e.g. 429 or daily quota limit hit),
 *    checks if any other worker in the pool is ready and active.
 *    If an active worker exists, automatically redirects (fails over) to that worker!
 * 3. If ALL workers in the pool are currently paused/exhausted, returns the worker
 *    whose pause timer expires earliest so execution can resume as soon as any key cools down.
 *
 * @param pool - Array of initialized key workers.
 * @param preferredKeyIndex - The initially assigned 0-based key index for this batch.
 * @param attempt - 1-based attempt number.
 * @returns Selected KeyWorker instance.
 */
function selectWorker(
  pool: KeyWorker[],
  preferredKeyIndex: number,
  attempt: number,
): KeyWorker {
  if (pool.length === 0) {
    throw new Error("No API key workers available.");
  }

  const targetIndex = (preferredKeyIndex + attempt - 1) % pool.length;
  const targetWorker = pool[targetIndex];

  if (targetWorker.gate.isReady()) {
    return targetWorker;
  }

  // Preferred worker is paused/exhausted! Fail over to any available ready worker
  const readyWorkers = pool.filter((w) => w.gate.isReady());
  if (readyWorkers.length > 0) {
    return readyWorkers[0];
  }

  // All workers paused: return worker with earliest pause expiry
  return pool.reduce((earliest, curr) =>
    curr.gate.getPauseUntil() < earliest.gate.getPauseUntil() ? curr : earliest,
  );
}

/**
 * Parses a batch of text-extracted PDF pages via Gemini structured output.
 *
 * @param pageTexts - List of page numbers and extracted markdown text for this batch.
 * @param batchIndex - 0-based batch index.
 * @param preferredKeyIndex - Initially assigned 0-based key index.
 * @param isFirstBatch - Whether this is the first batch of the document (metadata requested only here).
 * @param pool - Multi-key worker pool.
 * @param onMetric - Callback invoked with per-batch diagnostics.
 * @param logger - Optional logger instance.
 * @returns Parsed batch result with pages and references found on these pages.
 */
async function parseBatchText(
  pageTexts: Array<{ pageNumber: number; text: string }>,
  batchIndex: number,
  preferredKeyIndex: number,
  isFirstBatch: boolean,
  pool: KeyWorker[],
  onMetric: (m: Omit<PdfBatchMetric, "startPage" | "endPage">) => void,
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const startPage = pageTexts[0].pageNumber;
  const endPage = pageTexts[pageTexts.length - 1].pageNumber;
  const batchStart = performance.now();
  const metadataClause = isFirstBatch
    ? "Fill the metadata object with the document's title and authors (plus optional publicationYear, publisher, and DOI). "
    : "";

  const pagesFormattedText = pageTexts
    .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text}`)
    .join("\n\n");

  const prompt = `Analyze all ${pageTexts.length} provided pages below. Format into clean markdown per page with pageNumber matching the page header. ${metadataClause}Extract bibliography entries.\n\n${pagesFormattedText}`;

  const payload = {
    model: PDF_PARSER_MODEL,
    contents: prompt,
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
    attempts++;
    const worker = selectWorker(pool, preferredKeyIndex, attempts);
    await worker.gate.wait();

    if (worker.keyIndex - 1 !== preferredKeyIndex) {
      logger?.info("pdf_parser_key_failover", {
        service: "pdf-parser",
        data: {
          batchIndex,
          preferredKeyIndex: preferredKeyIndex + 1,
          assignedKeyIndex: worker.keyIndex,
          pages: `${startPage}-${endPage}`,
        },
      });
    }

    try {
      const response = await worker.client.models.generateContent(payload);

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
          error.message.includes("RESOURCE_EXHAUSTED") ||
          error.message.includes("Quota exceeded"));
      const is5xx =
        error instanceof Error &&
        (error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("500"));

      if ((is429 || is5xx) && attempts < MAX_ATTEMPTS) {
        if (is429) {
          const retryDelayMs = parseRetryDelayMs(error) ?? 30_000;
          worker.gate.pause(retryDelayMs);
          logger?.info("pdf_parser_gemini_rate_limit", {
            service: "pdf-parser",
            data: {
              pages: `${startPage}-${endPage}`,
              keyIndex: worker.keyIndex,
              attempt: attempts,
              pauseMs: retryDelayMs,
            },
          });
        } else {
          await new Promise((r) => setTimeout(r, 2_000 * attempts));
        }
        continue;
      }

      throw error;
    }
  }
}

/**
 * Parses a batch of scanned PDF pages via Gemini Vision structured output.
 *
 * @param base64Data - Base64-encoded mini-PDF string for the batch.
 * @param startPage - 1-based start page number of this batch in the original document.
 * @param batchPageCount - Number of pages in this batch.
 * @param batchIndex - 0-based batch index.
 * @param preferredKeyIndex - Initially assigned 0-based key index.
 * @param isFirstBatch - Whether this is the first batch of the document.
 * @param pool - Multi-key worker pool.
 * @param onMetric - Callback invoked with per-batch diagnostics.
 * @param logger - Optional logger instance.
 * @returns Parsed batch result with pages and references found on these pages.
 */
async function parseBatchVision(
  base64Data: string,
  startPage: number,
  batchPageCount: number,
  batchIndex: number,
  preferredKeyIndex: number,
  isFirstBatch: boolean,
  pool: KeyWorker[],
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
    attempts++;
    const worker = selectWorker(pool, preferredKeyIndex, attempts);
    await worker.gate.wait();

    if (worker.keyIndex - 1 !== preferredKeyIndex) {
      logger?.info("pdf_parser_key_failover", {
        service: "pdf-parser",
        data: {
          batchIndex,
          preferredKeyIndex: preferredKeyIndex + 1,
          assignedKeyIndex: worker.keyIndex,
          pages: `${startPage}-${endPage}`,
        },
      });
    }

    try {
      const response = await worker.client.models.generateContent(payload);

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
          error.message.includes("RESOURCE_EXHAUSTED") ||
          error.message.includes("Quota exceeded"));
      const is5xx =
        error instanceof Error &&
        (error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("500"));

      if ((is429 || is5xx) && attempts < MAX_ATTEMPTS) {
        if (is429) {
          const retryDelayMs = parseRetryDelayMs(error) ?? 30_000;
          worker.gate.pause(retryDelayMs);
          logger?.info("pdf_parser_gemini_rate_limit", {
            service: "pdf-parser",
            data: {
              pages: `${startPage}-${endPage}`,
              keyIndex: worker.keyIndex,
              attempt: attempts,
              pauseMs: retryDelayMs,
            },
          });
        } else {
          await new Promise((r) => setTimeout(r, 2_000 * attempts));
        }
        continue;
      }

      throw error;
    }
  }
}

/**
 * Filters out non-bibliographic entries such as inline body quotes or running commentary.
 *
 * @param raw - The raw reference string.
 * @returns True if the string appears to be a formal bibliographic entry.
 */
function isFormalBibliographicEntry(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Filter out entries that start with prose transitions
  if (
    /^(It was|During|According to|As noted|He claims|She notes|This process|We can see|See also|Quoted in)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // Filter out long prose paragraphs (over 300 chars ending with body citations in parens)
  if (trimmed.length > 350 && trimmed.includes("(") && trimmed.includes(")")) {
    return false;
  }

  // Filter out inline page-number citations ending in ", p. 123", ", s. 45" or ", s. 45."
  if (/,\s*(?:[pP]{1,2}|[sS]{1,2})\.\s*\d+\.?$/i.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Merges raw batch results into a consolidated DocumentAnalysisResult.
 *
 * @param batches - List of batch page boundaries.
 * @param batchResults - List of parsed batch result objects.
 * @param fileName - Original file name for metadata fallback.
 * @param firstStart - 1-based start page of the requested parse range.
 * @param safeEnd - 1-based end page of the requested parse range.
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult object.
 */
function mergeBatchResults(
  batches: Array<{
    startPage: number;
    endPage: number;
    batchPageCount: number;
  }>,
  batchResults: DocumentAnalysisResult[],
  fileName: string,
  firstStart: number,
  safeEnd: number,
  logger?: Logger,
): DocumentAnalysisResult {
  let metadata: DocumentAnalysisResult["metadata"] | null = null;
  const pageMap = new Map<number, PageAnalysis>();
  const referenceMap = new Map<
    string,
    DocumentAnalysisResult["references"][number]
  >();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchResult = batchResults[batchIndex];

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

    for (const page of batchResult.pages) {
      const originalPage = batch.startPage + page.pageNumber - 1;
      if (!pageMap.has(originalPage)) {
        pageMap.set(originalPage, { ...page, pageNumber: originalPage });
      }
    }

    for (const ref of batchResult.references ?? []) {
      const key = ref.raw.trim();
      if (key && !referenceMap.has(key) && isFormalBibliographicEntry(key)) {
        referenceMap.set(key, ref);
      }
    }
  }

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

  if (!metadata) {
    metadata = {
      title: fileName.replace(/\.pdf$/i, ""),
      authors: [],
    };
  }

  return {
    metadata,
    pages: allPages,
    references: allReferences,
  };
}

/**
 * Parses a PDF document into structured page-level markdown, metadata, and references via pdf-inspector + Gemini.
 *
 * Uses `@firecrawl/pdf-inspector` to inspect the PDF in <100ms. If the PDF contains native text, extracts markdown
 * pages locally and dispatches text-only prompts concurrently to Gemini Flash Lite. If the PDF is scanned or image-based,
 * falls back to Gemini Vision OCR batching.
 *
 * @param pdfBuffer - The raw PDF file content.
 * @param fileName - Original file name (used for logging).
 * @param options - Optional driver settings (page range, batch size, concurrency, metric collector).
 * @param logger - Optional logger instance.
 * @returns Merged DocumentAnalysisResult with metadata, pages, and deduplicated references.
 */
export async function parsePdfToDocumentAnalysis(
  pdfBuffer: Buffer,
  fileName: string,
  options: PdfParseOptions = {},
  logger?: Logger,
): Promise<DocumentAnalysisResult> {
  const pool = getPdfParserKeyPool();
  const defaultConcurrency = pool.length * 15;
  const {
    batchSize = BATCH_SIZE,
    concurrency = options.concurrency ?? defaultConcurrency,
    metrics,
  } = options;

  // Step 1: Inspect PDF via pdf-inspector in <100ms
  const inspection = processPdfInspector(pdfBuffer);
  const isScannedOrOcr =
    inspection.pdfType === "Scanned" ||
    (inspection.pagesNeedingOcr && inspection.pagesNeedingOcr.length > 0);

  const limiter = createConcurrencyLimiter(concurrency);

  if (isScannedOrOcr) {
    // Scanned fallback: Vision base64 PDF batching
    const loadedDoc = await loadPdfSource(pdfBuffer);
    const totalPages = getPdfPageCount(loadedDoc);
    const firstStart = Math.max(1, options.startPage ?? 1);
    const safeEnd = options.endPage ?? totalPages;
    const totalBatches = Math.ceil((safeEnd - firstStart + 1) / batchSize);

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

    const batchResults = await Promise.all(
      batches.map((batch, batchIndex) =>
        limiter.exec(async () => {
          const batchBuffer = await extractBatchFromDoc(
            loadedDoc,
            batch.startPage,
            batch.endPage,
          );
          const base64Data = batchBuffer.toString("base64");

          return parseBatchVision(
            base64Data,
            batch.startPage,
            batch.batchPageCount,
            batchIndex,
            getPreferredKeyIndex(batchIndex, totalBatches, pool.length),
            batch.isFirstBatch,
            pool,
            (metric) => {
              metrics?.push({
                startPage: batch.startPage,
                endPage: batch.endPage,
                ...metric,
              });
            },
            logger,
          );
        }),
      ),
    );

    return mergeBatchResults(
      batches,
      batchResults,
      fileName,
      firstStart,
      safeEnd,
      logger,
    );
  }

  // Text-based PDF: ultra-fast local text extraction via pdf-inspector
  const extracted = extractPdfInspectorPages(pdfBuffer);
  const totalPages = extracted.pages.length;
  const firstStart = Math.max(1, options.startPage ?? 1);
  const safeEnd = options.endPage ?? totalPages;

  const targetPages = extracted.pages
    .slice(firstStart - 1, safeEnd)
    .map((p) => ({ pageNumber: p.page + 1, text: p.markdown }));

  const totalBatches = Math.ceil(targetPages.length / batchSize);

  const textBatches = Array.from({ length: totalBatches }, (_, batchIndex) => {
    const slice = targetPages.slice(
      batchIndex * batchSize,
      (batchIndex + 1) * batchSize,
    );
    const currentStart = slice[0].pageNumber;
    const currentEnd = slice[slice.length - 1].pageNumber;
    return {
      startPage: currentStart,
      endPage: currentEnd,
      batchPageCount: slice.length,
      slice,
      isFirstBatch: batchIndex === 0,
    };
  });

  const batchResults = await Promise.all(
    textBatches.map((batch, batchIndex) =>
      limiter.exec(async () => {
        return parseBatchText(
          batch.slice,
          batchIndex,
          getPreferredKeyIndex(batchIndex, totalBatches, pool.length),
          batch.isFirstBatch,
          pool,
          (metric) => {
            metrics?.push({
              startPage: batch.startPage,
              endPage: batch.endPage,
              ...metric,
            });
          },
          logger,
        );
      }),
    ),
  );

  return mergeBatchResults(
    textBatches,
    batchResults,
    fileName,
    firstStart,
    safeEnd,
    logger,
  );
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
