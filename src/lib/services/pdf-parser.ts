import "@/lib/polyfills/math-sum-precise";
import { getDocumentProxy } from "unpdf";
import {
  parsePdfWithUnstructured,
  type UnstructuredChunk,
} from "./unstructured";
import { Logger } from "@/lib/logger";

// ────────────────────────────────────────────────────────────
//  Sabitler
// ────────────────────────────────────────────────────────────

const SAMPLE_PAGE_LIMIT = 20;
const SCAN_THRESHOLD = 50;

const MULTI_COLUMN_PAGE_RATIO = 0.4;
const COMPLEX_LAYOUT_PAGE_RATIO = 0.3;

const MAX_CHUNK_CHARS = 1200; // ~300 tokens, guaranteeing all chunks stay well below Cohere's 512 token limit

// ...

/**
 * Splitting full text into structured chunks strictly capped at MAX_CHUNK_CHARS length.
 *
 * @param fullText - Full text string extracted from PDF
 * @returns Array of structured document chunks
 */
function isValidSectionTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;

  const letters = trimmed.match(/[\p{L}]/gu) || [];
  if (letters.length < 3) return false;

  const nonSpaceChars = trimmed.replace(/\s/g, "");
  const letterRatio = letters.length / nonSpaceChars.length;
  if (letterRatio < 0.6) return false;

  if (/^[0-9\s.,;:*+\-/=<>(){}#%&"'^]+$/.test(trimmed)) return false;

  const isNumberedHeading = /^\d+(\.\d+)*\s+[\p{L}]/u.test(trimmed);
  const isCleanUppercase =
    trimmed === trimmed.toUpperCase() && letters.length >= 3;

  return isNumberedHeading || isCleanUppercase;
}

function mergeMicroChunks(chunks: UnstructuredChunk[]): UnstructuredChunk[] {
  if (chunks.length <= 1) return chunks;

  const result: UnstructuredChunk[] = [];
  const MIN_CHARS = 150;

  for (let i = 0; i < chunks.length; i++) {
    const current = chunks[i];
    if (current.content.length < MIN_CHARS && result.length > 0) {
      const prev = result[result.length - 1];
      if (
        prev.sectionTitle === current.sectionTitle &&
        (prev.printedPageNumber === current.printedPageNumber ||
          current.printedPageNumber === null)
      ) {
        prev.content = `${prev.content}\n\n${current.content}`;
        prev.tokenCount = Math.ceil(prev.content.length / 4);
        continue;
      }
    }
    result.push({ ...current });
  }

  return result.map((c, idx) => ({ ...c, chunkIndex: idx }));
}

function applyParentChildContext(
  chunks: UnstructuredChunk[],
): UnstructuredChunk[] {
  const WINDOW = 3;
  return chunks.map((c, idx) => {
    const start = Math.max(0, idx - 1);
    const end = Math.min(chunks.length, idx + WINDOW);
    const parentText = chunks
      .slice(start, end)
      .map((item) => item.content)
      .join("\n\n");

    return {
      ...c,
      parentContent: parentText,
    };
  });
}

function buildLocalChunks(fullText: string): UnstructuredChunk[] {
  const rawChunks: UnstructuredChunk[] = [];
  let chunkIndex = 0;
  const paragraphs = fullText.split("\n");
  let buffer: string[] = [];
  let bufferLen = 0;
  let currentSection: string | null = null;
  let currentPrintedPage: number | null = null;

  function flush() {
    if (buffer.length === 0) return;
    const content = buffer.join("\n").trim();
    if (content) {
      rawChunks.push({
        chunkIndex: chunkIndex++,
        pdfPageNumber: null,
        printedPageNumber: currentPrintedPage,
        sectionTitle: currentSection,
        content,
        tokenCount: Math.ceil(content.length / 4),
      });
    }
    buffer = [];
    bufferLen = 0;
  }

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const pageMatch = trimmed.match(/\[Sayfa (\d+)\]/i);
    if (pageMatch) {
      currentPrintedPage = parseInt(pageMatch[1], 10);
    }

    if (isValidSectionTitle(trimmed)) {
      flush();
      currentSection = trimmed;
    }

    if (bufferLen + trimmed.length > MAX_CHUNK_CHARS && buffer.length > 0) {
      flush();
    }
    buffer.push(trimmed);
    bufferLen += trimmed.length;
  }
  flush();

  const merged = mergeMicroChunks(rawChunks);
  return applyParentChildContext(merged);
}

