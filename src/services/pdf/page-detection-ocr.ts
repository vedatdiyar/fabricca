import { isYear, resolveAnchorChain } from "./page-detection-born-digital";

export interface MistralOcrPage {
  /** 0-based page index as returned by Mistral OCR. */
  index: number;
  /** Normalized markdown content for the page. */
  markdown: string;
  /** Printed page number parsed from the header/footer blocks, when found. */
  printedPageNumber?: string;
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
  pages: Array<{
    index: number;
    header?: string | null;
    footer?: string | null;
  }>,
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
