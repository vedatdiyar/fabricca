import type { PageTextQuality, TextItem } from "./types";
import { isNoiseItem } from "./layout-analyzer";

const UNRELIABLE_CHAR_THRESHOLD = 0.05;

/**
 * Counts characters indicating a broken text layer.
 *
 * @param str - Text to scan for unreliable characters.
 * @returns Number of unreliable characters found.
 */
function countUnreliableChars(str: string): number {
  let count = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xfffd) count++;
    else if (code >= 0xe000 && code <= 0xf8ff) count++;
  }
  const cidMatches = str.match(/\(cid:\d+\)/g);
  if (cidMatches) count += cidMatches.length;
  return count;
}

/**
 * Analyzes text-layer quality and whether it is corrupted beyond a trustworthy threshold.
 *
 * @param items - Text items extracted from the page.
 * @param pageWidth - Page width in points.
 * @param pageHeight - Page height in points.
 * @returns Text quality report with area ratio and reliability flag.
 */
export function analyzeTextQuality(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number,
): PageTextQuality {
  const nonEmpty = items.filter((it) => it.str.trim().length > 0);
  const clean = nonEmpty.filter((it) => !isNoiseItem(it.str));

  const textArea = clean.reduce(
    (sum, it) => sum + (it.width || 0) * (it.height || 0),
    0,
  );
  const pageArea = pageWidth * pageHeight;

  let totalChars = 0;
  let unreliableChars = 0;
  for (const it of nonEmpty) {
    totalChars += it.str.length;
    unreliableChars += countUnreliableChars(it.str);
  }

  return {
    textAreaRatio: pageArea > 0 ? Math.min(1, textArea / pageArea) : 0,
    textUnreliable:
      totalChars > 0 &&
      unreliableChars / totalChars > UNRELIABLE_CHAR_THRESHOLD,
  };
}