// ────────────────────────────────────────────────────────────
//  Tipler
// ────────────────────────────────────────────────────────────

interface TextItem {
  str: string;
  x: number;
  y: number;
}

interface PageLayoutReport {
  pageIndex: number;
  columnCount: number;
  hasLineScatter: boolean;
  itemCount: number;
  charCount: number;
  gapThreshold: number | null;
}

interface PdfLayoutAnalysis {
  route: "local" | "unstructured-fallback";
  reason: string;
  fullText: string;
  pageCount: number;
  sampledPageCount: number;
  totalChars: number;
  avgCharsPerPage: number;
  isScanned: boolean;
  isMultiColumn: boolean;
  hasComplexLayout: boolean;
  multiColPageIndices: number[];
  scatterPageIndices: number[];
}

// ────────────────────────────────────────────────────────────
//  Yardımcı: Gürültü filtreleme
// ────────────────────────────────────────────────────────────

/**
 * Determines whether a text string is noise (e.g. single symbols, isolated special chars).
 *
 * @param str - The raw text string to check
 * @returns True if string is considered noise, false otherwise
 */
function isNoiseItem(str: string): boolean {
  const s = str.trim();
  if (s.length <= 1) return true;
  if (s.length <= 2 && /^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+$/.test(s)) return true;
  return false;
}

// ────────────────────────────────────────────────────────────
//  Sayfa Düzeni Analizi (Line-Start X Clustering)
// ────────────────────────────────────────────────────────────

/**
 * Analyzes layout structure for a single PDF page using line-start X coordinates.
 *
 * In single-column pages, almost all line starts occur near the left margin (X < centerLeft).
 * In double-column pages, substantial lines start near the right column (X > centerRight).
 *
 * @param items - Text items extracted from the page with X and Y coordinates
 * @param pageWidth - Page width in PDF points
 * @param pageIndex - 1-based page index
 * @returns Detailed PageLayoutReport for the page
 */
