import type { PositionedTextItemInput } from "./page-detection-born-digital";

export interface LayoutAnalysisResult {
  /** True when the document layout has multiple columns that cannot be linearized cleanly by vertical position. */
  isComplexLayout: boolean;
  /** True when the embedded text layer shows legacy OCR distortion (spaced letters, OCR noise). */
  isCorruptOcr: boolean;
  /** Final recommendation on whether to route the document to Vision OCR (Mistral OCR). */
  shouldRouteToMistralOcr: boolean;
  /** Confidence score between 0.0 and 1.0. */
  confidence: number;
  /** Explanatory reasons for routing decision (for logging). */
  reasons: string[];
  /** Detailed structural and quality metrics. */
  metrics: {
    maxColumns: number;
    multiColumnLineRatio: number;
    sampledPagesCount: number;
    hasEmptyPagesWithImages: boolean;
    ocrArtifactRatePer1k: number;
    intrawordSpaceRatePer1k: number;
    evaluationTimeMs: number;
  };
}

/**
 * Minimum horizontal gap (in PDF points) between text blocks on the same vertical line
 * to be considered a distinct column gutter.
 */
const COLUMN_GUTTER_THRESHOLD_PX = 20;

/**
 * Vertical alignment tolerance (in PDF points) to group text items into the same line.
 */
const LINE_VERTICAL_TOLERANCE_PX = 4;

/**
 * Default maximum number of pages to sample for layout evaluation (< 30ms CPU time).
 */
const DEFAULT_MAX_PAGES_TO_SAMPLE = 4;

/**
 * Evaluates the spatial layout and text quality of positioned PDF items to determine
 * whether the document requires layout-aware Vision OCR (e.g. Mistral OCR) instead
 * of linear born-digital text extraction.
 *
 * Catches:
 * 1. Multi-column periodicals, newspapers, and magazines (3+ vertical columns per page).
 * 2. Documents with corrupted legacy OCR text layers (intraword single-letter splits, OCR noise).
 * 3. Mixed documents with scanned cover images and multi-column inner contents.
 *
 * @param positionedItems - Array of positioned text items extracted from the PDF.
 * @param maxPagesToSample - Maximum number of pages to inspect (defaults to 4).
 * @returns LayoutAnalysisResult with routing flag and metrics.
 */
