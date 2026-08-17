import {
  type PrintedPageDetection,
  MAX_BACKWARD_EXTRAP_PAGES,
} from "./printed-page-number";

/**
 * Creates a resolver function that maps a 0-based PDF page index to its detected or extrapolated printed page number.
 *
 * @param pageDetection - The detection result from detectPrintedPageNumbers, or null when absent.
 * @returns A function taking a 0-based page index and returning a string representation of the printed page number or undefined.
 */
export function createPrintedPageResolver(
  pageDetection: PrintedPageDetection | null,
): (pageIndex0: number) => string | undefined {
  return (pageIndex0: number): string | undefined => {
    if (!pageDetection) return undefined;
    const direct = pageDetection.printedByPage.get(pageIndex0);
    if (direct !== undefined) {
      return String(direct);
    }
    if (
      pageDetection.offset !== null &&
      pageDetection.chainStartPage !== null &&
      pageIndex0 < pageDetection.chainStartPage
    ) {
      const value = pageIndex0 + pageDetection.offset;
      const distance = pageDetection.chainStartPage - pageIndex0;
      if (distance <= MAX_BACKWARD_EXTRAP_PAGES && value >= 1) {
        return String(value);
      }
    }
    return undefined;
  };
}
