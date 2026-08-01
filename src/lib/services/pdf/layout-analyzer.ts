import type { PageLayoutReport, TextItem } from "./types";

/**
 * Determines whether a text string is noise (e.g. single symbols, isolated special chars).
 *
 * @param str - The raw text string to check
 * @returns True if string is considered noise, false otherwise
 */
export function isNoiseItem(str: string): boolean {
  const s = str.trim();
  if (s.length <= 1) return true;
  if (s.length <= 2 && /^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+$/.test(s)) return true;
  return false;
}

/**
 * Helper to collect all line start X coordinates across a set of TextItems.
 * A line start occurs at the beginning of a Y line, or after a horizontal gap > minGapPt (e.g. 20pt for narrow columns).
 */
function collectLineStartPositions(
  items: TextItem[],
  yTolerance = 6,
  minGapPt = 20,
): number[] {
  const lineMap = new Map<number, TextItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y / yTolerance) * yTolerance;
    if (!lineMap.has(yKey)) lineMap.set(yKey, []);
    lineMap.get(yKey)!.push(item);
  }

  const starts: number[] = [];
  for (const [, lineItems] of lineMap) {
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);
    if (sorted.length === 0) continue;

    // First item on line is always a line start
    starts.push(sorted[0].x);

    // Any item following a gap > minGapPt is ALSO a column line start
    for (let i = 1; i < sorted.length; i++) {
      const prevX = sorted[i - 1].x;
      const currX = sorted[i].x;
      if (currX - prevX > minGapPt) {
        starts.push(currX);
      }
    }
  }
  return starts;
}

/**
 * Clusters X coordinates into column centers using an X tolerance (e.g. 25pt).
 */
function clusterColumnCenters(
  xPositions: number[],
  clusterTolerance = 25,
  minLineCount = 3,
): number[] {
  if (xPositions.length === 0) return [];
  const sorted = [...xPositions].sort((a, b) => a - b);
  const clusters: { center: number; count: number; items: number[] }[] = [];

  for (const x of sorted) {
    let matched = false;
    for (const cl of clusters) {
      if (Math.abs(cl.center - x) < clusterTolerance) {
        cl.items.push(x);
        cl.center = cl.items.reduce((s, v) => s + v, 0) / cl.items.length;
        cl.count++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ center: x, count: 1, items: [x] });
    }
  }

  return clusters
    .filter((cl) => cl.count >= minLineCount)
    .sort((a, b) => a.center - b.center)
    .map((cl) => cl.center);
}

/**
 * Analyzes layout structure for a single PDF page using line-start X coordinates and gap detection.
 *
 * @param items - Text items extracted from the page with X and Y coordinates
 * @param pageWidth - Page width in PDF points
 * @param pageIndex - 1-based page index
 * @returns Detailed PageLayoutReport for the page
 */
export function analyzePageLayout(
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

  const horizontalItems = clean.filter(
    (it) => it.x > 20 && it.x < pageWidth - 20,
  );

  // Group items by vertical line (Y coordinate)
  const lineMap = new Map<number, TextItem[]>();
  for (const item of horizontalItems) {
    const yKey = Math.round(item.y / 8) * 8;
    if (!lineMap.has(yKey)) lineMap.set(yKey, []);
    lineMap.get(yKey)!.push(item);
  }

  const totalLines = lineMap.size;
  if (totalLines < 4) {
    return {
      pageIndex,
      columnCount: 1,
      hasLineScatter: false,
      itemCount: clean.length,
      charCount: totalChars,
      gapThreshold: null,
    };
  }

  // 1. Gutter (Vertical Gap) Analysis for 2-Column Layouts:
  // In a 2-column page, the center zone [0.44 * pageWidth, 0.56 * pageWidth] is free of text,
  // while substantial content exists on both the left (x < 0.42 * width) and right (x > 0.58 * width).
  const centerMinX = pageWidth * 0.44;
  const centerMaxX = pageWidth * 0.56;

  let linesOverlappingCenter = 0;
  let linesWithLeftContent = 0;
  let linesWithRightContent = 0;

  for (const [, lineItems] of lineMap) {
    let hasLeft = false;
    let hasRight = false;
    let overlapsCenter = false;

    for (const item of lineItems) {
      const itemEndX = item.x + item.str.length * 5;
      if (item.x < pageWidth * 0.42) hasLeft = true;
      if (item.x > pageWidth * 0.58) hasRight = true;

      if (item.x < centerMaxX && itemEndX > centerMinX) {
        overlapsCenter = true;
      }
    }

    if (hasLeft) linesWithLeftContent++;
    if (hasRight) linesWithRightContent++;
    if (overlapsCenter) linesOverlappingCenter++;
  }

  const centerOverlapRatio = linesOverlappingCenter / totalLines;
  const isGutterPresent =
    centerOverlapRatio < 0.15 &&
    linesWithLeftContent / totalLines > 0.3 &&
    linesWithRightContent / totalLines > 0.3;

  // 2. Line Start Clustering:
  // Collect line starts (only considering gaps > 40pt as potential new column starts)
  const lineStartXs: number[] = [];
  for (const [, lineItems] of lineMap) {
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);
    if (sorted.length > 0) lineStartXs.push(sorted[0].x);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].x - sorted[i - 1].x > 40) {
        lineStartXs.push(sorted[i].x);
      }
    }
  }

  const columnCenters = clusterColumnCenters(lineStartXs, 35, 6);
  let columnCount = 1;

  // A page is only multi-column if a clear vertical gutter (gap) is present between columns
  if (isGutterPresent) {
    columnCount = Math.max(2, columnCenters.length);
  }

  // 3. Line Scatter Check:
  // A line is scattered if it contains 3+ large internal gaps (>35pt), indicating table grids or chaotic forms
  let scatteredLineCount = 0;
  for (const [, lineItems] of lineMap) {
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);
    let gapCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].x - sorted[i - 1].x > 35) gapCount++;
    }
    if (gapCount >= 3) scatteredLineCount++;
  }

  const hasLineScatter =
    totalLines > 0 && scatteredLineCount / totalLines > 0.3;

  return {
    pageIndex,
    columnCount,
    hasLineScatter,
    itemCount: clean.length,
    charCount: totalChars,
    gapThreshold: null,
  };
}