export function evaluatePdfLayoutAndQuality(
  positionedItems: PositionedTextItemInput[],
  maxPagesToSample: number = DEFAULT_MAX_PAGES_TO_SAMPLE,
): LayoutAnalysisResult {
  const startTime = performance.now();

  // Edge case: No positioned items exist (pure scanned/image document)
  if (!positionedItems || positionedItems.length === 0) {
    return {
      isComplexLayout: false,
      isCorruptOcr: true,
      shouldRouteToMistralOcr: true,
      confidence: 1.0,
      reasons: ["No positioned text objects found (pure scanned image)."],
      metrics: {
        maxColumns: 0,
        multiColumnLineRatio: 0,
        sampledPagesCount: 0,
        hasEmptyPagesWithImages: true,
        ocrArtifactRatePer1k: 0,
        intrawordSpaceRatePer1k: 0,
        evaluationTimeMs: performance.now() - startTime,
      },
    };
  }

  // Identify available page indices
  const allPageIndices = Array.from(
    new Set(positionedItems.map((it) => it.page)),
  ).sort((a, b) => a - b);
  const samplePages = allPageIndices.slice(0, maxPagesToSample);

  let totalLinesSampled = 0;
  let multiColLinesCount = 0;
  let globalMaxCols = 1;
  let totalCharsSampled = 0;
  let ocrArtifactCount = 0;
  let intrawordSpaceCount = 0;
  let hasEmptyCoverOrPage = allPageIndices.length > 0 && allPageIndices[0] > 0;

  for (const pageIdx of samplePages) {
    const pageItems = positionedItems.filter(
      (it) => it.page === pageIdx && it.text.trim().length > 0,
    );

    if (pageItems.length === 0) {
      hasEmptyCoverOrPage = true;
      continue;
    }

    // 1. Scan text quality & OCR noise
    for (const it of pageItems) {
      const text = it.text;
      totalCharsSampled += text.length;

      // Noise characters common in legacy OCR (consecutive symbols, digits inside alphabetic words)
      const artifacts = text.match(
        /[~·|¬¦_]{2,}|(?<=[a-zA-ZçğıöşüÇĞİÖŞÜ])[0-9](?=[a-zA-ZçğıöşüÇĞİÖŞÜ])/g,
      );
      if (artifacts) ocrArtifactCount += artifacts.length;

      // Single-letter spaced fragmentation: e.g. "b u t u n" or "k u r t u l u s"
      const intraword = text.match(
        /(?:^|\s)[a-zA-ZçğıöşüÇĞİÖŞÜ]\s[a-zA-ZçğıöşüÇĞİÖŞÜ]\s[a-zA-ZçğıöşüÇĞİÖŞÜ](?:\s|$)/g,
      );
      if (intraword) intrawordSpaceCount += intraword.length;
    }

    // 2. Group items into horizontal lines (by Y coordinate) to detect side-by-side columns
    const sorted = [...pageItems].sort((a, b) => a.y - b.y || a.x - b.x);
    const lines: PositionedTextItemInput[][] = [];
    let currentLine: PositionedTextItemInput[] = [];
    let currentY = -1;

    for (const item of sorted) {
      if (currentY === -1 || Math.abs(item.y - currentY) <= LINE_VERTICAL_TOLERANCE_PX) {
        currentLine.push(item);
        currentY = item.y;
      } else {
        if (currentLine.length > 0) lines.push(currentLine);
        currentLine = [item];
        currentY = item.y;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // 3. Count column gutters along each line
    for (const line of lines) {
      if (line.length < 2) continue;
      totalLinesSampled++;

      const sortedByX = [...line].sort((a, b) => a.x - b.x);
      let colsOnLine = 1;
      for (let i = 0; i < sortedByX.length - 1; i++) {
        const gap = sortedByX[i + 1].x - (sortedByX[i].x + sortedByX[i].width);
        if (gap >= COLUMN_GUTTER_THRESHOLD_PX) {
          colsOnLine++;
        }
      }

      if (colsOnLine > globalMaxCols) globalMaxCols = colsOnLine;
      if (colsOnLine >= 3) multiColLinesCount++;
    }
  }

  const multiColumnLineRatio =
    totalLinesSampled > 0 ? multiColLinesCount / totalLinesSampled : 0;
  const ocrArtifactRatePer1k =
    totalCharsSampled > 0 ? (ocrArtifactCount * 1000) / totalCharsSampled : 0;
  const intrawordSpaceRatePer1k =
    totalCharsSampled > 0 ? (intrawordSpaceCount * 1000) / totalCharsSampled : 0;

  const reasons: string[] = [];

  // Criterion A: Complex multi-column layout (3+ columns on >= 10% of lines, or maxCols >= 4)
  const isComplexLayout =
    (globalMaxCols >= 3 && multiColumnLineRatio >= 0.1) || globalMaxCols >= 4;
  if (isComplexLayout) {
    reasons.push(
      `Multi-column layout detected (Max ${globalMaxCols} columns, multi-column line ratio: ${(multiColumnLineRatio * 100).toFixed(1)}%).`,
    );
  }

  // Criterion B: Corrupt legacy OCR text layer
  const isCorruptOcr =
    ocrArtifactRatePer1k >= 1.0 || intrawordSpaceRatePer1k >= 1.5;
  if (isCorruptOcr) {
    reasons.push(
      `Corrupt legacy OCR text layer detected (Artifacts: ${ocrArtifactRatePer1k.toFixed(2)}/1k, Fragmented spaces: ${intrawordSpaceRatePer1k.toFixed(2)}/1k).`,
    );
  }

  // Criterion C: Mixed document (Scanned/Image front cover + multi-column inner pages)
  if (hasEmptyCoverOrPage && globalMaxCols >= 2) {
    reasons.push("Cover or front page is an image with multi-column inner layout.");
  }

  const shouldRouteToMistralOcr =
    isComplexLayout || isCorruptOcr || (hasEmptyCoverOrPage && globalMaxCols >= 2);

  const evaluationTimeMs = performance.now() - startTime;

  return {
    isComplexLayout,
    isCorruptOcr,
    shouldRouteToMistralOcr,
    confidence: shouldRouteToMistralOcr ? 0.95 : 0.99,
    reasons,
    metrics: {
      maxColumns: globalMaxCols,
      multiColumnLineRatio,
      sampledPagesCount: samplePages.length,
      hasEmptyPagesWithImages: hasEmptyCoverOrPage,
      ocrArtifactRatePer1k,
      intrawordSpaceRatePer1k,
      evaluationTimeMs,
    },
  };
}
