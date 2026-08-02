import pdf2md from "@opendocsg/pdf2md";
import type { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { parsePdfPageBatchWithLlamaParse } from "@/lib/services/llamaparse";
import { slicePdfPages, type PdfSliceStats } from "./page-slicer";
import { normalizeTurkishText } from "./turkish-normalizer";
import type { BatchProcessingResult, PageBatch, PageMarkdown } from "./types";

/** Max concurrent LlamaParse jobs; each involves slice + upload + poll + download. */
const MAX_CONCURRENT_LLAMA_JOBS = 2;

/**
 * Builds the inclusive 1-based page index array for a batch range.
 *
 * @param startPage - First page of the range.
 * @param endPage - Last page of the range.
 * @returns Array of consecutive page numbers from startPage to endPage.
 */
function buildPageRange(startPage: number, endPage: number): number[] {
  const pages: number[] = [];
  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }
  return pages;
}

/**
 * Rounds a percentage to one decimal place for log output.
 *
 * @param value - Percentage value to round.
 * @returns Value rounded to one decimal place.
 */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Splits pdf2md's single-string output into per-page parts using page markers, form-feeds, or an approximate line split.
 *
 * @param fullMarkdown - Single-string markdown output from pdf2md.
 * @param pageCount - Total number of pages in the source document.
 * @returns Map of page numbers to their markdown content.
 */
function splitPdf2mdByPage(
  fullMarkdown: string,
  pageCount: number,
): Map<number, string> {
  const pageMap = new Map<number, string>();

  const markerPattern = /\[PDF(?:Sayfa|[_\s]*Page)\s+(\d+)\]/gi;
  const markerMatches = [...fullMarkdown.matchAll(markerPattern)];

  if (markerMatches.length > 0) {
    let lastIndex = 0;
    let lastPageNum = 1;

    for (const match of markerMatches) {
      const pageNum = parseInt(match[1], 10);
      const matchStart = match.index ?? 0;
      const prevText = fullMarkdown.slice(lastIndex, matchStart).trim();
      if (prevText) {
        pageMap.set(lastPageNum, prevText);
      }
      lastIndex = matchStart + match[0].length;
      lastPageNum = pageNum;
    }

    const remaining = fullMarkdown.slice(lastIndex).trim();
    if (remaining) {
      pageMap.set(lastPageNum, remaining);
    }
    return pageMap;
  }

  if (fullMarkdown.includes("\f")) {
    const parts = fullMarkdown.split("\f");
    parts.forEach((part, idx) => {
      const trimmed = part.trim();
      if (trimmed) {
        pageMap.set(idx + 1, trimmed);
      }
    });
    return pageMap;
  }

  pageMap.set(1, fullMarkdown.trim());

  if (pageCount > 1 && fullMarkdown.trim()) {
    const lines = fullMarkdown.split("\n");
    const approxLinesPerPage = Math.max(
      1,
      Math.floor(lines.length / pageCount),
    );
    pageMap.clear();

    for (let p = 1; p <= pageCount; p++) {
      const start = (p - 1) * approxLinesPerPage;
      const end = p === pageCount ? lines.length : p * approxLinesPerPage;
      const text = lines.slice(start, end).join("\n").trim();
      if (text) {
        pageMap.set(p, text);
      }
    }
  }

  return pageMap;
}

/**
 * Serves a class-A batch from the shared pdf2md page cache.
 *
 * @param batch - Class-A batch to serve from the cache.
 * @param pageMarkdownCache - Shared cache mapping page numbers to markdown.
 * @returns Page markdown entries for every page in the batch.
 */
function processLocalBatchFromCache(
  batch: PageBatch,
  pageMarkdownCache: Map<number, string>,
): PageMarkdown[] {
  const result: PageMarkdown[] = [];
  for (let p = batch.startPage; p <= batch.endPage; p++) {
    const markdown = pageMarkdownCache.get(p) ?? "";
    result.push({
      pageIndex: p,
      markdown,
      source: "local",
      label: "A",
    });
  }
  return result;
}

/**
 * Processes each page batch with its matching engine in parallel: local class A batches via pdf2md and API class B/C batches via sliced LlamaParse requests.
 *
 * @param batches - Page batches to process.
 * @param buffer - Source PDF file buffer.
 * @param fileName - Source PDF file name for logging.
 * @param pageCount - Total number of pages in the source document.
 * @param log - Structured logger instance.
 * @returns Batch processing result with pages and batch statistics.
 */
