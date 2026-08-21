/**
 * PDF chunk domain: formats numeric page indices coming from the PDF parser.
 * Do NOT merge with `src/lib/academic/page-utils.ts` which parses free-form
 * user input strings — different input types and validation rules.
 *
 * Computes the printed page number display string for a chunk.
 *
 * @param pageStart - Start page number.
 * @param pageEnd - End page number.
 * @returns The formatted string (e.g. "s. 12" or "ss. 12-17").
 */
export function formatPrintedPageNumber(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart === null) return null;
  if (pageEnd === null || pageStart === pageEnd) return `s. ${pageStart}`;
  return `ss. ${pageStart}-${pageEnd}`;
}

/** Strips the "s."/"ss." prefix and trailing dots from a parsed printed page token. */
export const PRINTED_PREFIX_RE = /^s{1,2}\.\s*/i;

/**
 * Normalizes a raw printed page number from the PDF parser into a usable token.
 *
 * @param printedPageNumber - The parser's raw printed page number, or null.
 * @returns The trimmed page token without the "s."/"ss." prefix, or null when absent.
 */
export function normalizePrintedPage(
  printedPageNumber: string | null | undefined,
): string | null {
  if (!printedPageNumber) return null;
  const trimmed = printedPageNumber
    .trim()
    .replace(/\.+$/g, "")
    .replace(PRINTED_PREFIX_RE, "")
    .trim();
  return trimmed || null;
}

/**
 * Renders a printed page range from the ordered page tokens seen in a chunk,
 * preserving the actual published journal page numbers (e.g. "ss. 119-151").
 *
 * @param printedPages - Ordered printed page tokens.
 * @returns The formatted string ("s. X" / "ss. X-Y"), or null when no token exists.
 */
export function formatPrintedPageRange(printedPages: string[]): string | null {
  const pages = printedPages.filter((p) => p.length > 0);
  if (pages.length === 0) return null;
  const start = pages[0];
  const end = pages[pages.length - 1];
  return start === end ? `s. ${start}` : `ss. ${start}-${end}`;
}
