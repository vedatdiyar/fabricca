/**
 * Printed Page Number Detection
 *
 * Detects the physical printed page number (e.g. "119-151" in a journal) from
 * a PDF whose text layer carries a running header/footer, independent of the
 * physical PDF page index. Implements:
 *
 *   1. CPDF Page-Association (HP Labs): a header/footer line is recognised when
 *      its digit-masked form repeats across neighbouring pages.
 *   2. Font-size discrimination: header/footer runs are smaller than the body
 *      median font size (literature: <0.78x; we use a safe 0.85x).
 *   3. Anchor validation: a candidate is only accepted when it forms a +1
 *      consecutive run over ANCHOR_LEN pages — this kills years, TOC page
 *      references, and inline `pp. 162-179` citations.
 *   4. Backward extrapolation: cover/front pages preceding the confirmed chain
 *      are filled by subtracting the detected offset, bounded so the value
 *      stays positive and the extrapolation window stays small.
 *
 * Born-digital uses positioned text items (`extractTextWithPositions`); the
 * scanned/Mistral path supplies isolated `header`/`footer` strings instead.
 */

const TOP_FRACTION = 0.15;
const MASK_CHAR = "@";
const ANCHOR_LEN = 3;
const MAX_GAP = 3;
const YEAR_RANGE: [number, number] = [1900, 2100];
const FONT_RATIO = 0.85;
export const MAX_BACKWARD_EXTRAP_PAGES = 4;

export interface PrintedPageDetection {
  /** 0-based PDF page index -> printed page number. */
  printedByPage: Map<number, number>;
  /** Detected offset (printed = digitalIndex + offset), null when none. */
  offset: number | null;
  /** 0-based page index where the confirmed chain begins, null when none. */
  chainStartPage: number | null;
}

export interface MistralOcrPage {
  /** 0-based page index as returned by Mistral OCR. */
  index: number;
  /** Normalized markdown content for the page. */
  markdown: string;
  /** Printed page number parsed from the header/footer blocks, when found. */
  printedPageNumber?: string;
}

/** Replaces every digit run with the mask character ("pp. 119 151" -> "pp. @ @"). */
function maskDigits(text: string): string {
  return text.replace(/\d+/g, MASK_CHAR);
}

/** Returns all 1-4 digit integer runs in a text region. */
function extractDigitRuns(text: string): number[] {
  return [...text.matchAll(/\d{1,4}/g)].map((m) => parseInt(m[0], 10));
}

/** True when a digit value falls in the 1900-2100 year band. */
function isYear(value: number): boolean {
  return value >= YEAR_RANGE[0] && value <= YEAR_RANGE[1];
}

/**
 * Collapses a per-page band item list into x-ordered text lines by vertical
 * overlap, so a running header/footer can be compared across pages.
 */
function groupRows(
  items: Array<{ text: string; x: number; y: number; height: number }>,
): string[] {
  const rows: Array<{ text: string; x: number }> = [];
  const used = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const rowItems = [items[i]];
    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const a = items[i];
      const b = items[j];
      const overlap =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) >=
        Math.min(a.height, b.height) * 0.5;
      if (overlap) {
        used.add(j);
        rowItems.push(b);
      }
    }
    rowItems.sort((a, b) => a.x - b.x);
    rows.push({
      text: rowItems.map((it) => it.text.trim()).join(" ").replace(/\s+/g, " "),
      x: rowItems[0].x,
    });
  }
  rows.sort((a, b) => a.x - b.x);
  return rows.map((r) => r.text);
}

export interface PositionedTextItemInput {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  page: number;
}

/**
 * Resolves a printed-page chain from per-page candidate sets using a +1 anchor
 * with bounded gap tolerance and re-anchoring on long sequence breaks.
 *
 * @param candidateByPage - Candidate numbers per 0-based page index.
 * @param maxPage - Highest page index to process.
 * @returns Map of 0-based page index -> resolved printed page number.
 */
function resolveAnchorChain(
  candidateByPage: Map<number, Set<number>>,
  maxPage: number,
): Map<number, number> {
  const printed = new Map<number, number>();
  const isMatch = (page: number, expect: number): boolean =>
    candidateByPage.get(page)?.has(expect) ?? false;

  const tryAnchorAt = (page: number, value: number): boolean => {
    for (let k = 0; k < ANCHOR_LEN; k++) {
      if (!isMatch(page + k, value + k)) return false;
    }
    for (let k = 0; k < ANCHOR_LEN; k++) {
      printed.set(page + k, value + k);
    }
    return true;
  };

  // Find a start anchor.
  let anchored = false;
  for (let start = 0; start <= maxPage - ANCHOR_LEN; start++) {
    for (const n of candidateByPage.get(start) ?? []) {
      if (tryAnchorAt(start, n)) {
        anchored = true;
        break;
      }
    }
    if (anchored) break;
  }
  if (!anchored) return printed;

  for (let page = 0; page <= maxPage; page++) {
    if (printed.has(page)) continue;
    const prev = Math.max(
      ...[...printed.keys()].filter((p) => p < page),
      -1,
    );
    if (prev === -1) continue;
    const gap = page - prev;
    const prevVal = printed.get(prev)!;
    if (gap <= MAX_GAP) {
      printed.set(page, prevVal + gap);
      continue;
    }
    // Re-anchor: a new +1 run may exist after a numbering reset (new part).
    for (const n of candidateByPage.get(page) ?? []) {
      if (tryAnchorAt(page, n)) break;
    }
  }
  return printed;
}