function analyzePageLayout(
  items: TextItem[],
  pageWidth: number,
  pageIndex: number,
): PageLayoutReport {
  const nonEmpty = items.filter((it) => it.str.trim().length > 0);
  const clean = nonEmpty.filter((it) => !isNoiseItem(it.str));
  const totalChars = nonEmpty.reduce((s, it) => s + it.str.trim().length, 0);

  if (clean.length < 6) {
    return {
      pageIndex,
      columnCount: 1,
      hasLineScatter: false,
      itemCount: clean.length,
      charCount: totalChars,
      gapThreshold: null,
    };
  }

  // Filter out horizontal sidebars/margin notes if outside main content margins
  const horizontalItems = clean.filter(
    (it) => it.x > 30 && it.x < pageWidth - 30,
  );

  const centerLeft = pageWidth * 0.45;
  const centerRight = pageWidth * 0.55;

  // Group text items by Y coordinate to find line start X
  const lineMap = new Map<number, number[]>();

  for (const item of horizontalItems) {
    const yKey = Math.round(item.y / 8) * 8; // 8pt line tolerance grouping
    if (!lineMap.has(yKey)) {
      lineMap.set(yKey, []);
    }
    lineMap.get(yKey)!.push(item.x);
  }

  let leftLineStarts = 0;
  let rightLineStarts = 0;

  for (const [, xCoords] of lineMap) {
    if (xCoords.length === 0) continue;
    const minX = Math.min(...xCoords);

    if (minX < centerLeft) {
      leftLineStarts++;
    } else if (minX > centerRight) {
      rightLineStarts++;
    }
  }

  const totalLineStarts = leftLineStarts + rightLineStarts;
  const ratioRightLineStarts =
    totalLineStarts > 0 ? rightLineStarts / totalLineStarts : 0;

  // Double Column if at least 20% of lines start in the right column region
  let columnCount = totalLineStarts >= 5 && ratioRightLineStarts >= 0.2 ? 2 : 1;

  // Additional detection: intra-line gap with right-column consistency filter.
  // Catches side-by-side or split-page layouts where a single Y-band contains
  // two text fragments at very different X positions (e.g. Italian magazine:
  // left fragment at x≈33, right fragment at x≈316-429).
  // The IQR (inter-quartile range) of the right-column X positions must be
  // tight (< 15% of page width) to reject false positives from headers,
  // footers, or justified text artifacts.
  if (columnCount === 1) {
    let gapLineCount = 0;
    let scannedLineCount = 0;
    const rightColXs: number[] = [];

    for (const [, items] of lineMap) {
      const sortedX = [...items].sort((a, b) => a - b);
      if (sortedX.length < 2) continue;
      scannedLineCount++;

      for (let i = 1; i < sortedX.length; i++) {
        if (sortedX[i] - sortedX[i - 1] > 80) {
          gapLineCount++;
          rightColXs.push(sortedX[i]);
          break;
        }
      }
    }

    if (gapLineCount >= 3 && gapLineCount / scannedLineCount >= 0.15) {
      const sorted = [...rightColXs].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;

      if (iqr < pageWidth * 0.15) {
        columnCount = 2;
      }
    }
  }

  // Scatter detection for complex mixed layouts
  let scatteredLines = 0;
  let totalLines = 0;
  for (const [, xCoords] of lineMap) {
    if (xCoords.length < 2) continue;
    totalLines++;
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    if (maxX - minX > 300) scatteredLines++;
  }

  const hasLineScatter = totalLines > 0 && scatteredLines / totalLines > 0.3;

  return {
    pageIndex,
    columnCount,
    hasLineScatter,
    itemCount: clean.length,
    charCount: totalChars,
    gapThreshold: null,
  };
}

// ────────────────────────────────────────────────────────────
//  PDF Düzen Analizi (20 Sayfa Sampling / Örneklem)
// ────────────────────────────────────────────────────────────

/**
 * Analyzes PDF layout structure using a fast 20-page sampling window.
 *
 * Samples the first 20 pages (1 to min(20, pageCount)) to inspect line-start coordinates.
 * If the 20-page sample determines a single-column layout, full text is extracted locally.
 * If multi-column or scanned layout is detected, immediately routes to Unstructured API
 * without decoding remaining pages.
 *
 * @param buffer - PDF binary buffer
 * @returns PdfLayoutAnalysis object containing routing decision and extracted text
 */