export async function executeBatches(
  batches: PageBatch[],
  buffer: Buffer,
  fileName: string,
  pageCount: number,
  log: Logger,
): Promise<BatchProcessingResult> {
  const execStart = performance.now();

  const hasLocalBatches = batches.some((b) => b.label === "A");
  const hasApiBatches = batches.some((b) => b.label !== "A");

  let pdf2mdCache: Map<number, string> = new Map();

  if (hasLocalBatches) {
    log.info("pdf_local_batch_extraction_start", {
      service: "pdf-parser",
      data: {
        fileName,
        localBatchCount: batches.filter((b) => b.label === "A").length,
      },
    });

    const localStart = performance.now();
    const rawMd = await pdf2md(new Uint8Array(buffer));
    const normalizedMd = normalizeTurkishText(rawMd);
    pdf2mdCache = splitPdf2mdByPage(normalizedMd, pageCount);

    log.info("pdf_local_batch_extraction_success", {
      service: "pdf-parser",
      data: {
        fileName,
        cachedPageCount: pdf2mdCache.size,
        durationMs: Math.round(performance.now() - localStart),
      },
    });
  }

  const llamaLimiter = createConcurrencyLimiter(MAX_CONCURRENT_LLAMA_JOBS);

  interface BatchRun {
    pages: PageMarkdown[];
    sliceStats?: PdfSliceStats;
  }

  const batchPromises = batches.map((batch): Promise<BatchRun> => {
    if (batch.label === "A") {
      return Promise.resolve({
        pages: processLocalBatchFromCache(batch, pdf2mdCache),
      });
    }

    const tier = batch.llamaParseTier ?? "cost_effective";
    return llamaLimiter.exec(async (): Promise<BatchRun> => {
      const requestedPages = buildPageRange(batch.startPage, batch.endPage);
      const rangeLabel = `${batch.startPage}-${batch.endPage}`;

      log.info("pdf_batch_slice_start", {
        service: "pdf-parser",
        data: {
          fileName,
          batchRange: rangeLabel,
          requestedPageCount: requestedPages.length,
        },
      });

      const sliceStart = performance.now();
      const slice = await slicePdfPages(buffer, requestedPages);

      log.info("pdf_batch_slice_success", {
        service: "pdf-parser",
        data: {
          fileName,
          batchRange: rangeLabel,
          slicedPageCount: slice.stats.slicedPageCount,
          originalSize: slice.stats.originalSize,
          slicedSize: slice.stats.slicedSize,
          savedBytes: slice.stats.savedBytes,
          savedPercent: roundToOneDecimal(slice.stats.savedPercent),
          durationMs: Math.round(performance.now() - sliceStart),
        },
      });

      const pages = await parsePdfPageBatchWithLlamaParse(
        slice.slicedBuffer,
        fileName,
        batch.startPage,
        batch.endPage,
        tier,
        log,
      );

      return { pages, sliceStats: slice.stats };
    });
  });

  const batchResults = await Promise.all(batchPromises);

  const allPages: PageMarkdown[] = batchResults
    .flatMap((r) => r.pages)
    .sort((a, b) => a.pageIndex - b.pageIndex);

  const apiSlices = batchResults.flatMap((r) =>
    r.sliceStats ? [r.sliceStats] : [],
  );
  const apiPayloadBytes = apiSlices.reduce((s, x) => s + x.slicedSize, 0);
  const savedPayloadBytes = apiSlices.reduce((s, x) => s + x.savedBytes, 0);

  const localBatches = batches.filter((b) => b.label === "A");
  const apiBatches = batches.filter((b) => b.label !== "A");

  log.info("pdf_batch_execution_success", {
    service: "pdf-parser",
    data: {
      fileName,
      hasLocalBatches,
      hasApiBatches,
      localBatchCount: localBatches.length,
      apiBatchCount: apiBatches.length,
      localPageCount: localBatches.reduce((s, b) => s + b.pageCount, 0),
      apiPageCount: apiBatches.reduce((s, b) => s + b.pageCount, 0),
      apiPayloadBytes,
      savedPayloadBytes,
      totalOutputPages: allPages.length,
      durationMs: Math.round(performance.now() - execStart),
    },
  });

  return {
    pages: allPages,
    batchStats: {
      localBatchCount: localBatches.length,
      apiBatchCount: apiBatches.length,
      localPageCount: localBatches.reduce((s, b) => s + b.pageCount, 0),
      apiPageCount: apiBatches.reduce((s, b) => s + b.pageCount, 0),
      totalDurationMs: Math.round(performance.now() - execStart),
      apiPayloadBytes,
      savedPayloadBytes,
    },
  };
}