/**
 * Universal N-Column Text Extractor (Supports 1, 2, 3, 4, 5+ Columns).
 * Uses dynamic line-start X gap clustering to detect column count and boundaries automatically.
 *
 * @param items - Text items extracted from page
 * @param _pageWidth - Page width in PDF points
 * @param pageHeight - Page height in PDF points
 * @returns Extracted string ordered by columns and vertical reading position
 */
export function extractColumnAwareText(
  items: TextItem[],
  _pageWidth: number,
  pageHeight: number,
): string {
  const clean = items.filter(
    (it) => !isNoiseItem(it.str) && it.str.trim().length > 0,
  );
  if (clean.length === 0) return "";

  // 1. Separate Header (top 15%), Footer (bottom 10%), and Body (middle 75%)
  const topHeaderThreshold = pageHeight * 0.85;
  const bottomFooterThreshold = pageHeight * 0.1;

  const headerItems: TextItem[] = [];
  const bodyItems: TextItem[] = [];
  const footerItems: TextItem[] = [];

  for (const item of clean) {
    if (item.y > topHeaderThreshold) {
      headerItems.push(item);
    } else if (item.y < bottomFooterThreshold) {
      footerItems.push(item);
    } else {
      bodyItems.push(item);
    }
  }

  const formatRegion = (regItems: TextItem[]): string => {
    if (regItems.length === 0) return "";
    const lineMap = new Map<number, TextItem[]>();
    for (const item of regItems) {
      const yKey = Math.round(item.y / 6) * 6; // 6pt Y tolerance
      if (!lineMap.has(yKey)) lineMap.set(yKey, []);
      lineMap.get(yKey)!.push(item);
    }
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a); // Top to bottom
    return sortedY
      .map((y) =>
        lineMap
          .get(y)!
          .sort((a, b) => a.x - b.x) // Left to right
          .map((it) => it.str.trim())
          .join(" "),
      )
      .join("\n");
  };

  if (bodyItems.length === 0) {
    return [formatRegion(headerItems), formatRegion(footerItems)]
      .filter(Boolean)
      .join("\n\n");
  }

  // 2. Collect line start positions considering intra-line gaps (down to 20pt narrow column gap)
  const lineStarts = collectLineStartPositions(bodyItems, 6, 20);
  const columnCenters = clusterColumnCenters(lineStarts, 25, 3);

  // Single column if <= 1 valid column center
  if (columnCenters.length <= 1) {
    return [
      formatRegion(headerItems),
      formatRegion(bodyItems),
      formatRegion(footerItems),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // 3. Calculate midpoint boundaries between adjacent column centers
  const boundaries: number[] = [];
  for (let i = 0; i < columnCenters.length - 1; i++) {
    const mid = (columnCenters[i] + columnCenters[i + 1]) / 2;
    boundaries.push(mid);
  }

  // 4. Assign body items to Column 0, 1, ..., N-1 based on boundaries
  const columns: TextItem[][] = Array.from(
    { length: columnCenters.length },
    () => [],
  );

  for (const item of bodyItems) {
    let colIndex = 0;
    while (colIndex < boundaries.length && item.x >= boundaries[colIndex]) {
      colIndex++;
    }
    columns[colIndex].push(item);
  }

  // Format all N columns in order
  const columnTexts = columns.map((col) => formatRegion(col));

  return [formatRegion(headerItems), ...columnTexts, formatRegion(footerItems)]
    .filter(Boolean)
    .join("\n\n");
}
