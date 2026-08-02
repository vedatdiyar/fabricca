import type { PageLayoutReport, TextItem } from "./types";

/** Minimum lines before column analysis runs. */
const MIN_MULTI_COLUMN_LINES = 8;
/** X tolerance (pt) for clustering line starts. */
const COLUMN_CLUSTER_TOLERANCE = 35;
/** Min line-start occurrences per valid cluster. */
const COLUMN_CLUSTER_MIN_LINES = 6;
/** Smaller/larger cluster count balance threshold. */
const COLUMN_BALANCE_RATIO = 0.4;
/** Min separation between the two top clusters (fraction of page width). */
const COLUMN_GUTTER_WIDTH_RATIO = 0.15;

/**
 * Whether a text string is noise, such as single symbols or isolated special characters.
 *
 * @param str - Text string to evaluate.
 * @returns True if the string is noise.
 */
export function isNoiseItem(str: string): boolean {
  const s = str.trim();
  if (s.length <= 1) return true;
  if (s.length <= 2 && /^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+$/.test(s)) return true;
  return false;
}

/**
 * Clusters X coordinates into column centers using an X tolerance.
 *
 * @param xPositions - Sorted X coordinates of detected line starts.
 * @param clusterTolerance - Max X distance (pt) for a coordinate to join a cluster.
 * @param minLineCount - Minimum occurrences for a cluster to be considered valid.
 * @returns Column clusters with their centers and line counts.
 */
function clusterColumnCenters(
  xPositions: number[],
  clusterTolerance = 25,
  minLineCount = 3,
): Array<{ center: number; count: number }> {
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
    .map((cl) => ({ center: cl.center, count: cl.count }));
}

/**
 * Analyzes page layout from line-start X coordinates and gap detection.
 *
 * @param items - Text items extracted from the page.
 * @param pageWidth - Page width in points.
 * @param pageIndex - Zero-based page index.
 * @returns Page layout report with column count, line scatter, and character count.
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
      charCount: totalChars,
    };
  }

  const horizontalItems = clean.filter(
    (it) => it.x > 20 && it.x < pageWidth - 20,
  );

  const lineMap = new Map<number, TextItem[]>();
  for (const item of horizontalItems) {
    const yKey = Math.round(item.y / 8) * 8;
    if (!lineMap.has(yKey)) lineMap.set(yKey, []);
    lineMap.get(yKey)!.push(item);
  }

  const totalLines = lineMap.size;
  if (totalLines < MIN_MULTI_COLUMN_LINES) {
    return {
      pageIndex,
      columnCount: 1,
      hasLineScatter: false,
      charCount: totalChars,
    };
  }

  const lineStartXs: number[] = [];
  for (const [, lineItems] of lineMap) {
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);
    if (sorted.length > 0) lineStartXs.push(sorted[0].x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = curr.x - prev.x;
      if (gap > 40) {
        const text = curr.str.trim();
        const isPageNumber =
          /^\d{1,4}$/.test(text) || /^[ivxlcdm]+$/i.test(text);
        const isLastItemInLine = i === sorted.length - 1;
        if (isPageNumber && isLastItemInLine) {
          continue;
        }
        lineStartXs.push(curr.x);
      }
    }
  }

  const columnClusters = clusterColumnCenters(
    lineStartXs,
    COLUMN_CLUSTER_TOLERANCE,
    COLUMN_CLUSTER_MIN_LINES,
  );

  let columnCount = 1;
  if (columnClusters.length >= 2) {
    const byLineCount = [...columnClusters].sort((a, b) => b.count - a.count);
    const largest = byLineCount[0];
    const second = byLineCount[1];
    const balance = second.count / largest.count;
    const gutterWidth = Math.abs(largest.center - second.center);

    if (
      balance >= COLUMN_BALANCE_RATIO &&
      gutterWidth >= pageWidth * COLUMN_GUTTER_WIDTH_RATIO
    ) {
      columnCount = Math.max(2, columnClusters.length);
    }
  }

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
    charCount: totalChars,
  };
}