/**
 * Runs the full detection pipeline over positioned text items (born-digital
 * path). The export returns one printed number per page, plus the offset and
 * chain start for downstream backward extrapolation.
 *
 * @param items - Positioned text items from `extractTextWithPositions`.
 * @returns Detected printed page mapping and diagnostics.
 */
export function detectPrintedPageNumbers(
  items: PositionedTextItemInput[],
): PrintedPageDetection {
  const empty = { printedByPage: new Map<number, number>(), offset: null, chainStartPage: null };
  if (items.length === 0) return empty;

  const height = Math.max(...items.map((it) => it.y + it.height));
  if (height <= 0) return empty;

  // Body font median (middle 60% of the page height).
  const midItems = items.filter(
    (it) => it.y > height * 0.2 && it.y + it.height < height * 0.8,
  );
  const bodySizes = midItems.map((it) => it.fontSize).filter((s) => s > 0);
  const bodyMedian = bodySizes.length
    ? bodySizes.sort((a, b) => a - b)[Math.floor(bodySizes.length / 2)]
    : null;

  const byPage = new Map<number, PositionedTextItemInput[]>();
  for (const it of items) {
    if (!byPage.has(it.page)) byPage.set(it.page, []);
    byPage.get(it.page)!.push(it);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const maxPage = pages[pages.length - 1];

  // Per-page horizontal rows in the top/bottom band.
  const pageRows = new Map<number, string[]>();
  for (const page of pages) {
    const bandItems = byPage.get(page)!.filter((it) => {
      const topBand = it.y < height * TOP_FRACTION;
      const bottomBand = it.y + it.height > height * (1 - TOP_FRACTION);
      return topBand || bottomBand;
    });
    pageRows.set(page, groupRows(bandItems));
  }

  // Page-association: a masked line must appear on >= 2 distinct pages.
  const maskedCount = new Map<string, number>();
  for (const rows of pageRows.values()) {
    for (const row of rows) {
      const key = maskDigits(row);
      if (key.length < 2) continue;
      maskedCount.set(key, (maskedCount.get(key) ?? 0) + 1);
    }
  }

  // Per-page candidate numbers.
  const candidateByPage = new Map<number, Set<number>>();
  for (const page of pages) {
    const set = new Set<number>();
    for (const row of pageRows.get(page) ?? []) {
      const masked = maskDigits(row);
      if ((maskedCount.get(masked) ?? 0) < 2) continue;
      for (const num of extractDigitRuns(row)) {
        if (!isYear(num)) set.add(num);
      }
    }
    // Font-filtered standalone numeric items in the bands.
    for (const it of byPage.get(page) ?? []) {
      const topBand = it.y < height * TOP_FRACTION;
      const bottomBand = it.y + it.height > height * (1 - TOP_FRACTION);
      if (!topBand && !bottomBand) continue;
      if (!/^\d{1,4}$/.test(it.text.trim())) continue;
      const num = parseInt(it.text.trim(), 10);
      if (isYear(num)) continue;
      if (
        bodyMedian !== null &&
        it.fontSize > 0 &&
        it.fontSize > bodyMedian * FONT_RATIO
      ) {
        continue;
      }
      set.add(num);
    }
    if (set.size > 0) candidateByPage.set(page, set);
  }

  const printedByPage = resolveAnchorChain(candidateByPage, maxPage);
  if (printedByPage.size === 0) return empty;

  const startKeys = [...printedByPage.keys()].sort((a, b) => a - b);
  const chainStartPage = startKeys[0];
  const offset = printedByPage.get(chainStartPage)! - chainStartPage;
  return { printedByPage, offset, chainStartPage };
}

/**
 * Extracts a candidate printed page number from an isolated running-head
 * string (Mistral `header`/`footer` block). Preferring the trailing digit run
 * for "Title 121" style, then the leading run for "120 Mesut Yeğen" style,
 * while rejecting years and known noise tokens.
 *
 * @param headerFooterText - The header or footer block content.
 * @returns The parsed page number, or undefined when ambiguous.
 */
export function parseRunningHeadNumber(
  headerFooterText: string | null | undefined,
): number | undefined {
  const text = (headerFooterText ?? "").trim();
  if (!text) return undefined;

  const runs = [...text.matchAll(/(\d{1,4})/g)];
  let best: number | undefined;
  for (const m of runs) {
    const value = parseInt(m[1], 10);
    if (isYear(value)) continue;
    const isTrailing = text.slice(m.index! + m[1].length).trim() === "";
    // Trailing page numbers ("The Kurdish question 121") are the dominant form;
    // fall back to any non-year run when no trailing candidate exists.
    if (isTrailing) {
      best = value;
      break;
    }
    if (best === undefined) best = value;
  }
  return best;
}

/**
 * Builds the per-page printed mapping for the scanned/Mistral path from the
 * isolated header/footer strings, applying the same anchor + offset logic so
 * years and decorative digits do not pollute the result.
 *
 * @param pages - OCR pages carrying markdown plus optional header/footer text.
 * @returns A map populated with a printed page number per 0-based page index.
 */
export function resolveMistralPrintedPages(
  pages: Array<{ index: number; header?: string | null; footer?: string | null }>,
): Map<number, number> {
  const candidateByPage = new Map<number, Set<number>>();
  let maxPage = 0;
  for (const page of pages) {
    const set = new Set<number>();
    const fromHeader = parseRunningHeadNumber(page.header);
    const fromFooter = parseRunningHeadNumber(page.footer);
    if (fromHeader !== undefined) set.add(fromHeader);
    if (fromFooter !== undefined) set.add(fromFooter);
    if (set.size > 0) candidateByPage.set(page.index, set);
    maxPage = Math.max(maxPage, page.index);
  }
  return resolveAnchorChain(candidateByPage, maxPage);
}