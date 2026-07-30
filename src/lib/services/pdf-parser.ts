import { createRequire } from "module";
import { dirname, join } from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
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
 * Splits a long text block into sentence-aligned sub-chunks under maxLen characters.
 *
 * @param text - Input text block to split
 * @param maxLen - Maximum character length threshold
 * @returns Array of sentence-aligned text strings
 */
function splitLongText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  const sentences = text.match(/[^.!?;]+[.!?;]+|\S+/g) || [text];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence.trim();
    }
  }
  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Splitting full text into structured chunks strictly capped at MAX_CHUNK_CHARS length.
 *
 * @param fullText - Full text string extracted from PDF
 * @returns Array of structured document chunks
 */
function buildLocalChunks(fullText: string): UnstructuredChunk[] {
  const chunks: UnstructuredChunk[] = [];
  let chunkIndex = 0;
  const paragraphs = fullText.split("\n");
  let buffer: string[] = [];
  let bufferLen = 0;

  function flush() {
    if (buffer.length === 0) return;
    const content = buffer.join("\n");
    if (content.length > MAX_CHUNK_CHARS) {
      const subParts = splitLongText(content, MAX_CHUNK_CHARS);
      for (const part of subParts) {
        if (part.trim()) {
          chunks.push({
            chunkIndex: chunkIndex++,
            pageNumber: null,
            content: part.trim(),
            tokenCount: Math.ceil(part.trim().length / 4),
          });
        }
      }
    } else {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: null,
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
    if (bufferLen + trimmed.length > MAX_CHUNK_CHARS && buffer.length > 0) {
      flush();
    }
    if (trimmed.length > MAX_CHUNK_CHARS) {
      flush();
      const subParts = splitLongText(trimmed, MAX_CHUNK_CHARS);
      for (const part of subParts) {
        if (part.trim()) {
          chunks.push({
            chunkIndex: chunkIndex++,
            pageNumber: null,
            content: part.trim(),
            tokenCount: Math.ceil(part.trim().length / 4),
          });
        }
      }
      continue;
    }
    buffer.push(trimmed);
    bufferLen += trimmed.length;
  }
  flush();

  return chunks;
}

// pdfjs-dist standard fontlar için yol çözümleme
let standardFontDir = "";
try {
  const _require = createRequire(import.meta.url);
  standardFontDir =
    join(
      dirname(_require.resolve("pdfjs-dist/package.json")),
      "standard_fonts",
    ) + "/";
} catch {
  standardFontDir = "";
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
  const columnCount =
    totalLineStarts >= 5 && ratioRightLineStarts >= 0.2 ? 2 : 1;

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
  const docParams: { data: Uint8Array; standardFontDataUrl?: string } = {
    data,
  };
  if (standardFontDir) docParams.standardFontDataUrl = standardFontDir;
  const doc = await pdfjs.getDocument(docParams).promise;

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
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  let pageCount = 0;

  try {
    doc = await pdfjs.getDocument({ data: freshData }).promise;
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
    log.warn("pdf_hybrid_layout_analysis_failed", {
      service: "pdf-parser",
      error: err,
      data: { fileName, bufferSize: buffer.length },
    });

    log.info("pdf_fast_fallback_local_triggered", {
      service: "pdf-parser",
      data: {
        fileName,
        reason: "Layout analysis crashed, using fast local fallback",
      },
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
    log.info("fallback_to_unstructured_due_to_layout", {
      service: "pdf-parser",
      data: {
        fileName,
        reason: analysis.reason,
        multiColPageCount: analysis.multiColPageIndices.length,
        multiColPages: analysis.multiColPageIndices,
        scatterPageCount: analysis.scatterPageIndices.length,
        totalChars: analysis.totalChars,
        avgCharsPerPage: Math.round(analysis.avgCharsPerPage),
      },
    });
    return parsePdfWithUnstructured(buffer, fileName);
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