async function analyzePdfLayout(buffer: Buffer): Promise<PdfLayoutAnalysis> {
  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);

  const pageCount = doc.numPages;
  const sampledPageCount = Math.min(SAMPLE_PAGE_LIMIT, pageCount);

  const layoutReports: PageLayoutReport[] = [];
  const pageTexts: string[] = new Array<string>(pageCount);
  let sampledTotalChars = 0;

  // 1. Sample first 20 pages for layout analysis
  for (let i = 1; i <= sampledPageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const items: TextItem[] = textContent.items
        .filter((it: Record<string, unknown>) => typeof it.str === "string")
        .map((it: Record<string, unknown>) => ({
          str: (it.str as string) || "",
          x: (it.transform as number[])[4] || 0,
          y: (it.transform as number[])[5] || 0,
        }));

      const report = analyzePageLayout(items, viewport.width, i);
      layoutReports.push(report);
      sampledTotalChars += report.charCount;

      const rawText = items
        .filter((it) => !isNoiseItem(it.str))
        .map((it) => it.str.trim())
        .filter(Boolean)
        .join("\n");
      pageTexts[i - 1] = rawText;
    } catch {
      layoutReports.push({
        pageIndex: i,
        columnCount: 1,
        hasLineScatter: false,
        itemCount: 0,
        charCount: 0,
        gapThreshold: null,
      });
      pageTexts[i - 1] = "";
    }
  }

  const avgCharsPerPage =
    sampledPageCount > 0 ? sampledTotalChars / sampledPageCount : 0;
  const isScanned = avgCharsPerPage < SCAN_THRESHOLD;

  const multiColPages = layoutReports.filter((r) => r.columnCount >= 2);
  const scatterPages = layoutReports.filter((r) => r.hasLineScatter);

  const multiColPageIndices = multiColPages.map((r) => r.pageIndex);
  const scatterPageIndices = scatterPages.map((r) => r.pageIndex);

  const isMultiColumn =
    multiColPages.length >= sampledPageCount * MULTI_COLUMN_PAGE_RATIO;
  const hasComplexLayout =
    scatterPages.length >= sampledPageCount * COMPLEX_LAYOUT_PAGE_RATIO;

  let route: "local" | "unstructured-fallback";
  let reason: string;

  if (isScanned) {
    route = "unstructured-fallback";
    reason = `Scanned PDF: ${avgCharsPerPage.toFixed(1)} chars/page < ${SCAN_THRESHOLD} threshold (sampled ${sampledPageCount} pages)`;
  } else if (isMultiColumn) {
    const pagesStr = multiColPageIndices.join(",");
    reason = `Multi-column: ${multiColPages.length}/${sampledPageCount} sampled pages (≥${Math.round(MULTI_COLUMN_PAGE_RATIO * 100)}%) — pages: [${pagesStr}]`;
    route = "unstructured-fallback";
  } else if (hasComplexLayout) {
    const pagesStr = scatterPageIndices.join(",");
    reason = `Complex layout: ${scatterPages.length}/${sampledPageCount} sampled pages (≥${Math.round(COMPLEX_LAYOUT_PAGE_RATIO * 100)}%) — pages: [${pagesStr}]`;
    route = "unstructured-fallback";
  } else {
    route = "local";
    reason = `Single-column: ${pageCount} total pages, sampled ${sampledPageCount} pages, ${avgCharsPerPage.toFixed(1)} chars/page avg`;
  }

  // If fallback route is chosen, destroy doc immediately without extracting remaining pages
  if (route === "unstructured-fallback") {
    try {
      const docAny = doc as unknown as { destroy: () => Promise<void> };
      await docAny.destroy();
    } catch {
      /* ignore */
    }
    return {
      route,
      reason,
      fullText: "",
      pageCount,
      sampledPageCount,
      totalChars: sampledTotalChars,
      avgCharsPerPage,
      isScanned,
      isMultiColumn,
      hasComplexLayout,
      multiColPageIndices,
      scatterPageIndices,
    };
  }

  // 2. Local path: extract text for remaining pages (sampledPageCount + 1 ... pageCount)
  for (let i = sampledPageCount + 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const items: TextItem[] = textContent.items
        .filter((it: Record<string, unknown>) => typeof it.str === "string")
        .map((it: Record<string, unknown>) => ({
          str: (it.str as string) || "",
          x: (it.transform as number[])[4] || 0,
          y: (it.transform as number[])[5] || 0,
        }));
      const rawText = items
        .filter((it) => !isNoiseItem(it.str))
        .map((it) => it.str.trim())
        .filter(Boolean)
        .join("\n");
      pageTexts[i - 1] = rawText;
    } catch {
      pageTexts[i - 1] = "";
    }
  }

  try {
    const docAny = doc as unknown as { destroy: () => Promise<void> };
    await docAny.destroy();
  } catch {
    /* ignore */
  }

  const fullText = pageTexts.join("\n\n");

  return {
    route,
    reason,
    fullText,
    pageCount,
    sampledPageCount,
    totalChars: fullText.length,
    avgCharsPerPage,
    isScanned,
    isMultiColumn,
    hasComplexLayout,
    multiColPageIndices,
    scatterPageIndices,
  };
}

// ────────────────────────────────────────────────────────────
//  Smart Fast Local Fallback
// ────────────────────────────────────────────────────────────

/**
 * Extracts raw text from a PDF buffer without layout analysis or font dependencies.
 * Used as a fast local fallback when the layout analysis (`analyzePdfLayout`) fails.
 *
 * @param buffer - Raw PDF file buffer
 * @param fileName - Original PDF file name (for logging)
 * @param log - Logger instance for structured logging
 * @returns Array of structured document chunks
 */
async function extractRawTextFast(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<UnstructuredChunk[]> {
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
  const chunks = buildLocalChunks(fullText);
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

// ────────────────────────────────────────────────────────────
//  Hibrit PDF Router (Ana Entry Point)
// ────────────────────────────────────────────────────────────

/**
 * Parses a PDF buffer using a smart hybrid router with 20-page sampling for layout analysis:
 *
 * **Layer 1 — 20-Page Layout Sampling:** Samples the first 20 pages (1..min(20, N))
 * to detect single-column vs multi-column/scanned layouts in ~700ms.
 * - Single-column text → fast local extraction (~1.5s total for 500 pages).
 * - Multi-column / Scanned → immediately routes to Unstructured API without reading remaining pages.
 *
 * **Layer 2 — Fast Local Fallback:** If layout analysis fails (font crash, memory issue),
 * extracts raw text locally without layout analysis.
 *
 * **Layer 3 — Unstructured API:** Only for genuinely scanned/image-based PDFs or true multi-column layouts.
 *
 * @param buffer - Raw PDF file buffer
 * @param fileName - Original PDF file name (for logging / Unstructured fallback)
 * @param log - Logger instance for structured logging
 * @returns Array of structured document chunks
 */
export async function parsePdfWithHybridRouter(
  buffer: Buffer,
  fileName: string,
  log: Logger,
): Promise<UnstructuredChunk[]> {
  // ── 1. Layout Analysis (20-Page Sampling) ──
  log.info("pdf_hybrid_layout_analysis_start", {
    service: "pdf-parser",
    data: { fileName, bufferSize: buffer.length },
  });

  const analysisStart = performance.now();
  let analysis: PdfLayoutAnalysis;

  try {
    analysis = await analyzePdfLayout(buffer);
  } catch (err) {
    log.error("pdf_hybrid_layout_analysis_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName, bufferSize: buffer.length },
    });

    return extractRawTextFast(buffer, fileName, log);
  }

  const analysisDuration = performance.now() - analysisStart;

  log.info("pdf_hybrid_layout_analysis_success", {
    service: "pdf-parser",
    data: {
      fileName,
      route: analysis.route,
      reason: analysis.reason,
      pageCount: analysis.pageCount,
      sampledPageCount: analysis.sampledPageCount,
      totalChars: analysis.totalChars,
      avgCharsPerPage: Math.round(analysis.avgCharsPerPage),
      isScanned: analysis.isScanned,
      isMultiColumn: analysis.isMultiColumn,
      hasComplexLayout: analysis.hasComplexLayout,
      multiColPageCount: analysis.multiColPageIndices.length,
      multiColPages: analysis.multiColPageIndices,
      scatterPageCount: analysis.scatterPageIndices.length,
      scatterPages: analysis.scatterPageIndices,
      analysisDurationMs: Math.round(analysisDuration),
    },
  });

  // ── 2. Route Decision ──
  if (analysis.route === "unstructured-fallback") {
    return parsePdfWithUnstructured(buffer, fileName, log);
  }

  // ── 3. Local Fast Path ──
  log.info("pdf_local_extraction_start", {
    service: "pdf-parser",
    data: {
      fileName,
      pageCount: analysis.pageCount,
      totalChars: analysis.totalChars,
    },
  });

  const localStart = performance.now();
  const chunks = buildLocalChunks(analysis.fullText);
  const localDuration = performance.now() - localStart;

  log.info("pdf_local_extraction_success", {
    service: "pdf-parser",
    data: {
      fileName,
      route: "local",
      pageCount: analysis.pageCount,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
      extractionDurationMs: Math.round(localDuration),
      analysisDurationMs: Math.round(analysisDuration),
      totalDurationMs: Math.round(analysisDuration + localDuration),
    },
  });

  return chunks;
}
